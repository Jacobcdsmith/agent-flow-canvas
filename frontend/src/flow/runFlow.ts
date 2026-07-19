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
  stateSnapshot?: Record<string, unknown>;
}

export interface RunOptions {
  nodes: Node<AgentNodeData>[];
  edges: Edge[];
  gateways: Gateway[];
  initialState?: Record<string, unknown>;
  maxSteps?: number;
  onLog?: (log: RunLog) => void;
  stepDelay?: number;
  onHumanApproval?: (req: {
    nodeId: string;
    name: string;
    prompt: string;
    channel: string;
  }) => Promise<string>;
  globals?: { key: string; value: string }[];
  secrets?: { key: string; value: string }[];
}

/**
 * Interpolates state variables and parameters inside double-curly braces (e.g., {{state.value}})
 * in a template string. Falls back to empty string if a path is undefined.
 *
 * @param template The raw template string containing placeholders.
 * @param state The workflow execution state object.
 * @param globals Optional global variables key-value list.
 * @param secrets Optional secrets key-value list.
 * @returns The fully interpolated template string.
 */
function interpolate(
  template: string,
  state: Record<string, unknown>,
  globals: { key: string; value: string }[] = [],
  secrets: { key: string; value: string }[] = [],
): string {
  if (!template) return "";
  let result = template
    .replace(/\{\{?\s*state\.([\w.]+)\s*\}?\}/g, (_m, k) => {
      const v = getPath(state, String(k));
      return v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
    })
    .replace(/\{\{?\s*query\s*\}?\}/g, () => String(state.query ?? ""));

  // Interpolate global variables
  result = result.replace(/\{\{?\s*globals?\.(\w+)\s*\}?\}/g, (_m, key) => {
    const item = globals.find((g) => g.key === key);
    return item ? item.value : "";
  });

  // Interpolate secrets
  result = result.replace(/\{\{?\s*secrets?\.(\w+)\s*\}?\}/g, (_m, key) => {
    const item = secrets.find((s) => s.key === key);
    return item ? item.value : "";
  });

  return result;
}

/**
 * Traverses a nested object hierarchy to retrieve the value at a dot-separated path.
 *
 * @param obj The source object to query.
 * @param path The dot-separated property path.
 * @returns The value at the specified path, or undefined if any part of the path is missing.
 */
function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, p) => {
    if (acc && typeof acc === "object" && p in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[p];
    }
    return undefined;
  }, obj);
}

/**
 * Evaluates the output state of the current node to select the matching outgoing edge.
 * Prioritizes on_error edges if an error occurred, router conditions, tool_results,
 * and falls back sequentially to "next", "on_success", or the first outgoing edge.
 *
 * @param outgoing The list of outgoing edges from the active node.
 * @param state The current execution state.
 * @param errored A boolean indicating whether node execution threw an error.
 * @returns The selected Edge, or null if no outgoing edge matches the current condition.
 */
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

/**
 * Core engine function that executes an agent flow graph in-browser sequentially,
 * handling state modifications, node routing logic, and visualization delays.
 *
 * @param opts Configuration options including the nodes list, edges list, gateway configuration, and step delay.
 * @returns A promise resolving to an array of step-by-step RunLogs.
 */
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
      output = await runNode(current, state, gateways, opts);
      if (output !== undefined) state.last_output = output;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const ms = Math.round(performance.now() - t0);
    let stateSnapshot: Record<string, unknown> | undefined;
    try {
      stateSnapshot = JSON.parse(JSON.stringify(state));
    } catch {
      stateSnapshot = { ...state };
    }

    const log: RunLog = {
      step,
      nodeId: current.id,
      name: current.data.name,
      kind: current.data.kind,
      label: prevEdgeLabel,
      output,
      error,
      ms,
      stateSnapshot,
    };
    logs.push(log);
    onLog?.(log);

    if (opts.stepDelay && opts.stepDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, opts.stepDelay));
    }

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

/**
 * Processes and executes an individual node's operational logic based on its kind,
 * such as compiling templates, querying gateway LLMs, or updating memory stores.
 *
 * @param node The specific node metadata and config to run.
 * @param state The current execution state, which may be read or updated.
 * @param gateways The list of user-configured gateway profiles.
 * @returns A promise resolving to the output payload produced by the node.
 */
async function runNode(
  node: Node<AgentNodeData>,
  state: Record<string, unknown>,
  gateways: Gateway[],
  opts: RunOptions,
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
      const promptText = interpolate(cfg.prompt || "", state, opts.globals, opts.secrets);
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
        args: interpolate(cfg.args || "", state, opts.globals, opts.secrets),
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
        input: interpolate(cfg.input || "", state, opts.globals, opts.secrets),
        note: "subagent execution is schematic",
      };
    }
    case "human": {
      const prompt = interpolate(cfg.prompt || "approve?", state, opts.globals, opts.secrets);
      const channel = cfg.channel || "ui";
      if (opts.onHumanApproval) {
        const decision = await opts.onHumanApproval({
          nodeId: node.id,
          name: node.data.name,
          prompt,
          channel,
        });
        return {
          prompt,
          channel,
          decision,
        };
      }
      return {
        simulated: true,
        prompt,
        channel,
        decision: "auto-approved (schematic)",
      };
    }
    case "http": {
      const url = interpolate(cfg.url || "", state, opts.globals, opts.secrets);
      if (!url) throw new Error("HTTP node requires a URL");

      const method = (cfg.method || "GET").toUpperCase();

      let headers: Record<string, string> = {};
      const rawHeaders = cfg.headers || "";
      if (rawHeaders.trim()) {
        try {
          const interpolatedHeaders = interpolate(rawHeaders, state, opts.globals, opts.secrets);
          headers = JSON.parse(interpolatedHeaders);
        } catch (e) {
          throw new Error(`Failed to parse HTTP headers JSON: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      let body: string | undefined;
      const rawBody = cfg.body || "";
      if (rawBody.trim() && method !== "GET" && method !== "HEAD") {
        body = interpolate(rawBody, state, opts.globals, opts.secrets);
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
      };
      if (body !== undefined) {
        fetchOptions.body = body;
      }

      const res = await fetch(url, fetchOptions);
      const contentType = res.headers.get("content-type") || "";
      let responseData: unknown;
      if (contentType.includes("application/json")) {
        responseData = await res.json();
      } else {
        responseData = await res.text();
      }

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${typeof responseData === "string" ? responseData : JSON.stringify(responseData)}`);
      }

      return {
        status: res.status,
        statusText: res.statusText,
        data: responseData,
      };
    }
    case "script": {
      const code = cfg.code || "";
      if (!code.trim()) {
        return { note: "Empty script execution" };
      }
      try {
        // Runs custom javascript block with state in scope
        // eslint-disable-next-line no-new-func
        const fn = new Function("state", `${code}`);
        const result = fn(state);
        return result !== undefined ? result : { executed: true, note: "Script executed successfully" };
      } catch (e) {
        throw new Error(`Script execution failed: ${e instanceof Error ? e.message : String(e)}`);
      }
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

/**
 * Resolves which Gateway profile should be utilized by an LLM node, taking into
 * account node-level gateway configuration overrides or default fallbacks.
 *
 * @param node The LLM node to pick a gateway for.
 * @param gateways The array of all configured gateway profiles.
 * @returns The selected Gateway configuration, or null if no gateways exist.
 */
function pickGateway(node: Node<AgentNodeData>, gateways: Gateway[]): Gateway | null {
  if (gateways.length === 0) return null;
  const id = node.data.gatewayId;
  if (id) {
    const m = gateways.find((g) => g.id === id);
    if (m) return m;
  }
  return gateways[0]; // fall back to first gateway as default
}

/**
 * Parses a numeric float value from a string, falling back to a default value if invalid.
 *
 * @param v The raw string value.
 * @param fallback The default number if parsing fails.
 * @returns The parsed float value.
 */
function parseFloatOr(v: string | undefined, fallback: number): number {
  if (!v || !v.trim()) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parses an integer value from a string, falling back to a default value if invalid.
 *
 * @param v The raw string value.
 * @param fallback The default integer if parsing fails.
 * @returns The parsed integer value.
 */
function parseIntOr(v: string | undefined, fallback: number): number {
  if (!v || !v.trim()) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
