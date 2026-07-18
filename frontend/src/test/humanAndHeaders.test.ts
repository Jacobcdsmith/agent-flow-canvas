import { describe, it, expect, vi } from "vitest";
import { runFlow } from "../flow/runFlow";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";

describe("runFlow with Human-in-the-Loop node", () => {
  it("should pause execution and wait for onHumanApproval callback if provided", async () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "trigger",
          name: "on_request",
          config: {},
          isEntry: true,
        },
      },
      {
        id: "n2",
        type: "agent",
        position: { x: 100, y: 100 },
        data: {
          kind: "human",
          name: "wait_for_user",
          config: {
            prompt: "Do you want to continue, {{state.user}}?",
            channel: "web-ui",
          },
        },
      },
      {
        id: "n3",
        type: "agent",
        position: { x: 200, y: 200 },
        data: {
          kind: "sink",
          name: "return_result",
          config: { target: "response" },
          isTerminal: true,
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", label: "next" },
      { id: "e2", source: "n2", target: "n3", label: "next" },
    ];

    const mockOnHumanApproval = vi.fn().mockImplementation(async (req) => {
      expect(req.nodeId).toBe("n2");
      expect(req.name).toBe("wait_for_user");
      expect(req.prompt).toBe("Do you want to continue, Alice?");
      expect(req.channel).toBe("web-ui");
      return "approved_by_test_user";
    });

    const logs: any[] = [];
    const result = await runFlow({
      nodes,
      edges,
      gateways: [],
      initialState: { user: "Alice" },
      onLog: (log) => logs.push(log),
      onHumanApproval: mockOnHumanApproval,
    });

    expect(mockOnHumanApproval).toHaveBeenCalledTimes(1);
    expect(logs.length).toBe(3);

    const humanLog = logs.find((l) => l.nodeId === "n2");
    expect(humanLog).toBeDefined();
    expect(humanLog.output).toEqual({
      prompt: "Do you want to continue, Alice?",
      channel: "web-ui",
      decision: "approved_by_test_user",
    });

    const sinkLog = logs.find((l) => l.nodeId === "n3");
    expect(sinkLog).toBeDefined();
    expect(sinkLog.output).toEqual({
      target: "response",
      result: {
        prompt: "Do you want to continue, Alice?",
        channel: "web-ui",
        decision: "approved_by_test_user",
      },
    });
  });

  it("should fall back to auto-approval if onHumanApproval callback is NOT provided", async () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "trigger",
          name: "on_request",
          config: {},
          isEntry: true,
        },
      },
      {
        id: "n2",
        type: "agent",
        position: { x: 100, y: 100 },
        data: {
          kind: "human",
          name: "wait_for_user",
          config: {
            prompt: "Review draft",
            channel: "slack",
          },
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", label: "next" },
    ];

    const logs: any[] = [];
    await runFlow({
      nodes,
      edges,
      gateways: [],
      onLog: (log) => logs.push(log),
    });

    const humanLog = logs.find((l) => l.nodeId === "n2");
    expect(humanLog).toBeDefined();
    expect(humanLog.output).toEqual({
      simulated: true,
      prompt: "Review draft",
      channel: "slack",
      decision: "auto-approved (schematic)",
    });
  });
});
