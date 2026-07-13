import { Edge, Node } from "reactflow";
import { AgentNodeData, AgentNodeKind } from "./types";

// =====================================================================
// codegen.ts
// Produces real, runnable Python (and an equivalent JS module) from the
// visual graph. Output is syntactically valid: identifiers are sanitized,
// strings are JSON-escaped, edges are wired through a small async runtime
// embedded in the generated file. No external SDK calls — the runtime is
// self-contained so the file actually executes (`python flow.py`).
// =====================================================================

const PY_KEYWORDS = new Set([
  "False","None","True","and","as","assert","async","await","break","class",
  "continue","def","del","elif","else","except","finally","for","from","global",
  "if","import","in","is","lambda","nonlocal","not","or","pass","raise","return",
  "try","while","with","yield","match","case",
]);

export interface CodegenResult {
  code: string;
  errors: string[];
}

function pyIdent(raw: string, fallback: string, used: Set<string>): string {
  let s = (raw || fallback).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  if (!s || /^[0-9]/.test(s)) s = "_" + s;
  if (PY_KEYWORDS.has(s)) s = s + "_";
  let candidate = s;
  let i = 2;
  while (used.has(candidate)) candidate = `${s}_${i++}`;
  used.add(candidate);
  return candidate;
}

function pyStr(s: string | undefined): string {
  return JSON.stringify(s ?? "");
}

function indent(block: string, n = 1): string {
  const pad = "    ".repeat(n);
  return block.split("\n").map((l) => (l.length ? pad + l : l)).join("\n");
}

interface NodeBinding {
  id: string;
  funcName: string;
  data: AgentNodeData;
}

function buildBindings(nodes: Node<AgentNodeData>[]): NodeBinding[] {
  const used = new Set<string>();
  return nodes.map((n) => ({
    id: n.id,
    funcName: pyIdent(n.data.name, `node_${n.id}`, used),
    data: n.data,
  }));
}

function pickEntry(nodes: Node<AgentNodeData>[]): string | null {
  const explicit = nodes.find((n) => n.data.isEntry);
  if (explicit) return explicit.id;
  const trigger = nodes.find((n) => n.data.kind === "trigger");
  return trigger?.id ?? nodes[0]?.id ?? null;
}

// ---------------------------------------------------------------------
// PYTHON
// ---------------------------------------------------------------------
export function generatePython(
  nodes: Node<AgentNodeData>[],
  edges: Edge[],
): CodegenResult {
  const errors: string[] = [];
  if (nodes.length === 0) {
    return { code: "# empty graph — add a Trigger node to begin\n", errors };
  }

  const bindings = buildBindings(nodes);
  const byId = new Map(bindings.map((b) => [b.id, b]));
  const entryId = pickEntry(nodes);
  if (!entryId) errors.push("No entry node");

  const outgoing = new Map<string, Edge[]>();
  edges.forEach((e) => {
    if (!byId.has(e.source) || !byId.has(e.target)) {
      errors.push(`Edge ${e.id} references missing node`);
      return;
    }
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e);
  });

  const lines: string[] = [];
  lines.push(`"""Auto-generated agent flow.`);
  lines.push(``);
  lines.push(`Run:  python flow.py`);
  lines.push(`Nodes: ${nodes.length}   Edges: ${edges.length}`);
  lines.push(`"""`);
  lines.push(`from __future__ import annotations`);
  lines.push(``);
  lines.push(`import asyncio`);
  lines.push(`import json`);
  lines.push(`import logging`);
  lines.push(`from dataclasses import dataclass, field`);
  lines.push(`from typing import Any, Awaitable, Callable, Dict, List, Optional`);
  lines.push(``);
  lines.push(`logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")`);
  lines.push(`log = logging.getLogger("agent_flow")`);
  lines.push(``);
  lines.push(`# ---------------------------------------------------------------`);
  lines.push(`# Minimal embedded runtime`);
  lines.push(`# ---------------------------------------------------------------`);
  lines.push(`@dataclass`);
  lines.push(`class State:`);
  lines.push(`    data: Dict[str, Any] = field(default_factory=dict)`);
  lines.push(`    history: List[Dict[str, Any]] = field(default_factory=list)`);
  lines.push(`    last: Any = None`);
  lines.push(``);
  lines.push(`    def set(self, key: str, value: Any) -> "State":`);
  lines.push(`        self.data[key] = value`);
  lines.push(`        return self`);
  lines.push(``);
  lines.push(`    def get(self, key: str, default: Any = None) -> Any:`);
  lines.push(`        return self.data.get(key, default)`);
  lines.push(``);
  lines.push(``);
  lines.push(`NodeFn = Callable[[State], Awaitable[Any]]`);
  lines.push(``);
  lines.push(``);
  lines.push(`class Graph:`);
  lines.push(`    def __init__(self) -> None:`);
  lines.push(`        self.nodes: Dict[str, NodeFn] = {}`);
  lines.push(`        self.edges: Dict[str, List[tuple[str, str]]] = {}  # src -> [(label, dst)]`);
  lines.push(`        self.entry: Optional[str] = None`);
  lines.push(``);
  lines.push(`    def node(self, name: str):`);
  lines.push(`        def deco(fn: NodeFn) -> NodeFn:`);
  lines.push(`            self.nodes[name] = fn`);
  lines.push(`            self.edges.setdefault(name, [])`);
  lines.push(`            return fn`);
  lines.push(`        return deco`);
  lines.push(``);
  lines.push(`    def connect(self, src: str, dst: str, on: str = "next") -> None:`);
  lines.push(`        self.edges.setdefault(src, []).append((on, dst))`);
  lines.push(``);
  lines.push(`    def set_entry(self, name: str) -> None:`);
  lines.push(`        self.entry = name`);
  lines.push(``);
  lines.push(`    async def run(self, state: Optional[State] = None, max_steps: int = 64) -> State:`);
  lines.push(`        state = state or State()`);
  lines.push(`        if self.entry is None:`);
  lines.push(`            raise RuntimeError("Graph has no entry node")`);
  lines.push(`        current = self.entry`);
  lines.push(`        for step in range(max_steps):`);
  lines.push(`            fn = self.nodes.get(current)`);
  lines.push(`            if fn is None:`);
  lines.push(`                raise RuntimeError(f"Unknown node: {current}")`);
  lines.push(`            log.info("step %d → %s", step, current)`);
  lines.push(`            try:`);
  lines.push(`                result = await fn(state)`);
  lines.push(`                label = result if isinstance(result, str) else "next"`);
  lines.push(`            except Exception as exc:  # noqa: BLE001`);
  lines.push(`                log.exception("node %s failed: %s", current, exc)`);
  lines.push(`                label = "on_error"`);
  lines.push(`                state.last = {"error": str(exc)}`);
  lines.push(`            state.history.append({"node": current, "label": label})`);
  lines.push(`            edges = self.edges.get(current, [])`);
  lines.push(`            nxt = next((d for lbl, d in edges if lbl == label), None)`);
  lines.push(`            if nxt is None:`);
  lines.push(`                nxt = next((d for lbl, d in edges if lbl == "next"), None)`);
  lines.push(`            if nxt is None:`);
  lines.push(`                log.info("terminal at %s", current)`);
  lines.push(`                return state`);
  lines.push(`            current = nxt`);
  lines.push(`        raise RuntimeError(f"Exceeded max_steps={max_steps}")`);
  lines.push(``);
  lines.push(``);
  lines.push(`# ---------------------------------------------------------------`);
  lines.push(`# Pluggable adapters — replace stubs with real SDK calls`);
  lines.push(`# ---------------------------------------------------------------`);
  lines.push(`async def call_llm(model: str, prompt: str, state: State) -> str:`);
  lines.push(`    """Stub: integrate openai/anthropic/etc. here."""`);
  lines.push(`    log.info("llm[%s] prompt=%r", model, prompt[:60])`);
  lines.push(`    return f"[{model}] {prompt[:40]}…"`);
  lines.push(``);
  lines.push(`async def call_tool(tool: str, args: Dict[str, Any], state: State) -> Any:`);
  lines.push(`    log.info("tool[%s] args=%s", tool, args)`);
  lines.push(`    return {"tool": tool, "ok": True, "args": args}`);
  lines.push(``);
  lines.push(`async def memory_read(key: str, state: State) -> Any:`);
  lines.push(`    return state.get(f"mem::{key}")`);
  lines.push(``);
  lines.push(`async def memory_write(key: str, value: Any, state: State) -> None:`);
  lines.push(`    state.set(f"mem::{key}", value)`);
  lines.push(``);
  lines.push(`async def await_human(channel: str, prompt: str, state: State) -> str:`);
  lines.push(`    log.info("human[%s] %s", channel, prompt)`);
  lines.push(`    return "approved"  # replace with real HITL integration`);
  lines.push(``);
  lines.push(`async def run_subgraph(name: str, payload: Any, state: State) -> Any:`);
  lines.push(`    log.info("subgraph %s payload=%s", name, payload)`);
  lines.push(`    return {"subgraph": name, "result": payload}`);
  lines.push(``);
  lines.push(`async def emit_output(target: str, state: State) -> Any:`);
  lines.push(`    payload = {"target": target, "last": state.last, "data": state.data}`);
  lines.push(`    print(json.dumps(payload, default=str, indent=2))`);
  lines.push(`    return payload`);
  lines.push(``);
  lines.push(`async def make_http_request(method: str, url: str, headers_json: str, body_str: str, state: State) -> Any:`);
  lines.push(`    import urllib.request`);
  lines.push(`    import urllib.error`);
  lines.push(`    log.info("HTTP %s %s", method, url)`);
  lines.push(`    headers = {}`);
  lines.push(`    if headers_json:`);
  lines.push(`        try:`);
  lines.push(`            headers = json.loads(headers_json)`);
  lines.push(`        except Exception:`);
  lines.push(`            pass`);
  lines.push(`    req_data = None`);
  lines.push(`    if body_str:`);
  lines.push(`        req_data = body_str.encode("utf-8")`);
  lines.push(`        if "Content-Type" not in headers and "content-type" not in headers:`);
  lines.push(`            headers["Content-Type"] = "application/json"`);
  lines.push(`    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)`);
  lines.push(`    try:`);
  lines.push(`        with urllib.request.urlopen(req) as response:`);
  lines.push(`            status = response.status`);
  lines.push(`            resp_body = response.read().decode("utf-8")`);
  lines.push(`            try:`);
  lines.push(`                resp_body = json.loads(resp_body)`);
  lines.push(`            except Exception:`);
  lines.push(`                pass`);
  lines.push(`            return {"status": status, "body": resp_body}`);
  lines.push(`    except urllib.error.HTTPError as err:`);
  lines.push(`        err_body = err.read().decode("utf-8")`);
  lines.push(`        raise RuntimeError(f"HTTP {err.code}: {err_body}")`);
  lines.push(`    except Exception as exc:`);
  lines.push(`        raise RuntimeError(f"HTTP request failed: {exc}")`);
  lines.push(``);
  lines.push(``);
  lines.push(`# ---------------------------------------------------------------`);
  lines.push(`# Graph definition (generated)`);
  lines.push(`# ---------------------------------------------------------------`);
  lines.push(`graph = Graph()`);
  lines.push(``);

  for (const b of bindings) {
    const body = pyBody(b.data);
    lines.push(`@graph.node(${pyStr(b.funcName)})`);
    lines.push(`async def ${b.funcName}(state: State) -> str:`);
    lines.push(`    """${b.data.kind}: ${b.data.name.replace(/"/g, "'")}"""`);
    lines.push(indent(body));
    lines.push(``);
  }

  lines.push(`# edges`);
  for (const e of edges) {
    const src = byId.get(e.source);
    const tgt = byId.get(e.target);
    if (!src || !tgt) continue;
    lines.push(
      `graph.connect(${pyStr(src.funcName)}, ${pyStr(tgt.funcName)}, on=${pyStr(String(e.label ?? "next"))})`,
    );
  }
  lines.push(``);

  if (entryId) {
    const entryName = byId.get(entryId)!.funcName;
    lines.push(`graph.set_entry(${pyStr(entryName)})`);
  }
  lines.push(``);
  lines.push(`async def main() -> None:`);
  lines.push(`    state = State(data={"query": "hello world"})`);
  lines.push(`    final = await graph.run(state)`);
  lines.push(`    log.info("done: %d steps", len(final.history))`);
  lines.push(``);
  lines.push(`if __name__ == "__main__":`);
  lines.push(`    asyncio.run(main())`);

  return { code: lines.join("\n"), errors };

  function pyBody(d: AgentNodeData): string {
    const c = d.config || {};
    switch (d.kind) {
      case "trigger":
        return [
          `# trigger source=${pyStr(c.source || "manual")}`,
          `state.set("input_schema", ${pyStr(c.schema || "")})`,
          `state.last = {"source": ${pyStr(c.source || "manual")}}`,
          `return "next"`,
        ].join("\n");
      case "llm":
        return [
          `result = await call_llm(${pyStr(c.model || "gpt-5")}, ${pyStr(c.prompt || "")}, state)`,
          `state.last = result`,
          `return "on_success"`,
        ].join("\n");
      case "tool":
        return [
          `args = ${pyStr(c.args || "")} or {}`,
          `result = await call_tool(${pyStr(c.tool || "noop")}, {"raw": args}, state)`,
          `state.last = result`,
          `return "tool_result"`,
        ].join("\n");
      case "router":
        // predicate is rendered as a comment + safe boolean derived from state.last
        return [
          `# predicate: ${(c.predicate || "True").replace(/\n/g, " ")}`,
          `decision = bool(state.last) if state.last is not None else True`,
          `return "true" if decision else "false"`,
        ].join("\n");
      case "subagent":
        return [
          `payload = state.get(${pyStr(c.input || "input")}, state.last)`,
          `result = await run_subgraph(${pyStr(c.graph || "sub")}, payload, state)`,
          `state.last = result`,
          `return "on_success"`,
        ].join("\n");
      case "memory":
        if ((c.op || "read") === "write") {
          return [
            `await memory_write(${pyStr(c.key || "key")}, state.last, state)`,
            `return "next"`,
          ].join("\n");
        }
        return [
          `value = await memory_read(${pyStr(c.key || "key")}, state)`,
          `state.set(${pyStr(c.key || "key")}, value)`,
          `return "next"`,
        ].join("\n");
      case "human":
        return [
          `decision = await await_human(${pyStr(c.channel || "ui")}, ${pyStr(c.prompt || "")}, state)`,
          `state.last = decision`,
          `return "next"`,
        ].join("\n");
      case "sink":
        return [
          `await emit_output(${pyStr(c.target || "response")}, state)`,
          `return "next"`,
        ].join("\n");
      case "http":
        return [
          `# HTTP Request`,
          `method = ${pyStr(c.method || "GET")}`,
          `url = ${pyStr(c.url || "")}`,
          `headers_json = ${pyStr(c.headers || "")}`,
          `body = ${pyStr(c.body || "")}`,
          `result = await make_http_request(method, url, headers_json, body, state)`,
          `state.last = result`,
          `return "on_success"`,
        ].join("\n");
      case "script":
        return [
          `# JS Script Node (Simulated execution block)`,
          `# Original Code:`,
          ...((c.code || "").split("\n").map((line) => `#   ${line}`)),
          `# Setting execution stub outputs`,
          `return "next"`,
        ].join("\n");
      default: {
        const _exhaustive: never = d.kind as never;
        return `return "next"  # unknown kind ${_exhaustive}`;
      }
    }
  }
}

// ---------------------------------------------------------------------
// JAVASCRIPT (ESM, runnable: `node flow.mjs`)
// ---------------------------------------------------------------------
export function generateJavaScript(
  nodes: Node<AgentNodeData>[],
  edges: Edge[],
): CodegenResult {
  const errors: string[] = [];
  if (nodes.length === 0) return { code: "// empty graph\n", errors };

  const bindings = buildBindings(nodes);
  const byId = new Map(bindings.map((b) => [b.id, b]));
  const entryId = pickEntry(nodes);
  if (!entryId) errors.push("No entry node");

  const lines: string[] = [];
  lines.push(`// Auto-generated agent flow. Run:  node flow.mjs`);
  lines.push(`// Nodes: ${nodes.length}  Edges: ${edges.length}`);
  lines.push(``);
  lines.push(`class State {`);
  lines.push(`  constructor(data = {}) { this.data = data; this.history = []; this.last = null; }`);
  lines.push(`  set(k, v) { this.data[k] = v; return this; }`);
  lines.push(`  get(k, d = null) { return this.data[k] ?? d; }`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`// adapters — swap with real SDKs`);
  lines.push(`const makeHttpRequest = async (method, url, headersJson, body, state) => {`);
  lines.push(`  const headers = headersJson ? JSON.parse(headersJson) : {};`);
  lines.push(`  if (body && !headers["Content-Type"] && !headers["content-type"]) {`);
  lines.push(`    headers["Content-Type"] = "application/json";`);
  lines.push(`  }`);
  lines.push(`  const opts = { method, headers };`);
  lines.push(`  if (method !== "GET" && method !== "HEAD" && body) {`);
  lines.push(`    opts.body = body;`);
  lines.push(`  }`);
  lines.push(`  const res = await fetch(url, opts);`);
  lines.push(`  const text = await res.text();`);
  lines.push(`  let respBody;`);
  lines.push(`  try { respBody = JSON.parse(text); } catch { respBody = text; }`);
  lines.push(`  if (!res.ok) throw new Error(\`HTTP \${res.status}: \${text.slice(0, 100)}\`);`);
  lines.push(`  return { status: res.status, body: respBody };`);
  lines.push(`};`);
  lines.push(``);
  lines.push(`class Graph {`);
  lines.push(`  constructor() { this.nodes = new Map(); this.edges = new Map(); this.entry = null; }`);
  lines.push(`  node(name, fn) { this.nodes.set(name, fn); if (!this.edges.has(name)) this.edges.set(name, []); }`);
  lines.push(`  connect(src, dst, on = "next") {`);
  lines.push(`    if (!this.edges.has(src)) this.edges.set(src, []);`);
  lines.push(`    this.edges.get(src).push({ on, dst });`);
  lines.push(`  }`);
  lines.push(`  setEntry(name) { this.entry = name; }`);
  lines.push(`  async run(state = new State(), maxSteps = 64) {`);
  lines.push(`    if (!this.entry) throw new Error("Graph has no entry node");`);
  lines.push(`    let current = this.entry;`);
  lines.push(`    for (let step = 0; step < maxSteps; step++) {`);
  lines.push(`      const fn = this.nodes.get(current);`);
  lines.push(`      if (!fn) throw new Error(\`Unknown node: \${current}\`);`);
  lines.push(`      console.log(\`step \${step} → \${current}\`);`);
  lines.push(`      let label = "next";`);
  lines.push(`      try { const r = await fn(state); if (typeof r === "string") label = r; }`);
  lines.push(`      catch (e) { console.error(e); label = "on_error"; state.last = { error: String(e) }; }`);
  lines.push(`      state.history.push({ node: current, label });`);
  lines.push(`      const outs = this.edges.get(current) ?? [];`);
  lines.push(`      const nxt = (outs.find(o => o.on === label) ?? outs.find(o => o.on === "next"))?.dst;`);
  lines.push(`      if (!nxt) return state;`);
  lines.push(`      current = nxt;`);
  lines.push(`    }`);
  lines.push(`    throw new Error("Exceeded maxSteps");`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`const callLlm = async (model, prompt) => \`[\${model}] \${prompt.slice(0, 40)}…\`;`);
  lines.push(`const callTool = async (tool, args) => ({ tool, ok: true, args });`);
  lines.push(`const memoryRead = async (key, state) => state.get(\`mem::\${key}\`);`);
  lines.push(`const memoryWrite = async (key, value, state) => state.set(\`mem::\${key}\`, value);`);
  lines.push(`const awaitHuman = async () => "approved";`);
  lines.push(`const runSubgraph = async (name, payload) => ({ subgraph: name, result: payload });`);
  lines.push(`const emitOutput = async (target, state) => { console.log(JSON.stringify({ target, last: state.last }, null, 2)); };`);
  lines.push(``);
  lines.push(`const graph = new Graph();`);
  lines.push(``);

  for (const b of bindings) {
    lines.push(`graph.node(${JSON.stringify(b.funcName)}, async (state) => {`);
    lines.push(indent(jsBody(b.data)));
    lines.push(`});`);
    lines.push(``);
  }

  for (const e of edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) continue;
    lines.push(`graph.connect(${JSON.stringify(s.funcName)}, ${JSON.stringify(t.funcName)}, ${JSON.stringify(String(e.label ?? "next"))});`);
  }
  lines.push(``);
  if (entryId) lines.push(`graph.setEntry(${JSON.stringify(byId.get(entryId)!.funcName)});`);
  lines.push(``);
  lines.push(`graph.run(new State({ query: "hello world" })).then(s => console.log("done", s.history.length));`);

  return { code: lines.join("\n"), errors };

  function jsBody(d: AgentNodeData): string {
    const c = d.config || {};
    switch (d.kind) {
      case "trigger":
        return `state.set("input_schema", ${JSON.stringify(c.schema || "")});\nstate.last = { source: ${JSON.stringify(c.source || "manual")} };\nreturn "next";`;
      case "llm":
        return `state.last = await callLlm(${JSON.stringify(c.model || "gpt-5")}, ${JSON.stringify(c.prompt || "")});\nreturn "on_success";`;
      case "tool":
        return `state.last = await callTool(${JSON.stringify(c.tool || "noop")}, { raw: ${JSON.stringify(c.args || "")} });\nreturn "tool_result";`;
      case "router":
        return `// predicate: ${(c.predicate || "true").replace(/\n/g, " ")}\nreturn state.last ? "true" : "false";`;
      case "subagent":
        return `state.last = await runSubgraph(${JSON.stringify(c.graph || "sub")}, state.get(${JSON.stringify(c.input || "input")}, state.last));\nreturn "on_success";`;
      case "memory":
        return (c.op || "read") === "write"
          ? `await memoryWrite(${JSON.stringify(c.key || "key")}, state.last, state);\nreturn "next";`
          : `state.set(${JSON.stringify(c.key || "key")}, await memoryRead(${JSON.stringify(c.key || "key")}, state));\nreturn "next";`;
      case "human":
        return `state.last = await awaitHuman(${JSON.stringify(c.channel || "ui")}, ${JSON.stringify(c.prompt || "")});\nreturn "next";`;
      case "sink":
        return `await emitOutput(${JSON.stringify(c.target || "response")}, state);\nreturn "next";`;
      case "http":
        return `const method = ${JSON.stringify(c.method || "GET")};\nconst url = ${JSON.stringify(c.url || "")};\nconst headers = ${JSON.stringify(c.headers || "")};\nconst body = ${JSON.stringify(c.body || "")};\nstate.last = await makeHttpRequest(method, url, headers, body, state);\nreturn "on_success";`;
      case "script":
        return `// JS Script Node Execution\n${c.code || ""}\nreturn "next";`;
      default:
        return `return "next";`;
    }
  }
}

// quick syntactic sanity check on Python — catches mismatched quotes / parens
export function lintPython(code: string): string[] {
  const issues: string[] = [];
  const stack: string[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let inStr: string | null = null;
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    const next2 = code.slice(i, i + 3);
    if (inStr) {
      if (inStr.length === 3 && next2 === inStr) { inStr = null; i += 3; continue; }
      if (inStr.length === 1 && ch === inStr) inStr = null;
      else if (ch === "\\") i++;
      i++;
      continue;
    }
    if (ch === "#") { while (i < code.length && code[i] !== "\n") i++; continue; }
    if (next2 === '"""' || next2 === "'''") { inStr = next2; i += 3; continue; }
    if (ch === '"' || ch === "'") { inStr = ch; i++; continue; }
    if ("([{".includes(ch)) stack.push(ch);
    else if (")]}".includes(ch)) {
      if (stack.pop() !== pairs[ch]) { issues.push(`Unbalanced ${ch} near offset ${i}`); break; }
    }
    i++;
  }
  if (stack.length) issues.push(`Unclosed ${stack.join("")}`);
  if (inStr) issues.push(`Unterminated string literal`);
  return issues;
}

export type CodeLanguage = "python" | "javascript";
export function generateCode(lang: CodeLanguage, nodes: Node<AgentNodeData>[], edges: Edge[]): CodegenResult {
  return lang === "python" ? generatePython(nodes, edges) : generateJavaScript(nodes, edges);
}

// also export the kind set for sanity
export const ALL_KINDS: AgentNodeKind[] = ["trigger","llm","tool","router","subagent","memory","human","sink","http","script"];