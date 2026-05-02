import { Edge, Node } from "reactflow";
import { AgentNodeData } from "./types";

export function generatePseudocode(nodes: Node<AgentNodeData>[], edges: Edge[]): string {
  if (nodes.length === 0) return "# empty graph";

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, Edge[]>();
  edges.forEach((e) => {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e);
  });

  const lines: string[] = [];
  lines.push("# auto-generated from canvas");
  lines.push("from agent_runtime import Graph, State");
  lines.push("");
  lines.push("graph = Graph()");
  lines.push("");

  for (const n of nodes) {
    const d = n.data;
    const cfg = Object.entries(d.config)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(", ");
    lines.push(`@graph.node("${n.id}", kind="${d.kind}"${cfg ? ", " + cfg : ""})`);
    lines.push(`def ${sanitize(d.name)}(state: State):`);
    lines.push(`    ${bodyFor(d)}`);
    lines.push("");
  }

  lines.push("# edges");
  for (const e of edges) {
    const src = byId.get(e.source)?.data.name ?? e.source;
    const tgt = byId.get(e.target)?.data.name ?? e.target;
    lines.push(`graph.connect("${src}", "${tgt}", on=${JSON.stringify(e.label ?? "next")})`);
  }
  lines.push("");

  const entry = nodes.find((n) => n.data.isEntry);
  if (entry) {
    lines.push(`graph.set_entry("${entry.data.name}")`);
  }
  lines.push("");
  lines.push("if __name__ == '__main__':");
  lines.push("    graph.run(State())");
  return lines.join("\n");

  function bodyFor(d: AgentNodeData): string {
    switch (d.kind) {
      case "trigger":
        return `return state.bind(${d.config.schema || "input"})`;
      case "llm":
        return `return llm(${JSON.stringify(d.config.model || "gpt-5")}).complete(${JSON.stringify(d.config.prompt || "...")}, state)`;
      case "tool":
        return `return tools.${d.config.tool || "noop"}(${d.config.args || "state"})`;
      case "router":
        return `return "true" if (${d.config.predicate || "True"}) else "false"`;
      case "subagent":
        return `return subgraph(${JSON.stringify(d.config.graph || "sub")}).run(${d.config.input || "state"})`;
      case "memory":
        return d.config.op === "write"
          ? `memory.write(${JSON.stringify(d.config.key || "key")}, state)`
          : `state.memory = memory.read(${JSON.stringify(d.config.key || "key")})`;
      case "human":
        return `return await_human(channel=${JSON.stringify(d.config.channel || "ui")}, prompt=${JSON.stringify(d.config.prompt || "")})`;
      case "sink":
        return `return emit(${JSON.stringify(d.config.target || "response")}, state)`;
    }
  }
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_") || "node";
}

export function generateJsPseudocode(nodes: Node<AgentNodeData>[], edges: Edge[]): string {
  if (nodes.length === 0) return "// empty graph";
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const lines: string[] = [];
  lines.push("// auto-generated from canvas");
  lines.push("import { Graph, llm, tools, memory, awaitHuman, emit, subgraph } from './agent-runtime';");
  lines.push("");
  lines.push("const graph = new Graph();");
  lines.push("");
  for (const n of nodes) {
    const d = n.data;
    const cfg = Object.entries(d.config)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(", ");
    lines.push(`graph.node("${n.id}", { kind: "${d.kind}"${cfg ? ", " + cfg : ""} }, async (state) => {`);
    lines.push(`  ${jsBody(d)}`);
    lines.push(`});`);
    lines.push("");
  }
  lines.push("// edges");
  for (const e of edges) {
    const src = byId.get(e.source)?.data.name ?? e.source;
    const tgt = byId.get(e.target)?.data.name ?? e.target;
    lines.push(`graph.connect(${JSON.stringify(src)}, ${JSON.stringify(tgt)}, { on: ${JSON.stringify(e.label ?? "next")} });`);
  }
  lines.push("");
  const entry = nodes.find((n) => n.data.isEntry);
  if (entry) lines.push(`graph.setEntry(${JSON.stringify(entry.data.name)});`);
  lines.push("");
  lines.push("graph.run({});");
  return lines.join("\n");

  function jsBody(d: AgentNodeData): string {
    switch (d.kind) {
      case "trigger": return `return state.bind(${JSON.stringify(d.config.schema || "input")});`;
      case "llm": return `return await llm(${JSON.stringify(d.config.model || "gpt-5")}).complete(${JSON.stringify(d.config.prompt || "...")}, state);`;
      case "tool": return `return await tools.${d.config.tool || "noop"}(${d.config.args || "state"});`;
      case "router": return `return (${d.config.predicate || "true"}) ? "true" : "false";`;
      case "subagent": return `return await subgraph(${JSON.stringify(d.config.graph || "sub")}).run(${d.config.input || "state"});`;
      case "memory": return d.config.op === "write"
        ? `await memory.write(${JSON.stringify(d.config.key || "key")}, state);`
        : `state.memory = await memory.read(${JSON.stringify(d.config.key || "key")});`;
      case "human": return `return await awaitHuman({ channel: ${JSON.stringify(d.config.channel || "ui")}, prompt: ${JSON.stringify(d.config.prompt || "")} });`;
      case "sink": return `return emit(${JSON.stringify(d.config.target || "response")}, state);`;
    }
  }
}