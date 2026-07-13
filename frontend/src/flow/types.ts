export type AgentNodeKind =
  | "trigger"
  | "llm"
  | "tool"
  | "router"
  | "subagent"
  | "memory"
  | "human"
  | "sink"
  | "http"
  | "script";

export interface AgentNodeData {
  kind: AgentNodeKind;
  name: string;
  config: Record<string, string>;
  isEntry?: boolean;
  isTerminal?: boolean;
  /** Optional override: which gateway (provider profile) this LLM node uses */
  gatewayId?: string;
}

export interface NodeTypeMeta {
  kind: AgentNodeKind;
  label: string;
  description: string;
  defaultName: string;
  configFields: { key: string; label: string; placeholder: string }[];
  isEntry?: boolean;
  isTerminal?: boolean;
}

export const NODE_TYPES: NodeTypeMeta[] = [
  {
    kind: "trigger",
    label: "Trigger",
    description: "Entry point. Webhook, schedule, or manual invocation.",
    defaultName: "on_request",
    configFields: [
      { key: "source", label: "source", placeholder: "webhook | cron | cli" },
      { key: "schema", label: "input_schema", placeholder: "{ query: str }" },
    ],
    isEntry: true,
  },
  {
    kind: "llm",
    label: "LLM Agent",
    description: "Reasoning step. Calls a chat completion model with a prompt.",
    defaultName: "reason",
    configFields: [
      { key: "model", label: "model", placeholder: "gpt-5 | claude-4" },
      { key: "prompt", label: "prompt", placeholder: "You are a helpful agent…" },
      { key: "temperature", label: "temperature", placeholder: "(global)  e.g. 0.7" },
      { key: "max_tokens", label: "max_tokens", placeholder: "(global)  e.g. 1024" },
    ],
  },
  {
    kind: "tool",
    label: "Tool Call",
    description: "Invoke a Python function exposed to the agent.",
    defaultName: "call_tool",
    configFields: [
      { key: "tool", label: "tool", placeholder: "search_web" },
      { key: "args", label: "args", placeholder: "{ q: state.query }" },
    ],
  },
  {
    kind: "router",
    label: "Condition / Router",
    description: "Branches the flow based on a predicate over state.",
    defaultName: "decide",
    configFields: [
      { key: "predicate", label: "predicate", placeholder: "state.confidence > 0.7" },
    ],
  },
  {
    kind: "subagent",
    label: "Subagent",
    description: "Delegates a sub-task to a nested agent graph.",
    defaultName: "subagent",
    configFields: [
      { key: "graph", label: "graph", placeholder: "researcher_graph" },
      { key: "input", label: "input", placeholder: "state.subtask" },
    ],
  },
  {
    kind: "memory",
    label: "Memory R/W",
    description: "Read from or write to persistent agent memory.",
    defaultName: "memory",
    configFields: [
      { key: "op", label: "op", placeholder: "read | write" },
      { key: "key", label: "key", placeholder: "session.history" },
    ],
  },
  {
    kind: "human",
    label: "Human-in-the-Loop",
    description: "Pauses execution awaiting human approval or input.",
    defaultName: "await_human",
    configFields: [
      { key: "channel", label: "channel", placeholder: "slack | ui" },
      { key: "prompt", label: "prompt", placeholder: "Approve this action?" },
    ],
  },
  {
    kind: "sink",
    label: "Output / Sink",
    description: "Terminal node. Returns or persists the final result.",
    defaultName: "return_result",
    configFields: [
      { key: "target", label: "target", placeholder: "response | db | webhook" },
    ],
    isTerminal: true,
  },
  {
    kind: "http",
    label: "HTTP Request",
    description: "Execute a client-side HTTP/HTTPS web request with custom config.",
    defaultName: "web_request",
    configFields: [
      { key: "method", label: "method", placeholder: "GET | POST | PUT | DELETE" },
      { key: "url", label: "url", placeholder: "https://api.example.com/v1/data" },
      { key: "headers", label: "headers (json)", placeholder: '{"Authorization": "Bearer token"}' },
      { key: "body", label: "body", placeholder: '{"query": "{{state.query}}"}' },
    ],
  },
  {
    kind: "script",
    label: "JS Script",
    description: "Execute custom sandboxed JavaScript to modify state or compute labels.",
    defaultName: "js_code",
    configFields: [
      { key: "code", label: "code", placeholder: "state.processed = true;\nreturn 'on_success';" },
    ],
  },
];

export const EDGE_LABELS = ["next", "on_success", "on_error", "tool_result", "true", "false"] as const;
export type EdgeLabel = (typeof EDGE_LABELS)[number];