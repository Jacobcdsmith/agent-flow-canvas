import type { Node, Edge } from "reactflow";
import type { AgentNodeData } from "./types";

export type LayoutDirection = "TB" | "LR";

/**
 * Computes an automatic hierarchical layout for workflow nodes.
 * Supports Top-to-Bottom (TB) and Left-to-Right (LR) flow directions.
 *
 * @param nodes Array of ReactFlow nodes to layout.
 * @param edges Array of ReactFlow edges defining node connections.
 * @param direction "TB" (Top-to-Bottom) or "LR" (Left-to-Right).
 * @returns A new array of nodes with updated position coordinates.
 */
export function autoLayoutGraph(
  nodes: Node<AgentNodeData>[],
  edges: Edge[],
  direction: LayoutDirection = "TB"
): Node<AgentNodeData>[] {
  if (nodes.length === 0) return [];

  const nodeMap = new Map<string, Node<AgentNodeData>>(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const outEdges = new Map<string, string[]>();

  nodes.forEach((n) => {
    inDegree.set(n.id, 0);
    outEdges.set(n.id, []);
  });

  edges.forEach((e) => {
    if (e.source !== e.target && nodeMap.has(e.source) && nodeMap.has(e.target)) {
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
      const list = outEdges.get(e.source) || [];
      list.push(e.target);
      outEdges.set(e.source, list);
    }
  });

  // Calculate ranks
  const ranks = new Map<string, number>();

  // Entry nodes (inDegree === 0 or marked as entry) get rank 0
  const queue: string[] = [];
  nodes.forEach((n) => {
    if ((inDegree.get(n.id) || 0) === 0 || n.data?.isEntry || n.data?.kind === "trigger") {
      ranks.set(n.id, 0);
      queue.push(n.id);
    }
  });

  // Fallback if graph is completely cyclic or has no explicit entry points
  if (queue.length === 0) {
    nodes.forEach((n) => {
      ranks.set(n.id, 0);
      queue.push(n.id);
    });
  }

  // Topological / BFS rank propagation with iteration cap to prevent infinite loops on cycles
  let maxPasses = nodes.length * 2;
  while (queue.length > 0 && maxPasses > 0) {
    maxPasses--;
    const currId = queue.shift()!;
    const currRank = ranks.get(currId) || 0;

    const targets = outEdges.get(currId) || [];
    targets.forEach((targetId) => {
      const existingRank = ranks.get(targetId);
      const nextRank = currRank + 1;
      if (existingRank === undefined || nextRank > existingRank) {
        ranks.set(targetId, nextRank);
        queue.push(targetId);
      }
    });
  }

  // Ensure every node has a rank
  nodes.forEach((n) => {
    if (!ranks.has(n.id)) {
      ranks.set(n.id, 0);
    }
  });

  // Group nodes by rank
  const rankGroups = new Map<number, Node<AgentNodeData>[]>();
  nodes.forEach((n) => {
    const r = ranks.get(n.id) || 0;
    const group = rankGroups.get(r) || [];
    group.push(n);
    rankGroups.set(r, group);
  });

  const isTB = direction === "TB";
  // Dimension constants for layout calculation
  const colSpacing = isTB ? 260 : 300;
  const rowSpacing = isTB ? 160 : 150;

  const updatedNodes: Node<AgentNodeData>[] = [];

  rankGroups.forEach((group, rank) => {
    const count = group.length;
    // Offset to center smaller ranks relative to maxBreadth
    const groupWidth = count * colSpacing;

    group.forEach((node, index) => {
      let x = 0;
      let y = 0;

      if (isTB) {
        // Top-to-Bottom: ranks are vertical Y levels, nodes in rank are spaced along X
        x = index * colSpacing - groupWidth / 2 + colSpacing / 2 + 400;
        y = rank * rowSpacing + 80;
      } else {
        // Left-to-Right: ranks are horizontal X levels, nodes in rank are spaced along Y
        x = rank * colSpacing + 80;
        y = index * rowSpacing - (count * rowSpacing) / 2 + rowSpacing / 2 + 300;
      }

      updatedNodes.push({
        ...node,
        position: {
          x: Math.round(x),
          y: Math.round(y),
        },
      });
    });
  });

  return updatedNodes;
}
