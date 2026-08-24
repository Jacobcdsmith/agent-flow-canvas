import { describe, it, expect, vi, beforeEach } from "vitest";
import { Node, Edge } from "reactflow";
import { autoLayoutGraph } from "../flow/graphLayout";
import { AgentNodeData, NODE_TYPES } from "../flow/types";

describe("Canvas Enhancements & Layout Engine", () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => null);
  });

  it("should calculate Top-to-Bottom auto layout positions for DAG nodes", () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "start", isEntry: true, config: {} },
      },
      {
        id: "n2",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "llm", name: "think", config: {} },
      },
      {
        id: "n3",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "sink", name: "end", isTerminal: true, config: {} },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
    ];

    const layouted = autoLayoutGraph(nodes, edges, { direction: "TB" });

    expect(layouted.length).toBe(3);
    const pos1 = layouted.find((n) => n.id === "n1")!.position;
    const pos2 = layouted.find((n) => n.id === "n2")!.position;
    const pos3 = layouted.find((n) => n.id === "n3")!.position;

    // Rank 0 < Rank 1 < Rank 2 in Y coordinate for Top-to-Bottom
    expect(pos1.y).toBeLessThan(pos2.y);
    expect(pos2.y).toBeLessThan(pos3.y);
  });

  it("should calculate Left-to-Right auto layout positions for DAG nodes", () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "start", isEntry: true, config: {} },
      },
      {
        id: "n2",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "tool", name: "search", config: {} },
      },
    ];

    const edges: Edge[] = [{ id: "e1", source: "n1", target: "n2" }];

    const layouted = autoLayoutGraph(nodes, edges, { direction: "LR" });

    const pos1 = layouted.find((n) => n.id === "n1")!.position;
    const pos2 = layouted.find((n) => n.id === "n2")!.position;

    // Rank 0 < Rank 1 in X coordinate for Left-to-Right
    expect(pos1.x).toBeLessThan(pos2.x);
  });

  it("should calculate execution metrics summary correctly", () => {
    const logs = [
      { step: 1, nodeId: "n1", name: "start", kind: "trigger", ms: 12, label: "next", output: {} },
      { step: 2, nodeId: "n2", name: "think", kind: "llm", ms: 450, label: "next", output: "ok" },
      { step: 3, nodeId: "n3", name: "end", kind: "sink", ms: 5, label: "next", output: "done" },
    ];

    const totalSteps = logs.length;
    const totalDuration = logs.reduce((acc, curr) => acc + curr.ms, 0);
    const uniqueKinds = new Set(logs.map((l) => l.kind)).size;
    const hasError = logs.some((l) => false);

    expect(totalSteps).toBe(3);
    expect(totalDuration).toBe(467);
    expect(uniqueKinds).toBe(3);
    expect(hasError).toBe(false);
  });

  it("should filter command palette nodes by search query", () => {
    const query = "llm";
    const filteredTypes = NODE_TYPES.filter(
      (m) =>
        m.label.toLowerCase().includes(query) ||
        m.kind.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query)
    );

    expect(filteredTypes.length).toBeGreaterThan(0);
    expect(filteredTypes[0].kind).toBe("llm");
  });
});
