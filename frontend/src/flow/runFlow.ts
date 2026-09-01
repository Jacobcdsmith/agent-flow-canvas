import type { Edge, Node } from "reactflow";
import type { AgentNodeData } from "./types";
import type { Gateway } from "./gateways";
import { callLLM, ChatMessage } from "./adapters";
import { loadGlobals, loadSecrets } from "./globals";
import { TEMPLATES, loadWorkflows } from "./workflows";

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
 * Also interpolates dynamic Global Variables and Secrets.
 *
 * @param template The raw template string containing placeholders.
 * @param state The workflow execution state object.
 * @returns The fully interpolated template string.
 */
export function interpolate(
  template: string,
  state: Record<string, unknown>,
  globals?: { key: string; value: string }[],
  secrets?: { key: string; value: string }[]
): string {
  if (!template) return "";
  let result = template;

  if (globals) {
    globals.forEach((g) => {
      const regex = new RegExp(`\\{\\{\\s*global\\.${g.key}\\s*\\}\\}`, "g");
      result = result.replace(regex, g.value);
    });
  }

  if (secrets) {
    secrets.forEach((s) => {
      const regex = new RegExp(`\\{\\{\\s*secret\\.${s.key}\\s*\\}\\}`, "g");
      result = result.replace(regex, s.value);
    });
  }

  // Fallback unmatched global and secret placeholders to empty string
  result = result
    .replace(/\{\{\s*global\.[^}]+\s*\}\}/g, "")
    .replace(/\{\{\s*secret\.[^}]+\s*\}\}/g, "");

  return result
    .replace(/\{\{?\s*state\.([\w.]+)\s*\}?\}/g, (_m, k) => {
      const v = getPath(state, String(k));
      return v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
    })
    .replace(/\{\{?\s*query\s*\}?\}/g, () => String(state.query ?? ""));
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
 * Recursively flattens a nested object structure into a single-level object with dot-separated keys.
 */
function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
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
export function pickNextEdge(
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

  const globalsList = opts.globals ?? loadGlobals();
  const secretsList = opts.secrets ?? loadSecrets();

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
      output = await runNode(current, state, gateways, opts, globalsList, secretsList);
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
export async function runNode(
  node: Node<AgentNodeData>,
  state: Record<string, unknown>,
  gateways: Gateway[],
  opts: RunOptions,
  globalsList: { key: string; value: string }[],
  secretsList: { key: string; value: string }[],
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
      const promptText = interpolate(cfg.prompt || "", state, globalsList, secretsList);
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
        args: interpolate(cfg.args || "", state, globalsList, secretsList),
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
      const rawInput = cfg.input || "";
      const interpolatedInput = interpolate(rawInput, state, globalsList, secretsList);
      let subInitialState: Record<string, unknown> = { query: "subtask" };

      if (interpolatedInput.trim()) {
        try {
          const parsed = JSON.parse(interpolatedInput);
          if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            subInitialState = parsed;
          } else {
            subInitialState = { query: interpolatedInput };
          }
        } catch {
          if (rawInput.startsWith("state.")) {
            const pathVal = getPath(state, rawInput.slice(6));
            if (pathVal !== undefined) {
              if (typeof pathVal === "object" && pathVal !== null && !Array.isArray(pathVal)) {
                subInitialState = pathVal as Record<string, unknown>;
              } else {
                subInitialState = { query: String(pathVal) };
              }
            } else {
              subInitialState = { query: interpolatedInput };
            }
          } else {
            subInitialState = { query: interpolatedInput };
          }
        }
      }

      // Lookup target nested workflow from Workflows Library (Templates + Custom Workflows)
      const allWfs = [...TEMPLATES, ...loadWorkflows()];
      const subWf = allWfs.find((w) => w.id === cfg.graph);

      if (!subWf) {
        return {
          simulated: true,
          subagent: cfg.graph || "unknown",
          input: interpolatedInput,
          note: `Sub-workflow ${cfg.graph} not found — simulated fallback`,
        };
      }

      // Execute sub-workflow recursively in-browser
      const subLogs = await runFlow({
        nodes: subWf.nodes,
        edges: subWf.edges,
        gateways,
        initialState: subInitialState,
        maxSteps: opts.maxSteps,
        stepDelay: opts.stepDelay,
        onHumanApproval: opts.onHumanApproval,
        globals: globalsList,
        secrets: secretsList,
      });

      const finalLog = subLogs[subLogs.length - 1];
      const finalOutput = finalLog ? (finalLog.output ?? finalLog.stateSnapshot?.last_output ?? null) : null;

      return {
        subagent: subWf.name,
        input: subInitialState,
        output: finalOutput,
        subLogs,
      };
    }
    case "human": {
      const prompt = interpolate(cfg.prompt || "approve?", state, globalsList, secretsList);
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
      const url = interpolate(cfg.url || "", state, globalsList, secretsList);
      if (!url) throw new Error("HTTP node requires a URL");

      const method = (cfg.method || "GET").toUpperCase();

      let headers: Record<string, string> = {};
      const rawHeaders = cfg.headers || "";
      if (rawHeaders.trim()) {
        try {
          const interpolatedHeaders = interpolate(rawHeaders, state, globalsList, secretsList);
          headers = JSON.parse(interpolatedHeaders);
        } catch (e) {
          throw new Error(`Failed to parse HTTP headers JSON: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      let body: string | undefined;
      const rawBody = cfg.body || "";
      if (rawBody.trim() && method !== "GET" && method !== "HEAD") {
        body = interpolate(rawBody, state, globalsList, secretsList);
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
    case "note": {
      return {
        note: cfg.content || "Sticky Note",
        color: cfg.color || "yellow",
        annotationOnly: true,
      };
    }
    case "transform": {
      const op = (cfg.operation || "json_map").toLowerCase();
      const sourcePath = (cfg.source_path || "state").trim();
      const targetKey = (cfg.target_key || "transformed_result").trim();
      const param = cfg.param || "";

      // Resolve source value
      let sourceVal: unknown;
      if (!sourcePath || sourcePath === "state") {
        sourceVal = state;
      } else {
        const cleanPath = sourcePath.startsWith("state.") ? sourcePath.slice(6) : sourcePath;
        sourceVal = getPath(state, cleanPath) ?? state.last_output;
      }

      let result: unknown;

      if (op === "pick_fields") {
        const fields = param.split(",").map((f) => f.trim()).filter(Boolean);
        if (typeof sourceVal === "object" && sourceVal !== null && !Array.isArray(sourceVal)) {
          const picked: Record<string, unknown> = {};
          const sourceObj = sourceVal as Record<string, unknown>;
          fields.forEach((f) => {
            if (f in sourceObj) picked[f] = sourceObj[f];
          });
          result = picked;
        } else {
          result = sourceVal;
        }
      } else if (op === "template_string") {
        result = interpolate(param, state, globalsList, secretsList);
      } else if (op === "set_keys") {
        let patch: Record<string, unknown> = {};
        if (param.trim()) {
          try {
            const interpolatedParam = interpolate(param, state, globalsList, secretsList);
            patch = JSON.parse(interpolatedParam);
          } catch {
            patch = { value: interpolate(param, state, globalsList, secretsList) };
          }
        }
        if (typeof sourceVal === "object" && sourceVal !== null && !Array.isArray(sourceVal)) {
          result = { ...(sourceVal as Record<string, unknown>), ...patch };
        } else {
          result = { ...patch };
        }
      } else if (op === "flatten_object") {
        if (typeof sourceVal === "object" && sourceVal !== null && !Array.isArray(sourceVal)) {
          result = flattenObject(sourceVal as Record<string, unknown>);
        } else {
          result = sourceVal;
        }
      } else {
        // Default json_map
        if (param.trim()) {
          try {
            const interpolatedParam = interpolate(param, state, globalsList, secretsList);
            const mapping = JSON.parse(interpolatedParam);
            if (typeof mapping === "object" && mapping !== null && !Array.isArray(mapping)) {
              const mappedObj: Record<string, unknown> = {};
              const sourceObj = (typeof sourceVal === "object" && sourceVal !== null ? sourceVal : state) as Record<string, unknown>;
              Object.entries(mapping as Record<string, string>).forEach(([newKey, origPath]) => {
                const cleanOrigPath = String(origPath).startsWith("state.") ? String(origPath).slice(6) : String(origPath);
                mappedObj[newKey] = getPath(sourceObj, cleanOrigPath) ?? getPath(state, cleanOrigPath) ?? origPath;
              });
              result = mappedObj;
            } else {
              result = mapping;
            }
          } catch {
            result = interpolate(param, state, globalsList, secretsList);
          }
        } else {
          result = sourceVal;
        }
      }

      state[targetKey] = result;
      return result;
    }
    case "loop": {
      const itemsPath = (cfg.items_path || "state.items").trim();
      const itemVar = (cfg.item_var || "item").trim();
      const outputKey = (cfg.output_key || "loop_results").trim();
      const template = cfg.transform_template || "";
      const maxIter = parseIntOr(cfg.max_iterations, 50);

      const cleanPath = itemsPath.startsWith("state.") ? itemsPath.slice(6) : itemsPath;
      const rawItems = getPath(state, cleanPath) ?? (cleanPath in state ? state[cleanPath] : undefined);

      let itemsArray: unknown[] = [];
      if (Array.isArray(rawItems)) {
        itemsArray = rawItems;
      } else if (rawItems !== undefined && rawItems !== null) {
        itemsArray = [rawItems];
      }

      const truncatedItems = itemsArray.slice(0, maxIter);
      const mappedResults: unknown[] = [];

      for (const item of truncatedItems) {
        const itemScope: Record<string, unknown> = { ...state, [itemVar]: item };
        if (!template.trim()) {
          mappedResults.push(item);
        } else if (template.includes("{{")) {
          let interpolated = template;
          if (globalsList) {
            globalsList.forEach((g) => {
              interpolated = interpolated.replace(new RegExp(`\\{\\{\\s*global\\.${g.key}\\s*\\}\\}`, "g"), g.value);
            });
          }
          if (secretsList) {
            secretsList.forEach((s) => {
              interpolated = interpolated.replace(new RegExp(`\\{\\{\\s*secret\\.${s.key}\\s*\\}\\}`, "g"), s.value);
            });
          }
          interpolated = interpolated.replace(new RegExp(`\\{\\{\\s*${itemVar}\\.([\\w.]+)\\s*\\}\\}`, "g"), (_m, prop) => {
            if (typeof item === "object" && item !== null) {
              const val = getPath(item as Record<string, unknown>, String(prop));
              return val === undefined ? "" : typeof val === "string" ? val : JSON.stringify(val);
            }
            return "";
          });
          interpolated = interpolated.replace(new RegExp(`\\{\\{\\s*${itemVar}\\s*\\}\\}`, "g"), () => {
            return typeof item === "string" ? item : JSON.stringify(item);
          });
          interpolated = interpolate(interpolated, state, globalsList, secretsList);
          mappedResults.push(interpolated);
        } else if (template.startsWith(`${itemVar}.`)) {
          const propPath = template.slice(itemVar.length + 1);
          if (typeof item === "object" && item !== null) {
            mappedResults.push(getPath(item as Record<string, unknown>, propPath) ?? null);
          } else {
            mappedResults.push(null);
          }
        } else {
          mappedResults.push(template);
        }
      }

      state[outputKey] = mappedResults;
      return { count: mappedResults.length, items: mappedResults };
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
export function pickGateway(node: Node<AgentNodeData>, gateways: Gateway[]): Gateway | null {
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
