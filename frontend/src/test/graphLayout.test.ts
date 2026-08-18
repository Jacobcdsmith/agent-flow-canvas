import { describe, expect, it } from "vitest";
import { autoLayoutGraph } from "../flow/graphLayout";
import type { Node, Edge } from "reactflow";
import type { AgentNodeData } from "../flow/types";

describe("autoLayoutGraph", () => {
  const sampleNodes: Node<AgentNodeData>[] = [
    {
      id: "n1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: { kind: "trigger", name: "start", config: {}, isEntry: true },
    },
    {
      id: "n2",
      type: "agent",
      position: { x: 0, y: 0 },
      data: { kind: "llm", name: "reason", config: {} },
    },
    {
      id: "n3",
      type: "agent",
      position: { x: 0, y: 0 },
      data: { kind: "sink", name: "end", config: {}, isTerminal: true },
    },
    {
      id: "note1",
      type: "note",
      position: { x: 0, y: 0 },
      data: { kind: "note", name: "note", config: { content: "Docs note" } },
    },
  ];

  const sampleEdges: Edge[] = [
    { id: "e1", source: "n1", target: "n2" },
    { id: "e2", source: "n2", target: "n3" },
  ];

  it("handles empty nodes list gracefully", () => {
    const result = autoLayoutGraph([], []);
    expect(result).toEqual([]);
  });

  it("calculates Top-to-Bottom (TB) positions sequentially by rank level", () => {
    const layouted = autoLayoutGraph(sampleNodes, sampleEdges, "TB");
    expect(layouted).toHaveLength(4);

    const n1 = layouted.find((n) => n.id === "n1")!;
    const n2 = layouted.find((n) => n.id === "n2")!;
    const n3 = layouted.find((n) => n.id === "n3")!;

    // In Top-to-Bottom, rank determines increasing Y coordinate
    expect(n1.position.y).toBeLessThan(n2.position.y);
    expect(n2.position.y).toBeLessThan(n3.position.y);
  });

  it("calculates Left-to-Right (LR) positions sequentially by rank level", () => {
    const layouted = autoLayoutGraph(sampleNodes, sampleEdges, "LR");
    expect(layouted).toHaveLength(4);

    const n1 = layouted.find((n) => n.id === "n1")!;
    const n2 = layouted.find((n) => n.id === "n2")!;
    const n3 = layouted.find((n) => n.id === "n3")!;

    // In Left-to-Right, rank determines increasing X coordinate
    expect(n1.position.x).toBeLessThan(n2.position.x);
    expect(n2.position.x).toBeLessThan(n3.position.x);
  });

  it("positions note nodes separately", () => {
    const layouted = autoLayoutGraph(sampleNodes, sampleEdges, "TB");
    const note1 = layouted.find((n) => n.id === "note1")!;
    expect(note1.position.x).toBe(50);
    expect(note1.position.y).toBeGreaterThanOrEqual(100);
  });
});
