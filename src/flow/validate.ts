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
