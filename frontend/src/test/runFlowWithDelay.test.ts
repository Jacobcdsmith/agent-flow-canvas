import { describe, it, expect } from "vitest";
import { runFlow } from "../flow/runFlow";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";

describe("runFlow with stepDelay and custom initialState", () => {
  it("should execute with custom initialState and run successfully", async () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "trigger",
          name: "on_request",
          config: { source: "webhook", schema: "{ query: str }" },
          isEntry: true,
        },
      },
      {
        id: "n2",
        type: "agent",
        position: { x: 100, y: 100 },
        data: {
          kind: "sink",
          name: "return_result",
          config: { target: "response" },
          isTerminal: true,
        },
      },
    ];

    const edges: Edge[] = [
      {
        id: "e1",
        source: "n1",
        target: "n2",
        label: "next",
      },
    ];

    const logs: any[] = [];
    const t0 = Date.now();

    const result = await runFlow({
      nodes,
      edges,
      gateways: [],
      initialState: { query: "hello from test", custom_param: 42 },
      stepDelay: 100, // 100ms delay
      onLog: (log) => logs.push(log),
    });

    const elapsed = Date.now() - t0;

    // Verify step delay worked (elapsed time should be at least 100ms since we delayed after n1 execution)
    expect(elapsed).toBeGreaterThanOrEqual(95);

    // Verify logs were streamed
    expect(logs.length).toBe(2);
    expect(logs[0].nodeId).toBe("n1");
    expect(logs[1].nodeId).toBe("n2");

    // Verify result output
    expect(result.length).toBe(2);
  });
});
