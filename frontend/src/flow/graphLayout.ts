import type { Edge, Node } from "reactflow";
import type { AgentNodeData } from "./types";

export type LayoutDirection = "TB" | "LR";

/**
 * Calculates a hierarchical topological layout for the given nodes and edges graph.
 *
 * @param nodes The array of ReactFlow nodes to arrange.
 * @param edges The array of ReactFlow edges connecting nodes.
 * @param direction Flow layout direction: "TB" (Top-to-Bottom) or "LR" (Left-to-Right).
 * @returns A new array of nodes with updated position coordinates.
 */
export function autoLayoutGraph(
  nodes: Node<AgentNodeData>[],
  edges: Edge[],
  direction: LayoutDirection = "TB"
): Node<AgentNodeData>[] {
  if (nodes.length === 0) return [];

  // Separate executable nodes from note nodes
  const agentNodes = nodes.filter((n) => n.data.kind !== "note");
  const noteNodes = nodes.filter((n) => n.data.kind === "note");

  if (agentNodes.length === 0) {
    return nodes;
  }

  // Build adjacency list and in-degree mapping
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  agentNodes.forEach((n) => {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  });

  edges.forEach((e) => {
    if (inDegree.has(e.target) && adjacency.has(e.source)) {
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
      adjacency.get(e.source)!.push(e.target);
    }
  });

  // Determine root/entry nodes (nodes with isEntry flag, trigger kind, or in-degree 0)
  const roots = agentNodes.filter(
    (n) => n.data.isEntry || n.data.kind === "trigger" || inDegree.get(n.id) === 0
  );

  const startIds = roots.length > 0 ? roots.map((n) => n.id) : [agentNodes[0].id];

  // Assign rank depth levels via BFS
  const ranks = new Map<string, number>();
  const queue: { id: string; rank: number }[] = startIds.map((id) => ({ id, rank: 0 }));

  startIds.forEach((id) => ranks.set(id, 0));

  while (queue.length > 0) {
    const { id, rank } = queue.shift()!;
    const neighbors = adjacency.get(id) ?? [];

    for (const neighborId of neighbors) {
      const currentRank = ranks.get(neighborId);
      const nextRank = rank + 1;
      if (currentRank === undefined || nextRank > currentRank) {
        ranks.set(neighborId, nextRank);
        queue.push({ id: neighborId, rank: nextRank });
      }
    }
  }

  // Ensure any disconnected agent nodes have a default rank level
  agentNodes.forEach((n) => {
    if (!ranks.has(n.id)) {
      ranks.set(n.id, 0);
    }
  });

  // Group node IDs by rank level
  const rankGroups = new Map<number, string[]>();
  ranks.forEach((rank, id) => {
    const group = rankGroups.get(rank) ?? [];
    group.push(id);
    rankGroups.set(rank, group);
  });

  // Layout spacing constants
  const isTB = direction === "TB";
  const layerSpacing = isTB ? 140 : 320; // Y distance for TB, X distance for LR
  const nodeSpacing = isTB ? 260 : 130;  // X distance for TB, Y distance for LR
  const startX = 200;
  const startY = 100;

  const newPositions = new Map<string, { x: number; y: number }>();

  // Compute positions for each rank group
  const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b);

  sortedRanks.forEach((rankLevel) => {
    const group = rankGroups.get(rankLevel)!;
    const groupCount = group.length;

    group.forEach((id, index) => {
      const offset = (index - (groupCount - 1) / 2) * nodeSpacing;

      if (isTB) {
        // Top-to-Bottom: Rank dictates Y; Index in group dictates X
        newPositions.set(id, {
          x: Math.round(startX + offset),
          y: Math.round(startY + rankLevel * layerSpacing),
        });
      } else {
        // Left-to-Right: Rank dictates X; Index in group dictates Y
        newPositions.set(id, {
          x: Math.round(startX + rankLevel * layerSpacing),
          y: Math.round(startY + offset),
        });
      }
    });
  });

  // Map updated positions onto node list (preserving note positions or offsetting notes slightly)
  return nodes.map((node) => {
    const newPos = newPositions.get(node.id);
    if (newPos) {
      return {
        ...node,
        position: newPos,
      };
    }
    return node;
  });
}
