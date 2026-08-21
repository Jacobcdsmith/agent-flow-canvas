import { Edge, Node } from "reactflow";
import { AgentNodeData } from "./types";

export type LayoutDirection = "TB" | "LR";

/**
 * Automatically calculates a clean hierarchical graph layout (Top-to-Bottom or Left-to-Right)
 * for the workflow nodes and edges, preserving node data and centering the layout.
 */
export function autoLayoutGraph(
  nodes: Node<AgentNodeData>[],
  edges: Edge[],
  direction: LayoutDirection = "TB",
  options: { rankSep?: number; nodeSep?: number } = {}
): Node<AgentNodeData>[] {
  if (nodes.length === 0) return [];

  const rankSep = options.rankSep ?? (direction === "TB" ? 140 : 260);
  const nodeSep = options.nodeSep ?? (direction === "TB" ? 240 : 140);

  // Calculate bounding box center of original nodes
  let origMinX = Infinity, origMaxX = -Infinity;
  let origMinY = Infinity, origMaxY = -Infinity;
  nodes.forEach((n) => {
    origMinX = Math.min(origMinX, n.position.x);
    origMaxX = Math.max(origMaxX, n.position.x);
    origMinY = Math.min(origMinY, n.position.y);
    origMaxY = Math.max(origMaxY, n.position.y);
  });
  const origCenterX = (origMinX + origMaxX) / 2;
  const origCenterY = (origMinY + origMaxY) / 2;

  // Build adjacency list & predecessor list
  const nodeMap = new Map<string, Node<AgentNodeData>>();
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();

  nodes.forEach((n) => {
    nodeMap.set(n.id, n);
    predecessors.set(n.id, []);
    successors.set(n.id, []);
  });

  edges.forEach((e) => {
    if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
      successors.get(e.source)?.push(e.target);
      predecessors.get(e.target)?.push(e.source);
    }
  });

  // Determine ranks for each node
  const ranks = new Map<string, number>();

  // Helper to compute topological rank with recursion + memo + cycle detection
  const computeRank = (nodeId: string, visitedPath: Set<string>): number => {
    if (ranks.has(nodeId)) return ranks.get(nodeId)!;
    if (visitedPath.has(nodeId)) return 0; // Handle cycle

    const preds = predecessors.get(nodeId) ?? [];
    if (preds.length === 0) {
      ranks.set(nodeId, 0);
      return 0;
    }

    visitedPath.add(nodeId);
    let maxPredRank = 0;
    preds.forEach((predId) => {
      const predRank = computeRank(predId, new Set(visitedPath));
      maxPredRank = Math.max(maxPredRank, predRank);
    });

    const rank = maxPredRank + 1;
    ranks.set(nodeId, rank);
    return rank;
  };

  // Explicit entry nodes or nodes with 0 predecessors start at rank 0
  nodes.forEach((n) => {
    if (n.data.isEntry || (predecessors.get(n.id)?.length ?? 0) === 0) {
      computeRank(n.id, new Set());
    }
  });

  // Calculate rank for all remaining nodes
  nodes.forEach((n) => {
    computeRank(n.id, new Set());
  });

  // Group nodes by rank
  const rankGroups = new Map<number, Node<AgentNodeData>[]>();
  nodes.forEach((n) => {
    const r = ranks.get(n.id) ?? 0;
    if (!rankGroups.has(r)) rankGroups.set(r, []);
    rankGroups.get(r)!.push(n);
  });

  // Compute new positions
  const rawPositions = new Map<string, { x: number; y: number }>();
  let layoutMinX = Infinity, layoutMaxX = -Infinity;
  let layoutMinY = Infinity, layoutMaxY = -Infinity;

  const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b);

  sortedRanks.forEach((r) => {
    const group = rankGroups.get(r)!;
    const count = group.length;

    group.forEach((node, idx) => {
      const offset = (idx - (count - 1) / 2) * nodeSep;
      let posX = 0;
      let posY = 0;

      if (direction === "TB") {
        posX = offset;
        posY = r * rankSep;
      } else {
        posX = r * rankSep;
        posY = offset;
      }

      rawPositions.set(node.id, { x: posX, y: posY });
      layoutMinX = Math.min(layoutMinX, posX);
      layoutMaxX = Math.max(layoutMaxX, posX);
      layoutMinY = Math.min(layoutMinY, posY);
      layoutMaxY = Math.max(layoutMaxY, posY);
    });
  });

  const layoutCenterX = (layoutMinX + layoutMaxX) / 2;
  const layoutCenterY = (layoutMinY + layoutMaxY) / 2;

  // Offset positions so new layout center matches original graph center
  const shiftX = origCenterX - layoutCenterX;
  const shiftY = origCenterY - layoutCenterY;

  return nodes.map((n) => {
    const raw = rawPositions.get(n.id) ?? { x: n.position.x, y: n.position.y };
    return {
      ...n,
      position: {
        x: Math.round(raw.x + shiftX),
        y: Math.round(raw.y + shiftY),
      },
    };
  });
}
