import { describe, it, expect } from "vitest";
import { autoLayoutGraph } from "../flow/graphLayout";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";

describe("autoLayoutGraph", () => {
  const sampleNodes: Node<AgentNodeData>[] = [
    {
      id: "n1",
      type: "agent",
      position: { x: 100, y: 100 },
      data: { kind: "trigger", name: "trigger", config: {}, isEntry: true },
    },
    {
      id: "n2",
      type: "agent",
      position: { x: 100, y: 300 },
      data: { kind: "llm", name: "reason", config: {} },
    },
    {
      id: "n3",
      type: "agent",
      position: { x: 100, y: 500 },
      data: { kind: "sink", name: "output", config: {}, isTerminal: true },
    },
  ];

  const sampleEdges: Edge[] = [
    { id: "e1-2", source: "n1", target: "n2", label: "next" },
    { id: "e2-3", source: "n2", target: "n3", label: "next" },
  ];

  it("handles empty nodes array gracefully", () => {
    const result = autoLayoutGraph([], []);
    expect(result).toEqual([]);
  });

  it("calculates distinct ranks and positions in Top-to-Bottom (TB) direction", () => {
    const laidOut = autoLayoutGraph(sampleNodes, sampleEdges, "TB");
    expect(laidOut.length).toBe(3);

    const n1 = laidOut.find((n) => n.id === "n1")!;
    const n2 = laidOut.find((n) => n.id === "n2")!;
    const n3 = laidOut.find((n) => n.id === "n3")!;

    expect(n2.position.y).toBeGreaterThan(n1.position.y);
    expect(n3.position.y).toBeGreaterThan(n2.position.y);
    expect(n1.data.name).toBe("trigger");
    expect(n3.data.isTerminal).toBe(true);
  });

  it("calculates distinct ranks and positions in Left-to-Right (LR) direction", () => {
    const laidOut = autoLayoutGraph(sampleNodes, sampleEdges, "LR");
    expect(laidOut.length).toBe(3);

    const n1 = laidOut.find((n) => n.id === "n1")!;
    const n2 = laidOut.find((n) => n.id === "n2")!;
    const n3 = laidOut.find((n) => n.id === "n3")!;

    expect(n2.position.x).toBeGreaterThan(n1.position.x);
    expect(n3.position.x).toBeGreaterThan(n2.position.x);
  });
});
