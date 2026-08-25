import { Edge, Node } from "reactflow";
import { AgentNodeData } from "./types";

export interface ValidationIssue {
  nodeId?: string;
  kind: "no-trigger" | "orphan" | "router-missing-branch";
  message: string;
}

export function validateGraph(
  nodes: Node<AgentNodeData>[],
  edges: Edge[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const hasTrigger = nodes.some(
    (n) => n.data.kind === "trigger" || n.data.isEntry,
  );
  if (!hasTrigger) {
    issues.push({ kind: "no-trigger", message: "No Trigger / entry node defined" });
  }

  const incoming = new Map<string, number>();
  const outgoingByLabel = new Map<string, Set<string>>();
  edges.forEach((e) => {
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
    if (!outgoingByLabel.has(e.source)) outgoingByLabel.set(e.source, new Set());
    outgoingByLabel.get(e.source)!.add(String(e.label ?? "next"));
  });

  for (const n of nodes) {
    if (n.data.kind === "note") continue;
    const isEntry = n.data.isEntry || n.data.kind === "trigger";
    const isTerminal = n.data.isTerminal || n.data.kind === "sink";
    const inc = incoming.get(n.id) ?? 0;
    const out = outgoingByLabel.get(n.id)?.size ?? 0;
    if (!isEntry && inc === 0 && !isTerminal) {
      issues.push({ nodeId: n.id, kind: "orphan", message: `Orphan: "${n.data.name}" has no incoming edge` });
    }
    if (!isTerminal && out === 0 && !isEntry) {
      issues.push({ nodeId: n.id, kind: "orphan", message: `Dead-end: "${n.data.name}" has no outgoing edge` });
    }
    if (n.data.kind === "router") {
      const labels = outgoingByLabel.get(n.id) ?? new Set();
      if (!labels.has("true") || !labels.has("false")) {
        issues.push({
          nodeId: n.id,
          kind: "router-missing-branch",
          message: `Router "${n.data.name}" is missing ${!labels.has("true") ? "true" : ""}${!labels.has("true") && !labels.has("false") ? " & " : ""}${!labels.has("false") ? "false" : ""} branch`,
        });
      }
    }
  }
  return issues;
}

/**
 * Quick-Fix Helper: Automatically inserts a default Trigger node if missing,
 * and connects it to the first non-trigger node in the canvas.
 */
export function fixNoTrigger(
  nodes: Node<AgentNodeData>[],
  edges: Edge[],
): { nodes: Node<AgentNodeData>[]; edges: Edge[] } {
  const triggerId = `n_trig_${Date.now().toString(36)}`;
  const triggerNode: Node<AgentNodeData> = {
    id: triggerId,
    type: "agent",
    position: { x: 80, y: 100 },
    data: {
      kind: "trigger",
      name: "on_request",
      config: { source: "manual", schema: "{ query: str }" },
      isEntry: true,
    },
  };

  const newNodes = [triggerNode, ...nodes];
  const newEdges = [...edges];

  // If there are existing nodes, connect trigger to the first non-trigger node
  const targetNode = nodes.find((n) => n.data.kind !== "note" && n.data.kind !== "trigger");
  if (targetNode) {
    newEdges.push({
      id: `e_${triggerId}_${targetNode.id}`,
      source: triggerId,
      target: targetNode.id,
      label: "next",
      type: "smoothstep",
    });
  }

  return { nodes: newNodes, edges: newEdges };
}

/**
 * Quick-Fix Helper: Automatically connects missing true/false branches for a Router node
 * to an existing terminal/sink node or creates a default output sink node.
 */
export function fixRouterBranches(
  routerNodeId: string,
  nodes: Node<AgentNodeData>[],
  edges: Edge[],
): { nodes: Node<AgentNodeData>[]; edges: Edge[] } {
  const routerNode = nodes.find((n) => n.id === routerNodeId);
  if (!routerNode || routerNode.data.kind !== "router") {
    return { nodes, edges };
  }

  const existingLabels = new Set(
    edges.filter((e) => e.source === routerNodeId).map((e) => String(e.label ?? "next"))
  );

  const missingLabels: ("true" | "false")[] = [];
  if (!existingLabels.has("true")) missingLabels.push("true");
  if (!existingLabels.has("false")) missingLabels.push("false");

  if (missingLabels.length === 0) return { nodes, edges };

  let currentNodes = [...nodes];
  const newEdges = [...edges];

  // Find or create a target sink node
  let sinkNode = currentNodes.find((n) => n.data.kind === "sink");
  if (!sinkNode) {
    const sinkId = `n_sink_${Date.now().toString(36)}`;
    sinkNode = {
      id: sinkId,
      type: "agent",
      position: { x: routerNode.position.x + 250, y: routerNode.position.y + 100 },
      data: {
        kind: "sink",
        name: "return_result",
        config: { target: "response" },
        isTerminal: true,
      },
    };
    currentNodes.push(sinkNode);
  }

  missingLabels.forEach((label) => {
    newEdges.push({
      id: `e_${routerNodeId}_${sinkNode!.id}_${label}_${Math.random().toString(36).substring(2, 6)}`,
      source: routerNodeId,
      target: sinkNode!.id,
      label,
      type: "smoothstep",
    });
  });

  return { nodes: currentNodes, edges: newEdges };
}
