import { Edge, Node } from "reactflow";
import { AgentNodeData } from "./types";

export type LayoutDirection = "TB" | "LR";

/**
 * Calculates hierarchical rank positions for workflow graph nodes
 * supporting Top-to-Bottom (TB) and Left-to-Right (LR) auto-layout directions.
 *
 * @param nodes List of ReactFlow nodes to arrange.
 * @param edges List of ReactFlow edges connecting nodes.
 * @param direction "TB" for vertical flow or "LR" for horizontal flow.
 * @returns Array of new Node objects with recalculated {x, y} positions.
 */
export function autoLayoutGraph(
  nodes: Node<AgentNodeData>[],
  edges: Edge[],
  direction: LayoutDirection = "TB"
): Node<AgentNodeData>[] {
  if (nodes.length === 0) return [];

  // Exclude non-executable notes or place them separately
  const executableNodes = nodes.filter((n) => n.data?.kind !== "note");
  const noteNodes = nodes.filter((n) => n.data?.kind === "note");

  const inDegree = new Map<string, number>();
  const outEdgesMap = new Map<string, string[]>();

  executableNodes.forEach((n) => {
    inDegree.set(n.id, 0);
    outEdgesMap.set(n.id, []);
  });

  edges.forEach((e) => {
    if (inDegree.has(e.target) && inDegree.has(e.source)) {
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
      const outs = outEdgesMap.get(e.source) || [];
      outs.push(e.target);
      outEdgesMap.set(e.source, outs);
    }
  });

  // Assign ranks using BFS / topological levels
  const ranks = new Map<string, number>();
  const queue: { id: string; rank: number }[] = [];

  // Entry nodes or 0 in-degree nodes get rank 0
  executableNodes.forEach((n) => {
    if (n.data?.isEntry || (inDegree.get(n.id) || 0) === 0) {
      queue.push({ id: n.id, rank: 0 });
      ranks.set(n.id, 0);
    }
  });

  // Fallback if graph is purely cyclic with no entry/0-indegree node
  if (queue.length === 0 && executableNodes.length > 0) {
    queue.push({ id: executableNodes[0].id, rank: 0 });
    ranks.set(executableNodes[0].id, 0);
  }

  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, rank } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const targets = outEdgesMap.get(id) || [];
    targets.forEach((targetId) => {
      const nextRank = Math.max(ranks.get(targetId) ?? 0, rank + 1);
      ranks.set(targetId, nextRank);
      queue.push({ id: targetId, rank: nextRank });
    });
  }

  // Any unassigned executable nodes get placed at rank 0
  executableNodes.forEach((n) => {
    if (!ranks.has(n.id)) {
      ranks.set(n.id, 0);
    }
  });

  // Group nodes by rank
  const rankGroups = new Map<number, Node<AgentNodeData>[]>();
  executableNodes.forEach((n) => {
    const r = ranks.get(n.id) || 0;
    const group = rankGroups.get(r) || [];
    group.push(n);
    rankGroups.set(r, group);
  });

  const X_SPACING = direction === "TB" ? 280 : 320;
  const Y_SPACING = direction === "TB" ? 160 : 140;

  const newPositionMap = new Map<string, { x: number; y: number }>();

  // Assign positions per rank group
  const maxRank = Math.max(0, ...Array.from(rankGroups.keys()));

  for (let r = 0; r <= maxRank; r++) {
    const group = rankGroups.get(r) || [];
    const count = group.length;

    group.forEach((node, index) => {
      const offset = (index - (count - 1) / 2);

      if (direction === "TB") {
        const x = 300 + offset * X_SPACING;
        const y = 100 + r * Y_SPACING;
        newPositionMap.set(node.id, { x, y });
      } else {
        const x = 100 + r * X_SPACING;
        const y = 200 + offset * Y_SPACING;
        newPositionMap.set(node.id, { x, y });
      }
    });
  }

  // Position notes to the side
  let noteOffsetY = 100;
  noteNodes.forEach((n) => {
    newPositionMap.set(n.id, { x: 50, y: noteOffsetY });
    noteOffsetY += 160;
  });

  return nodes.map((n) => ({
    ...n,
    position: newPositionMap.get(n.id) || n.position,
  }));
}
