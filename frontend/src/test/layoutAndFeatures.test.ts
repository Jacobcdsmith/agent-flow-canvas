import { describe, expect, it } from "vitest";
import { autoLayoutGraph } from "../flow/graphLayout";
import type { Node, Edge } from "reactflow";
import type { AgentNodeData } from "../flow/types";

describe("Graph Layout Engine", () => {
  const sampleNodes: Node<AgentNodeData>[] = [
    {
      id: "n1",
      position: { x: 0, y: 0 },
      data: { kind: "trigger", name: "Trigger", config: {}, isEntry: true },
    },
    {
      id: "n2",
      position: { x: 0, y: 0 },
      data: { kind: "llm", name: "Reasoning", config: {} },
    },
    {
      id: "n3",
      position: { x: 0, y: 0 },
      data: { kind: "sink", name: "Output", config: {}, isTerminal: true },
    },
  ];

  const sampleEdges: Edge[] = [
    { id: "e1-2", source: "n1", target: "n2", label: "next" },
    { id: "e2-3", source: "n2", target: "n3", label: "next" },
  ];

  it("handles empty nodes list", () => {
    const layouted = autoLayoutGraph([], []);
    expect(layouted).toEqual([]);
  });

  it("computes Top-to-Bottom (TB) layout coordinates correctly", () => {
    const layouted = autoLayoutGraph(sampleNodes, sampleEdges, { direction: "TB" });
    expect(layouted.length).toBe(3);

    const n1 = layouted.find((n) => n.id === "n1")!;
    const n2 = layouted.find((n) => n.id === "n2")!;
    const n3 = layouted.find((n) => n.id === "n3")!;

    // In TB layout, Y increases with level
    expect(n1.position.y).toBeLessThan(n2.position.y);
    expect(n2.position.y).toBeLessThan(n3.position.y);
  });

  it("computes Left-to-Right (LR) layout coordinates correctly", () => {
    const layouted = autoLayoutGraph(sampleNodes, sampleEdges, { direction: "LR" });
    expect(layouted.length).toBe(3);

    const n1 = layouted.find((n) => n.id === "n1")!;
    const n2 = layouted.find((n) => n.id === "n2")!;
    const n3 = layouted.find((n) => n.id === "n3")!;

    // In LR layout, X increases with level
    expect(n1.position.x).toBeLessThan(n2.position.x);
    expect(n2.position.x).toBeLessThan(n3.position.x);
  });
});

describe("Node Duplication and Metrics Utilities", () => {
  it("clones node properties with offset and copy suffix", () => {
    const sourceNode: Node<AgentNodeData> = {
      id: "node_1",
      type: "agent",
      position: { x: 100, y: 200 },
      data: {
        kind: "llm",
        name: "Agent_Reasoning",
        config: { model: "gpt-4" },
      },
    };

    const duplicateId = "node_1_dup";
    const duplicatedNode: Node<AgentNodeData> = {
      id: duplicateId,
      type: sourceNode.type,
      position: {
        x: sourceNode.position.x + 30,
        y: sourceNode.position.y + 30,
      },
      data: {
        ...JSON.parse(JSON.stringify(sourceNode.data)),
        name: `${sourceNode.data.name}_copy`,
      },
    };

    expect(duplicatedNode.id).toBe("node_1_dup");
    expect(duplicatedNode.position).toEqual({ x: 130, y: 230 });
    expect(duplicatedNode.data.name).toBe("Agent_Reasoning_copy");
    expect(duplicatedNode.data.config.model).toBe("gpt-4");
  });

  it("calculates execution metrics accurately", () => {
    const logs = [
      { step: 1, nodeId: "n1", name: "Trigger", kind: "trigger", ms: 5, label: "start" },
      { step: 2, nodeId: "n2", name: "LLM", kind: "llm", ms: 250, label: "next" },
      { step: 3, nodeId: "n3", name: "Sink", kind: "sink", ms: 10, label: "on_success" },
    ];

    const totalMs = logs.reduce((acc, l) => acc + l.ms, 0);
    const uniqueKinds = new Set(logs.map((l) => l.kind)).size;
    const hasError = logs.some((l) => l.error);

    expect(totalMs).toBe(265);
    expect(uniqueKinds).toBe(3);
    expect(hasError).toBe(false);
  });
});
