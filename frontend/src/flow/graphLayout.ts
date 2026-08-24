import { Edge, Node } from "reactflow";
import { AgentNodeData } from "./types";

export interface LayoutOptions {
  direction?: "TB" | "LR";
  nodeWidth?: number;
  nodeHeight?: number;
  spacingX?: number;
  spacingY?: number;
  startX?: number;
  startY?: number;
}

/**
 * Calculates hierarchical rank-based positions for canvas nodes in DAG/flow graphs.
 * Supports Top-to-Bottom (TB) and Left-to-Right (LR) layout directions.
 */
export function autoLayoutGraph(
  nodes: Node<AgentNodeData>[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node<AgentNodeData>[] {
  if (nodes.length === 0) return [];

  const {
    direction = "TB",
    nodeWidth = 240,
    nodeHeight = 120,
    spacingX = 60,
    spacingY = 80,
    startX = 200,
    startY = 100,
  } = options;

  const nodeMap = new Map<string, Node<AgentNodeData>>();
  const inDegree = new Map<string, number>();
  const outEdges = new Map<string, string[]>();

  nodes.forEach((n) => {
    nodeMap.set(n.id, n);
    inDegree.set(n.id, 0);
    outEdges.set(n.id, []);
  });

  // Build edge relationships (only for valid node IDs)
  edges.forEach((e) => {
    if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
      outEdges.get(e.source)!.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  });

  // Calculate ranks using topological BFS/Kahn's longest path strategy
  const rankMap = new Map<string, number>();
  const queue: string[] = [];

  // Nodes with 0 in-degree start at rank 0
  nodes.forEach((n) => {
    if ((inDegree.get(n.id) || 0) === 0) {
      rankMap.set(n.id, 0);
      queue.push(n.id);
    }
  });

  // Fallback if all nodes are in a cycle or no 0 in-degree nodes exist
  if (queue.length === 0 && nodes.length > 0) {
    rankMap.set(nodes[0].id, 0);
    queue.push(nodes[0].id);
  }

  const visited = new Set<string>();

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (visited.has(currId)) continue;
    visited.add(currId);

    const currRank = rankMap.get(currId) || 0;
    const neighbors = outEdges.get(currId) || [];

    neighbors.forEach((targetId) => {
      const nextRank = Math.max(rankMap.get(targetId) || 0, currRank + 1);
      rankMap.set(targetId, nextRank);
      if (!visited.has(targetId)) {
        queue.push(targetId);
      }
    });
  }

  // Handle any orphan or unvisited nodes from disconnected subgraphs
  nodes.forEach((n) => {
    if (!rankMap.has(n.id)) {
      rankMap.set(n.id, 0);
    }
  });

  // Group node IDs by rank
  const rankGroups = new Map<number, string[]>();
  nodes.forEach((n) => {
    const r = rankMap.get(n.id) || 0;
    if (!rankGroups.has(r)) rankGroups.set(r, []);
    rankGroups.get(r)!.push(n.id);
  });

  const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b);

  const newPositions = new Map<string, { x: number; y: number }>();

  sortedRanks.forEach((rank) => {
    const nodeIdsInRank = rankGroups.get(rank)!;
    const count = nodeIdsInRank.length;

    nodeIdsInRank.forEach((id, index) => {
      let x = 0;
      let y = 0;

      if (direction === "TB") {
        const totalWidth = count * nodeWidth + (count - 1) * spacingX;
        const offset = (index - (count - 1) / 2) * (nodeWidth + spacingX);
        x = startX + offset;
        y = startY + rank * (nodeHeight + spacingY);
      } else {
        // Left-to-Right (LR)
        const totalHeight = count * nodeHeight + (count - 1) * spacingY;
        const offset = (index - (count - 1) / 2) * (nodeHeight + spacingY);
        x = startX + rank * (nodeWidth + spacingX);
        y = startY + offset;
      }

      newPositions.set(id, { x: Math.round(x), y: Math.round(y) });
    });
  });

  return nodes.map((n) => {
    const pos = newPositions.get(n.id);
    if (!pos) return n;
    return {
      ...n,
      position: pos,
    };
  });
}
