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
  configFields: {
    key: string;
    label: string;
    placeholder: string;
    type?: "input" | "textarea" | "select";
    options?: string[];
  }[];
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
      { key: "prompt", label: "prompt", placeholder: "You are a helpful agent…", type: "textarea" },
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
    description: "Makes a live client-side HTTP request and returns the response.",
    defaultName: "http_request",
    configFields: [
      { key: "url", label: "url", placeholder: "https://api.github.com/users/{{state.username}}" },
      { key: "method", label: "method", placeholder: "GET", type: "select", options: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"] },
      { key: "headers", label: "headers", placeholder: '{"Content-Type": "application/json"}', type: "textarea" },
      { key: "body", label: "body", placeholder: '{"query": "{{state.query}}"}', type: "textarea" },
    ],
  },
  {
    kind: "script",
    label: "JS Script",
    description: "Executes custom sandboxed JavaScript code against execution state.",
    defaultName: "js_script",
    configFields: [
      { key: "code", label: "code", placeholder: "state.query = state.query.toUpperCase();\nreturn state;", type: "textarea" },
    ],
  },
];

export const EDGE_LABELS = ["next", "on_success", "on_error", "tool_result", "true", "false"] as const;
export type EdgeLabel = (typeof EDGE_LABELS)[number];
