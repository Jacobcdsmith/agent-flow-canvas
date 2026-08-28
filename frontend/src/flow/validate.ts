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
 * Automatically resolves missing trigger/entry issue by marking the first candidate node
 * as entry, or prepending a new Trigger node if no existing node is suitable.
 */
export function fixNoTrigger(nodes: Node<AgentNodeData>[]): Node<AgentNodeData>[] {
  const candidate = nodes.find((n) => n.data.kind !== "note");
  if (candidate) {
    return nodes.map((n) =>
      n.id === candidate.id ? { ...n, data: { ...n.data, isEntry: true } } : n
    );
  }

  // Prepend a new Trigger node
  const newTrigger: Node<AgentNodeData> = {
    id: `n_trig_${Date.now()}`,
    type: "agent",
    position: { x: 100, y: 150 },
    data: {
      kind: "trigger",
      name: "on_request",
      config: { source: "webhook", schema: "{ query: str }" },
      isEntry: true,
    },
  };
  return [newTrigger, ...nodes];
}

/**
 * Automatically creates missing router branches (true/false) by connecting to
 * suitable target nodes or generating a new Sink node.
 */
export function fixRouterBranches(
  nodes: Node<AgentNodeData>[],
  edges: Edge[],
  routerNodeId: string
): { nodes: Node<AgentNodeData>[]; edges: Edge[] } {
  const routerNode = nodes.find((n) => n.id === routerNodeId);
  if (!routerNode) return { nodes, edges };

  const existingOut = edges.filter((e) => e.source === routerNodeId);
  const existingLabels = new Set(existingOut.map((e) => String(e.label)));

  const missingLabels: ("true" | "false")[] = [];
  if (!existingLabels.has("true")) missingLabels.push("true");
  if (!existingLabels.has("false")) missingLabels.push("false");

  if (missingLabels.length === 0) return { nodes, edges };

  let updatedNodes = [...nodes];
  let updatedEdges = [...edges];

  missingLabels.forEach((label, idx) => {
    // Look for existing unattached candidate target node
    const candidateTarget = updatedNodes.find(
      (n) =>
        n.id !== routerNodeId &&
        n.data.kind !== "note" &&
        n.data.kind !== "trigger" &&
        !updatedEdges.some((e) => e.target === n.id)
    );

    let targetId = candidateTarget?.id;

    if (!targetId) {
      // Generate a new sink node for this branch
      const newSinkId = `n_sink_${label}_${Date.now()}_${idx}`;
      const newSinkNode: Node<AgentNodeData> = {
        id: newSinkId,
        type: "agent",
        position: {
          x: routerNode.position.x + 280,
          y: routerNode.position.y + (label === "true" ? -60 : 80),
        },
        data: {
          kind: "sink",
          name: `return_${label}`,
          config: { target: "response" },
          isTerminal: true,
        },
      };
      updatedNodes.push(newSinkNode);
      targetId = newSinkId;
    }

    updatedEdges.push({
      id: `e_${routerNodeId}_${targetId}_${label}`,
      source: routerNodeId,
      target: targetId,
      label,
      type: "smoothstep",
    });
  });

  return { nodes: updatedNodes, edges: updatedEdges };
}

/**
 * Automatically resolves orphan nodes by connecting orphan non-entry nodes to
 * the preceding node or removing completely disconnected empty non-essential nodes.
 */
export function fixOrphanNodes(
  nodes: Node<AgentNodeData>[],
  edges: Edge[]
): { nodes: Node<AgentNodeData>[]; edges: Edge[] } {
  const incoming = new Set(edges.map((e) => e.target));
  const outgoing = new Set(edges.map((e) => e.source));

  let updatedNodes = [...nodes];
  let updatedEdges = [...edges];

  // Find non-note, non-entry nodes that have no incoming edges
  const orphanNodes = updatedNodes.filter(
    (n) =>
      n.data.kind !== "note" &&
      !n.data.isEntry &&
      n.data.kind !== "trigger" &&
      !incoming.has(n.id)
  );

  // Find potential source nodes to connect from
  const potentialSources = updatedNodes.filter(
    (n) =>
      n.data.kind !== "note" &&
      !n.data.isTerminal &&
      n.data.kind !== "sink"
  );

  orphanNodes.forEach((orphan) => {
    // Pick first available potential source node that isn't the orphan itself
    const source = potentialSources.find((s) => s.id !== orphan.id);
    if (source) {
      updatedEdges.push({
        id: `e_${source.id}_${orphan.id}_auto`,
        source: source.id,
        target: orphan.id,
        label: "next",
        type: "smoothstep",
      });
    }
  });

  return { nodes: updatedNodes, edges: updatedEdges };
}
