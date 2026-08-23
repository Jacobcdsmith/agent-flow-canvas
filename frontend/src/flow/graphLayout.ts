import { Edge, Node } from "reactflow";
import { AgentNodeData } from "./types";

export type LayoutDirection = "TB" | "LR";

export interface LayoutOptions {
  direction?: LayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  levelSpacing?: number;
  nodeSpacing?: number;
  startX?: number;
  startY?: number;
}

/**
 * Automatically computes hierarchical graph layout coordinates for nodes
 * supporting Top-to-Bottom ("TB") and Left-to-Right ("LR") flow directions.
 */
export function autoLayoutGraph(
  nodes: Node<AgentNodeData>[],
  edges: Edge[],
  options: LayoutOptions = {},
): Node<AgentNodeData>[] {
  if (nodes.length === 0) return [];

  const direction = options.direction ?? "TB";
  const levelSpacing = options.levelSpacing ?? (direction === "TB" ? 180 : 320);
  const nodeSpacing = options.nodeSpacing ?? (direction === "TB" ? 280 : 140);
  const startX = options.startX ?? 100;
  const startY = options.startY ?? 100;

  // Build adjacency list and incoming degree map
  const inDegree = new Map<string, number>();
  const outEdgesMap = new Map<string, string[]>();

  nodes.forEach((n) => {
    inDegree.set(n.id, 0);
    outEdgesMap.set(n.id, []);
  });

  edges.forEach((e) => {
    if (inDegree.has(e.target)) {
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    }
    if (outEdgesMap.has(e.source)) {
      outEdgesMap.get(e.source)!.push(e.target);
    }
  });

  // Determine ranks / levels using BFS
  const ranks = new Map<string, number>();

  // Entry nodes (isEntry, trigger kind, or inDegree === 0)
  const entryNodes = nodes.filter(
    (n) => n.data.isEntry || n.data.kind === "trigger" || (inDegree.get(n.id) ?? 0) === 0,
  );

  const queue: { id: string; level: number }[] = [];

  if (entryNodes.length > 0) {
    entryNodes.forEach((n) => {
      ranks.set(n.id, 0);
      queue.push({ id: n.id, level: 0 });
    });
  } else {
    // Fallback: pick first node
    const first = nodes[0];
    ranks.set(first.id, 0);
    queue.push({ id: first.id, level: 0 });
  }

  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const targets = outEdgesMap.get(id) ?? [];
    targets.forEach((tgtId) => {
      const currentRank = ranks.get(tgtId) ?? 0;
      const nextRank = Math.max(currentRank, level + 1);
      ranks.set(tgtId, nextRank);
      queue.push({ id: tgtId, level: nextRank });
    });
  }

  // Assign level 0 to any remaining unvisited nodes
  nodes.forEach((n) => {
    if (!ranks.has(n.id)) {
      ranks.set(n.id, 0);
    }
  });

  // Group nodes by assigned level
  const levelsMap = new Map<number, Node<AgentNodeData>[]>();
  nodes.forEach((n) => {
    const lvl = ranks.get(n.id) ?? 0;
    if (!levelsMap.has(lvl)) {
      levelsMap.set(lvl, []);
    }
    levelsMap.get(lvl)!.push(n);
  });

  // Position nodes level by level
  const updatedNodes: Node<AgentNodeData>[] = [];

  levelsMap.forEach((levelNodes, lvl) => {
    const count = levelNodes.length;
    levelNodes.forEach((node, index) => {
      const offset = (index - (count - 1) / 2) * nodeSpacing;

      let x: number;
      let y: number;

      if (direction === "TB") {
        x = startX + 400 + offset;
        y = startY + lvl * levelSpacing;
      } else {
        x = startX + lvl * levelSpacing;
        y = startY + 250 + offset;
      }

      updatedNodes.push({
        ...node,
        position: { x: Math.round(x), y: Math.round(y) },
      });
    });
  });

  return updatedNodes;
}
