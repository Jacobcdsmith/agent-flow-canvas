import { describe, it, expect, vi, beforeEach } from "vitest";
import { runFlow, runNode } from "../flow/runFlow";
import { saveWorkflows, TEMPLATES, Workflow } from "../flow/workflows";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";

describe("Subagent Nested Workflow Execution Tests", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.restoreAllMocks();

    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, val: string) => {
      mockStorage[key] = val;
    });

    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => {
      return mockStorage[key] || null;
    });
  });

  it("should gracefully fall back to simulation when the configured subagent workflow is not found", async () => {
    const node: Node<AgentNodeData> = {
      id: "sub-1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "subagent",
        name: "call_nested",
        config: {
          graph: "missing-workflow-id",
          input: "state.query",
        },
      },
    };

    const state: Record<string, unknown> = { query: "hello child" };
    const opts = { nodes: [node], edges: [], gateways: [] };

    const output = await runNode(node, state, [], opts, [], []);
    expect(output).toBeDefined();
    expect((output as any).simulated).toBe(true);
    expect((output as any).note).toContain("fallback to simulated");
  });

  it("should recursively execute a subagent workflow and return correct nested output and subLogs", async () => {
    // 1. Define and save a child sub-workflow
    const subWorkflow: Workflow = {
      id: "child-wf-id",
      name: "Child Sub Workflow",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodes: [
        {
          id: "child-trigger",
          type: "agent",
          position: { x: 0, y: 0 },
          data: {
            kind: "trigger",
            name: "on_child_request",
            isEntry: true,
            config: { source: "manual" },
          },
        },
        {
          id: "child-sink",
          type: "agent",
          position: { x: 100, y: 0 },
          data: {
            kind: "sink",
            name: "child_return",
            isTerminal: true,
            config: { target: "response" },
          },
        },
      ],
      edges: [
        { id: "ce1", source: "child-trigger", target: "child-sink", label: "next" },
      ],
    };

    // Save sub-workflow so loadWorkflows() returns it
    saveWorkflows([subWorkflow]);

    // 2. Define parent node that triggers this subagent workflow
    const subagentNode: Node<AgentNodeData> = {
      id: "subagent-1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "subagent",
        name: "delegate_task",
        config: {
          graph: "child-wf-id",
          input: "hello standard text",
        },
      },
    };

    const state: Record<string, unknown> = { query: "parent query" };
    const opts = { nodes: [subagentNode], edges: [], gateways: [] };

    // 3. Execute parent subagent node
    const output = await runNode(subagentNode, state, [], opts, [], []);
    expect(output).toBeDefined();

    const result = output as any;
    expect(result.subagent).toBe("Child Sub Workflow");
    expect(result.subagentId).toBe("child-wf-id");
    expect(result.input).toEqual({ query: "hello standard text" });

    // Ensure it executed the sub-workflow and collected nested logs
    expect(result.subLogs).toBeDefined();
    expect(result.subLogs.length).toBe(2); // child-trigger -> child-sink
    expect(result.subLogs[0].nodeId).toBe("child-trigger");
    expect(result.subLogs[1].nodeId).toBe("child-sink");
    expect(result.output).toBeDefined(); // return from sink
    expect(result.output.target).toBe("response");
  });

  it("should run full parent flow with subagent node and capture subLogs nested inside parent logs", async () => {
    // 1. Save sub-workflow
    const subWorkflow: Workflow = {
      id: "child-calc",
      name: "Calculator Sub Workflow",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodes: [
        {
          id: "cc-trig",
          type: "agent",
          position: { x: 0, y: 0 },
          data: {
            kind: "trigger",
            name: "start_calc",
            isEntry: true,
            config: { source: "manual" },
          },
        },
        {
          id: "cc-sink",
          type: "agent",
          position: { x: 100, y: 0 },
          data: {
            kind: "sink",
            name: "end_calc",
            isTerminal: true,
            config: { target: "response" },
          },
        },
      ],
      edges: [
        { id: "cce-1", source: "cc-trig", target: "cc-sink", label: "next" },
      ],
    };

    saveWorkflows([subWorkflow]);

    // 2. Define a full parent flow containing: Trigger -> Subagent -> Sink
    const parentNodes: Node<AgentNodeData>[] = [
      {
        id: "p-trig",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "trigger",
          name: "parent_trigger",
          isEntry: true,
          config: { source: "manual" },
        },
      },
      {
        id: "p-sub",
        type: "agent",
        position: { x: 100, y: 0 },
        data: {
          kind: "subagent",
          name: "execute_calc",
          config: {
            graph: "child-calc",
            input: '{"query": "custom input"}',
          },
        },
      },
      {
        id: "p-sink",
        type: "agent",
        position: { x: 200, y: 0 },
        data: {
          kind: "sink",
          name: "parent_sink",
          isTerminal: true,
          config: { target: "response" },
        },
      },
    ];

    const parentEdges: Edge[] = [
      { id: "pe-1", source: "p-trig", target: "p-sub", label: "next" },
      { id: "pe-2", source: "p-sub", target: "p-sink", label: "next" },
    ];

    // 3. Execute full parent flow using runFlow
    const parentLogs = await runFlow({
      nodes: parentNodes,
      edges: parentEdges,
      gateways: [],
      initialState: { query: "parent starts" },
    });

    expect(parentLogs.length).toBe(3); // p-trig -> p-sub -> p-sink

    const subStepLog = parentLogs[1];
    expect(subStepLog.nodeId).toBe("p-sub");
    expect(subStepLog.output).toBeDefined();

    const outputObj = subStepLog.output as any;
    expect(outputObj.subagent).toBe("Calculator Sub Workflow");
    expect(outputObj.subLogs).toBeDefined();
    expect(outputObj.subLogs.length).toBe(2); // cc-trig -> cc-sink
    expect(outputObj.subLogs[0].nodeId).toBe("cc-trig");
    expect(outputObj.subLogs[1].nodeId).toBe("cc-sink");

    // Parent sink should have processed successfully
    expect(parentLogs[2].nodeId).toBe("p-sink");
    expect(parentLogs[2].error).toBeUndefined();
  });
});
