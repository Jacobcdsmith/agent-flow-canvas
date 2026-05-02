// MCP-style gateway runner for the visual agent flow.
// Accepts a serialized graph { nodes, edges, initialState } and executes it
// topologically, routing LLM nodes through the Lovable AI Gateway.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type NodeKind =
  | "trigger"
  | "llm"
  | "tool"
  | "router"
  | "subagent"
  | "memory"
  | "human"
  | "sink";

interface FlowNode {
  id: string;
  data: {
    kind: NodeKind;
    name: string;
    config?: Record<string, string>;
    isEntry?: boolean;
    isTerminal?: boolean;
  };
}
interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface RunBody {
  nodes: FlowNode[];
  edges: FlowEdge[];
  initialState?: Record<string, unknown>;
  maxSteps?: number;
}

interface LogEntry {
  step: number;
  nodeId: string;
  name: string;
  kind: NodeKind;
  label: string;
  output?: unknown;
  error?: string;
  ms: number;
}

async function callLovableAI(model: string, prompt: string, userInput: unknown) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: prompt || "You are a helpful agent in a workflow." },
        { role: "user", content: typeof userInput === "string" ? userInput : JSON.stringify(userInput) },
      ],
    }),
  });

  if (resp.status === 429) throw new Error("Rate limit exceeded — try again shortly");
  if (resp.status === 402) throw new Error("AI credits exhausted — top up workspace");
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${t.slice(0, 200)}`);
  }
  const j = await resp.json();
  return j.choices?.[0]?.message?.content ?? "";
}

function pickEntry(nodes: FlowNode[]): string | null {
  return (
    nodes.find((n) => n.data.isEntry)?.id ??
    nodes.find((n) => n.data.kind === "trigger")?.id ??
    nodes[0]?.id ??
    null
  );
}

async function executeNode(
  node: FlowNode,
  state: Record<string, unknown>,
): Promise<{ label: string; output: unknown }> {
  const c = node.data.config ?? {};
  switch (node.data.kind) {
    case "trigger":
      return { label: "next", output: { source: c.source ?? "manual" } };
    case "llm": {
      const out = await callLovableAI(c.model ?? "", c.prompt ?? "", state.last ?? state);
      state.last = out;
      return { label: "on_success", output: out };
    }
    case "tool": {
      const out = { tool: c.tool ?? "noop", args: c.args ?? "", echoed: state.last ?? null };
      state.last = out;
      return { label: "tool_result", output: out };
    }
    case "router": {
      const decision = !!state.last;
      return { label: decision ? "true" : "false", output: { predicate: c.predicate, decision } };
    }
    case "subagent": {
      const out = { subgraph: c.graph ?? "sub", input: c.input, payload: state.last };
      state.last = out;
      return { label: "on_success", output: out };
    }
    case "memory": {
      const op = c.op ?? "read";
      const key = c.key ?? "key";
      if (op === "write") {
        (state as any)[`mem::${key}`] = state.last;
        return { label: "next", output: { wrote: key } };
      }
      return { label: "next", output: { read: key, value: (state as any)[`mem::${key}`] ?? null } };
    }
    case "human":
      return { label: "next", output: { channel: c.channel, prompt: c.prompt, decision: "auto-approved" } };
    case "sink":
      return { label: "next", output: { target: c.target ?? "response", final: state.last } };
  }
}

async function runGraph(body: RunBody): Promise<{ logs: LogEntry[]; state: Record<string, unknown>; ok: boolean; error?: string }> {
  const { nodes, edges } = body;
  const state: Record<string, unknown> = { ...(body.initialState ?? {}), last: null };
  const maxSteps = body.maxSteps ?? 32;
  const logs: LogEntry[] = [];

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, FlowEdge[]>();
  edges.forEach((e) => {
    if (!out.has(e.source)) out.set(e.source, []);
    out.get(e.source)!.push(e);
  });

  const entry = pickEntry(nodes);
  if (!entry) return { logs, state, ok: false, error: "No entry node" };

  let current: string | null = entry;
  for (let step = 0; step < maxSteps && current; step++) {
    const node = byId.get(current);
    if (!node) {
      return { logs, state, ok: false, error: `Unknown node ${current}` };
    }
    const t0 = Date.now();
    let label = "next";
    let output: unknown = null;
    let error: string | undefined;
    try {
      const r = await executeNode(node, state);
      label = r.label;
      output = r.output;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      label = "on_error";
      state.last = { error };
    }
    logs.push({
      step,
      nodeId: node.id,
      name: node.data.name,
      kind: node.data.kind,
      label,
      output,
      error,
      ms: Date.now() - t0,
    });
    if (node.data.isTerminal || node.data.kind === "sink") break;
    const outs = out.get(current) ?? [];
    const nxt = outs.find((e) => e.label === label) ?? outs.find((e) => (e.label ?? "next") === "next");
    current = nxt?.target ?? null;
  }

  return { logs, state, ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as RunBody;
    if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
      return new Response(JSON.stringify({ ok: false, error: "Body must be { nodes, edges }" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = await runGraph(body);
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
