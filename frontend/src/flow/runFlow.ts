import type { Edge, Node } from "reactflow";
import type { AgentNodeData } from "./types";
import type { Gateway } from "./gateways";
import { callLLM, ChatMessage } from "./adapters";

export interface RunLog {
  step: number;
  nodeId: string;
  name: string;
  kind: string;
  label: string;
  output?: unknown;
  error?: string;
  ms: number;
}

export interface RunOptions {
  nodes: Node<AgentNodeData>[];
  edges: Edge[];
  gateways: Gateway[];
  initialState?: Record<string, unknown>;
  maxSteps?: number;
  onLog?: (log: RunLog) => void;
}

function interpolate(template: string, state: Record<string, unknown>): string {
  if (!template) return "";
  return template
    .replace(/\{\{?\s*state\.([\w.]+)\s*\}?\}/g, (_m, k) => {
      const v = getPath(state, String(k));
      return v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
    })
    .replace(/\{\{?\s*query\s*\}?\}/g, () => String(state.query ?? ""));
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, p) => {
    if (acc && typeof acc === "object" && p in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[p];
    }
    return undefined;
  }, obj);
}

function pickNextEdge(
  outgoing: Edge[],
  state: Record<string, unknown>,
  errored: boolean,
): Edge | null {
  if (outgoing.length === 0) return null;
  if (errored) {
    const onError = outgoing.find((e) => String(e.label) === "on_error");
    if (onError) return onError;
  }
  // router branch
  const branch = state.__router_branch as "true" | "false" | undefined;
  if (branch) {
    const m = outgoing.find((e) => String(e.label) === branch);
    if (m) return m;
  }
  // tool follow-up
  if (state.__last_kind === "tool") {
    const tr = outgoing.find((e) => String(e.label) === "tool_result");
    if (tr) return tr;
  }
  // prefer next, then on_success, then anything
  return (
    outgoing.find((e) => String(e.label) === "next") ??
    outgoing.find((e) => String(e.label) === "on_success") ??
    outgoing[0]
  );
}

export async function runFlow(opts: RunOptions): Promise<RunLog[]> {
  const { nodes, edges, gateways, onLog } = opts;
  const maxSteps = opts.maxSteps ?? 30;
  const logs: RunLog[] = [];
  const state: Record<string, unknown> = { query: "hello world", ...(opts.initialState ?? {}) };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outBy = new Map<string, Edge[]>();
  edges.forEach((e) => {
    const arr = outBy.get(e.source) ?? [];
    arr.push(e);
    outBy.set(e.source, arr);
  });

  const entry =
    nodes.find((n) => n.data.isEntry) ??
    nodes.find((n) => n.data.kind === "trigger") ??
    nodes[0];
  if (!entry) throw new Error("No entry node");

  let current: Node<AgentNodeData> | undefined = entry;
  let prevEdgeLabel = "start";
  let step = 0;

  while (current && step < maxSteps) {
    step++;
    const t0 = performance.now();
    let output: unknown;
    let error: string | undefined;
    state.__last_kind = current.data.kind;
    delete state.__router_branch;

    try {
      output = await runNode(current, state, gateways);
      if (output !== undefined) state.last_output = output;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const ms = Math.round(performance.now() - t0);
    const log: RunLog = {
      step,
      nodeId: current.id,
      name: current.data.name,
      kind: current.data.kind,
      label: prevEdgeLabel,
      output,
      error,
      ms,
    };
    logs.push(log);
    onLog?.(log);

    if (current.data.isTerminal || current.data.kind === "sink") break;

    const outs = outBy.get(current.id) ?? [];
    const next = pickNextEdge(outs, state, !!error);
    if (!next) break;
    prevEdgeLabel = String(next.label ?? "next");
    current = byId.get(next.target);
  }

  if (step >= maxSteps) {
    logs.push({
      step: step + 1,
      nodeId: "_runtime",
      name: "runtime",
      kind: "runtime",
      label: "halt",
      error: `Halted after ${maxSteps} steps (max-steps guard)`,
      ms: 0,
    });
  }
  return logs;
}

async function runNode(
  node: Node<AgentNodeData>,
  state: Record<string, unknown>,
  gateways: Gateway[],
): Promise<unknown> {
  const cfg = node.data.config ?? {};
  switch (node.data.kind) {
    case "trigger": {
      return { triggered: true, source: cfg.source || "manual", state: { ...state } };
    }
    case "llm": {
      const gw = pickGateway(node, gateways);
      if (!gw) throw new Error("No gateway available — open ⚙ gateways and add one");
      const model = (cfg.model && cfg.model.trim()) || gw.defaultModel;
      const temperature = parseFloatOr(cfg.temperature, gw.temperature);
      const maxTokens = parseIntOr(cfg.max_tokens, gw.maxTokens);
      const promptText = interpolate(cfg.prompt || "", state);
      const messages: ChatMessage[] = [];
      const userQuery = String(state.query ?? "");
      if (promptText) messages.push({ role: "system", content: promptText });
      messages.push({
        role: "user",
        content:
          userQuery ||
          (typeof state.last_output === "string"
            ? state.last_output
            : JSON.stringify(state.last_output ?? {})),
      });
      const res = await callLLM(gw, { model, temperature, maxTokens, messages });
      return { text: res.text, model, gateway: gw.name };
    }
    case "tool": {
      // Schematic — we don't actually run arbitrary tools in the browser.
      return {
        simulated: true,
        tool: cfg.tool || "unknown",
        args: interpolate(cfg.args || "", state),
        note: "tool execution is schematic — wire your own runtime to make this real",
      };
    }
    case "router": {
      // Naive: try to evaluate predicate as JS expression against a sandboxed `state`.
      const pred = cfg.predicate || "";
      let truthy = false;
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function("state", `return Boolean(${pred || "true"});`);
        truthy = !!fn(state);
      } catch {
        truthy = !!state.last_output;
      }
      state.__router_branch = truthy ? "true" : "false";
      return { predicate: pred, branch: truthy ? "true" : "false" };
    }
    case "memory": {
      const op = (cfg.op || "read").toLowerCase();
      const key = cfg.key || "memory";
      const memory = (state.__memory ?? {}) as Record<string, unknown>;
      if (op === "write") {
        memory[key] = state.last_output ?? null;
        state.__memory = memory;
        return { wrote: key, value: memory[key] };
      }
      return { read: key, value: memory[key] ?? null };
    }
    case "subagent": {
      return {
        simulated: true,
        subagent: cfg.graph || "unknown",
        input: interpolate(cfg.input || "", state),
        note: "subagent execution is schematic",
      };
    }
    case "human": {
      return {
        simulated: true,
        prompt: interpolate(cfg.prompt || "approve?", state),
        channel: cfg.channel || "ui",
        decision: "auto-approved (schematic)",
      };
    }
    case "sink": {
      return {
        target: cfg.target || "response",
        result: state.last_output ?? null,
      };
    }
    default:
      return { kind: node.data.kind, note: "no executor" };
  }
}

function pickGateway(node: Node<AgentNodeData>, gateways: Gateway[]): Gateway | null {
  if (gateways.length === 0) return null;
  const id = node.data.gatewayId;
  if (id) {
    const m = gateways.find((g) => g.id === id);
    if (m) return m;
  }
  return gateways[0]; // fall back to first gateway as default
}

function parseFloatOr(v: string | undefined, fallback: number): number {
  if (!v || !v.trim()) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}
function parseIntOr(v: string | undefined, fallback: number): number {
  if (!v || !v.trim()) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
