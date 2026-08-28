import { describe, it, expect } from "vitest";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";
import {
  validateGraph,
  fixNoTrigger,
  fixRouterBranches,
  fixOrphanNodes,
} from "../flow/validate";

describe("Graph Validation Quick-Fix Engine", () => {
  it("fixNoTrigger adds isEntry to candidate node or prepends a trigger node", () => {
    const nodesWithoutTrigger: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "llm", name: "reason", config: {} },
      },
    ];

    expect(validateGraph(nodesWithoutTrigger, [])).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "no-trigger" })])
    );

    const fixed = fixNoTrigger(nodesWithoutTrigger);
    expect(fixed[0].data.isEntry).toBe(true);
    expect(validateGraph(fixed, [])).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "no-trigger" })])
    );
  });

  it("fixRouterBranches automatically creates true/false branch edges for routers", () => {
    const routerNode: Node<AgentNodeData> = {
      id: "r1",
      type: "agent",
      position: { x: 100, y: 100 },
      data: { kind: "router", name: "decide", config: { predicate: "state.ok" } },
    };
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "trig",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "trig", config: {}, isEntry: true },
      },
      routerNode,
    ];
    const edges: Edge[] = [
      { id: "e1", source: "trig", target: "r1", label: "next" },
    ];

    const issuesBefore = validateGraph(nodes, edges);
    expect(issuesBefore).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "router-missing-branch", nodeId: "r1" }),
      ])
    );

    const fixed = fixRouterBranches(nodes, edges, "r1");
    const issuesAfter = validateGraph(fixed.nodes, fixed.edges);

    expect(
      issuesAfter.some((i) => i.kind === "router-missing-branch")
    ).toBe(false);
  });

  it("fixOrphanNodes connects isolated nodes into the execution flow", () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "t1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "start", config: {}, isEntry: true },
      },
      {
        id: "orphan1",
        type: "agent",
        position: { x: 200, y: 0 },
        data: { kind: "tool", name: "search", config: {} },
      },
    ];
    const edges: Edge[] = [];

    const issuesBefore = validateGraph(nodes, edges);
    expect(issuesBefore).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "orphan", nodeId: "orphan1" }),
      ])
    );

    const fixed = fixOrphanNodes(nodes, edges);
    const issuesAfter = validateGraph(fixed.nodes, fixed.edges);

    expect(
      issuesAfter.some((i) => i.nodeId === "orphan1" && i.message.includes("no incoming edge"))
    ).toBe(false);
  });
});
