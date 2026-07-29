import { Node, Edge } from "reactflow";
import { AgentNodeData } from "./types";

export interface SavedWorkflow {
  id: string;
  name: string;
  description: string;
  nodes: Node<AgentNodeData>[];
  edges: Edge[];
  updatedAt: string;
}

const WORKFLOWS_STORAGE_KEY = "agent_flow.workflows.v1";
const ACTIVE_WORKFLOW_ID_KEY = "agent_flow.active_workflow_id.v1";

// Default templates provided to the user
export const TEMPLATES: Omit<SavedWorkflow, "updatedAt">[] = [
  {
    id: "template-react-loop",
    name: "ReAct Loop",
    description: "An agentic loop that reasons using an LLM, invokes tools, reads/writes memory, and obtains human approval.",
    nodes: [
      {
        id: "trigger",
        type: "agent",
        position: { x: 360, y: 20 },
        data: {
          kind: "trigger",
          name: "on_user_query",
          isEntry: true,
          config: { source: "webhook", schema: "{ query: str }" },
        },
      },
      {
        id: "mem_read",
        type: "agent",
        position: { x: 360, y: 170 },
        data: {
          kind: "memory",
          name: "load_history",
          config: { op: "read", key: "session.history" },
        },
      },
      {
        id: "react",
        type: "agent",
        position: { x: 360, y: 320 },
        data: {
          kind: "llm",
          name: "react_loop",
          config: { model: "gpt-5", prompt: "Reason → Act. Use tools when useful." },
        },
      },
      {
        id: "router",
        type: "agent",
        position: { x: 360, y: 480 },
        data: {
          kind: "router",
          name: "needs_tool",
          config: { predicate: "state.action == 'tool'" },
        },
      },
      {
        id: "tool",
        type: "agent",
        position: { x: 80, y: 640 },
        data: {
          kind: "tool",
          name: "search_web",
          config: { tool: "search_web", args: "{ q: state.query }" },
        },
      },
      {
        id: "fallback",
        type: "agent",
        position: { x: 640, y: 640 },
        data: {
          kind: "subagent",
          name: "fallback_researcher",
          config: { graph: "deep_research", input: "state.query" },
        },
      },
      {
        id: "human",
        type: "agent",
        position: { x: 640, y: 800 },
        data: {
          kind: "human",
          name: "approve_answer",
          config: { channel: "slack", prompt: "Ship this response?" },
        },
      },
      {
        id: "mem_write",
        type: "agent",
        position: { x: 360, y: 960 },
        data: {
          kind: "memory",
          name: "persist_turn",
          config: { op: "write", key: "session.history" },
        },
      },
      {
        id: "sink",
        type: "agent",
        position: { x: 360, y: 1110 },
        data: {
          kind: "sink",
          name: "return_response",
          isTerminal: true,
          config: { target: "response" },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "mem_read", label: "next", type: "smoothstep" },
      { id: "e2", source: "mem_read", target: "react", label: "next", type: "smoothstep" },
      { id: "e3", source: "react", target: "router", label: "on_success", type: "smoothstep" },
      { id: "e4", source: "router", target: "tool", label: "true", type: "smoothstep" },
      { id: "e5", source: "router", target: "fallback", label: "false", type: "smoothstep" },
      { id: "e6", source: "tool", target: "react", label: "tool_result", type: "smoothstep" },
      { id: "e7", source: "fallback", target: "human", label: "on_success", type: "smoothstep" },
      { id: "e8", source: "human", target: "mem_write", label: "next", type: "smoothstep" },
      { id: "e9", source: "react", target: "mem_write", label: "on_error", type: "smoothstep" },
      { id: "e10", source: "mem_write", target: "sink", label: "next", type: "smoothstep" },
    ],
  },
  {
    id: "template-http-router",
    name: "HTTP Router",
    description: "Fetches live data from an HTTP API, routes on status, executes processing scripts, and outputs results.",
    nodes: [
      {
        id: "trigger",
        type: "agent",
        position: { x: 250, y: 50 },
        data: {
          kind: "trigger",
          name: "on_api_call",
          isEntry: true,
          config: { source: "webhook", schema: "{ username: str }" },
        },
      },
      {
        id: "http_get",
        type: "agent",
        position: { x: 250, y: 200 },
        data: {
          kind: "http",
          name: "fetch_user",
          config: {
            url: "https://api.github.com/users/{{state.username}}",
            method: "GET",
            headers: '{"Content-Type": "application/json"}',
          },
        },
      },
      {
        id: "router",
        type: "agent",
        position: { x: 250, y: 350 },
        data: {
          kind: "router",
          name: "is_successful",
          config: { predicate: "state.last_output.status == 200" },
        },
      },
      {
        id: "js_script",
        type: "agent",
        position: { x: 100, y: 500 },
        data: {
          kind: "script",
          name: "format_payload",
          config: {
            code: "state.formatted = {\n  login: state.last_output.data.login,\n  name: state.last_output.data.name || 'Anonymous',\n  public_repos: state.last_output.data.public_repos\n};\nreturn state;",
          },
        },
      },
      {
        id: "error_log",
        type: "agent",
        position: { x: 400, y: 500 },
        data: {
          kind: "script",
          name: "log_error",
          config: {
            code: "state.error = 'Failed to fetch GitHub user ' + state.username;\nreturn state;",
          },
        },
      },
      {
        id: "sink_success",
        type: "agent",
        position: { x: 100, y: 650 },
        data: {
          kind: "sink",
          name: "success_out",
          isTerminal: true,
          config: { target: "db" },
        },
      },
      {
        id: "sink_fail",
        type: "agent",
        position: { x: 400, y: 650 },
        data: {
          kind: "sink",
          name: "fail_out",
          isTerminal: true,
          config: { target: "webhook" },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "http_get", label: "next", type: "smoothstep" },
      { id: "e2", source: "http_get", target: "router", label: "next", type: "smoothstep" },
      { id: "e3", source: "router", target: "js_script", label: "true", type: "smoothstep" },
      { id: "e4", source: "router", target: "error_log", label: "false", type: "smoothstep" },
      { id: "e5", source: "js_script", target: "sink_success", label: "next", type: "smoothstep" },
      { id: "e6", source: "error_log", target: "sink_fail", label: "next", type: "smoothstep" },
    ],
  },
  {
    id: "template-translation-hitl",
    name: "Translation HITL",
    description: "Takes source text, translates it via an LLM agent, pauses for human review/edits, and outputs a finalized translation.",
    nodes: [
      {
        id: "trigger",
        type: "agent",
        position: { x: 250, y: 50 },
        data: {
          kind: "trigger",
          name: "translation_request",
          isEntry: true,
          config: { source: "webhook", schema: "{ query: str, target_lang: str }" },
        },
      },
      {
        id: "translate",
        type: "agent",
        position: { x: 250, y: 200 },
        data: {
          kind: "llm",
          name: "initial_translation",
          config: {
            model: "gpt-4o-mini",
            prompt: "Translate the user query to {{state.target_lang}}. Provide ONLY the direct translation output.",
          },
        },
      },
      {
        id: "human_review",
        type: "agent",
        position: { x: 250, y: 350 },
        data: {
          kind: "human",
          name: "human_review",
          config: {
            channel: "ui",
            prompt: "Review initial translation:\n\"{{state.last_output.text}}\"\n\nAccept as-is, reject to abort, or type custom feedback/correction to refine.",
          },
        },
      },
      {
        id: "refine_router",
        type: "agent",
        position: { x: 250, y: 500 },
        data: {
          kind: "router",
          name: "needs_refinement",
          config: {
            predicate: "state.last_output.decision != 'approved' && state.last_output.decision != 'rejected' && state.last_output.decision != 'aborted'",
          },
        },
      },
      {
        id: "refine_translation",
        type: "agent",
        position: { x: 50, y: 650 },
        data: {
          kind: "llm",
          name: "refine_translation",
          config: {
            model: "gpt-4o-mini",
            prompt: "The human reviewer provided feedback/corrections for the translation. Refine the translation based on this feedback.\n\nFeedback: {{state.last_output.decision}}\nOriginal Query: {{state.query}}\nTarget Language: {{state.target_lang}}",
          },
        },
      },
      {
        id: "sink",
        type: "agent",
        position: { x: 250, y: 800 },
        data: {
          kind: "sink",
          name: "publish_translation",
          isTerminal: true,
          config: { target: "response" },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "translate", label: "next", type: "smoothstep" },
      { id: "e2", source: "translate", target: "human_review", label: "on_success", type: "smoothstep" },
      { id: "e3", source: "human_review", target: "refine_router", label: "next", type: "smoothstep" },
      { id: "e4", source: "refine_router", target: "refine_translation", label: "true", type: "smoothstep" },
      { id: "e5", source: "refine_router", target: "sink", label: "false", type: "smoothstep" },
      { id: "e6", source: "refine_translation", target: "sink", label: "on_success", type: "smoothstep" },
    ],
  },
];

export function loadWorkflows(): SavedWorkflow[] {
  try {
    const raw = localStorage.getItem(WORKFLOWS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveWorkflows(workflows: SavedWorkflow[]) {
  try {
    localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(workflows));
  } catch {
    /* ignore */
  }
}

export function getActiveWorkflowId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_WORKFLOW_ID_KEY);
  } catch {
    return null;
  }
}

export function setActiveWorkflowId(id: string | null) {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_WORKFLOW_ID_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_WORKFLOW_ID_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "wf_" + Math.random().toString(36).slice(2, 10);
}
