import { describe, it, expect } from "vitest";
import { autoLayoutGraph } from "../flow/graphLayout";
import type { Node, Edge } from "reactflow";
import type { AgentNodeData } from "../flow/types";

describe("autoLayoutGraph", () => {
  const sampleNodes: Node<AgentNodeData>[] = [
    {
      id: "n1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: { kind: "trigger", name: "Trigger Node", config: {}, isEntry: true },
    },
    {
      id: "n2",
      type: "agent",
      position: { x: 0, y: 0 },
      data: { kind: "llm", name: "LLM Node", config: {} },
    },
    {
      id: "n3",
      type: "agent",
      position: { x: 0, y: 0 },
      data: { kind: "sink", name: "Sink Node", config: {}, isTerminal: true },
    },
  ];

  const sampleEdges: Edge[] = [
    { id: "e1-2", source: "n1", target: "n2" },
    { id: "e2-3", source: "n2", target: "n3" },
  ];

  it("arranges nodes hierarchically in Top-to-Bottom (TB) direction", () => {
    const relaid = autoLayoutGraph(sampleNodes, sampleEdges, "TB");

    expect(relaid).toHaveLength(3);

    const n1 = relaid.find((n) => n.id === "n1")!;
    const n2 = relaid.find((n) => n.id === "n2")!;
    const n3 = relaid.find((n) => n.id === "n3")!;

    // In TB mode, Y coordinate increases with rank level
    expect(n1.position.y).toBeLessThan(n2.position.y);
    expect(n2.position.y).toBeLessThan(n3.position.y);

    // Node data and properties should be preserved
    expect(n1.data.kind).toBe("trigger");
    expect(n3.data.isTerminal).toBe(true);
  });

  it("arranges nodes hierarchically in Left-to-Right (LR) direction", () => {
    const relaid = autoLayoutGraph(sampleNodes, sampleEdges, "LR");

    expect(relaid).toHaveLength(3);

    const n1 = relaid.find((n) => n.id === "n1")!;
    const n2 = relaid.find((n) => n.id === "n2")!;
    const n3 = relaid.find((n) => n.id === "n3")!;

    // In LR mode, X coordinate increases with rank level
    expect(n1.position.x).toBeLessThan(n2.position.x);
    expect(n2.position.x).toBeLessThan(n3.position.x);
  });

  it("handles disconnected nodes and multiple components gracefully", () => {
    const disconnectedNodes: Node<AgentNodeData>[] = [
      ...sampleNodes,
      {
        id: "orphan",
        type: "note",
        position: { x: 10, y: 10 },
        data: { kind: "note", name: "Sticky Note", config: { content: "Doc" } },
      },
    ];

    const relaid = autoLayoutGraph(disconnectedNodes, sampleEdges, "TB");
    expect(relaid).toHaveLength(4);

    const orphan = relaid.find((n) => n.id === "orphan");
    expect(orphan).toBeDefined();
    expect(orphan?.position).toBeDefined();
  });

  it("handles cyclic graph structures without infinite loop", () => {
    const cyclicEdges: Edge[] = [
      { id: "e1-2", source: "n1", target: "n2" },
      { id: "e2-3", source: "n2", target: "n3" },
      { id: "e3-1", source: "n3", target: "n1" }, // cycle back
    ];

    const relaid = autoLayoutGraph(sampleNodes, cyclicEdges, "TB");
    expect(relaid).toHaveLength(3);
    relaid.forEach((n) => {
      expect(typeof n.position.x).toBe("number");
      expect(typeof n.position.y).toBe("number");
    });
  });
});
