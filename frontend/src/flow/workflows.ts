import { Edge, Node } from "reactflow";
import { AgentNodeData } from "./types";

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: Node<AgentNodeData>[];
  edges: Edge[];
  createdAt: number;
  updatedAt: number;
  isTemplate?: boolean;
}

const WORKFLOWS_STORAGE_KEY = "agent_flow.workflows.v1";
const ACTIVE_ID_STORAGE_KEY = "agent_flow.active_workflow_id.v1";

export const TEMPLATES: Workflow[] = [
  {
    id: "template-react",
    name: "ReAct Agent Loop",
    description: "Reasoning and acting cycle using a tool and fallback research subgraph.",
    isTemplate: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    nodes: [
      {
        id: "react-trigger",
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
        id: "react-mem-read",
        type: "agent",
        position: { x: 360, y: 150 },
        data: {
          kind: "memory",
          name: "load_history",
          config: { op: "read", key: "session.history" },
        },
      },
      {
        id: "react-llm",
        type: "agent",
        position: { x: 360, y: 280 },
        data: {
          kind: "llm",
          name: "react_loop",
          config: { model: "gpt-4o-mini", prompt: "You are a ReAct loop agent. Decide if we need search_web." },
        },
      },
      {
        id: "react-router",
        type: "agent",
        position: { x: 360, y: 410 },
        data: {
          kind: "router",
          name: "needs_tool",
          config: { predicate: "state.last_output && state.last_output.text && state.last_output.text.includes('search_web')" },
        },
      },
      {
        id: "react-tool",
        type: "agent",
        position: { x: 100, y: 540 },
        data: {
          kind: "tool",
          name: "search_web",
          config: { tool: "search_web", args: "{ q: state.query }" },
        },
      },
      {
        id: "react-fallback",
        type: "agent",
        position: { x: 620, y: 540 },
        data: {
          kind: "subagent",
          name: "fallback_researcher",
          config: { graph: "deep_research", input: "state.query" },
        },
      },
      {
        id: "react-sink",
        type: "agent",
        position: { x: 360, y: 700 },
        data: {
          kind: "sink",
          name: "return_response",
          isTerminal: true,
          config: { target: "response" },
        },
      },
    ],
    edges: [
      { id: "re1", source: "react-trigger", target: "react-mem-read", label: "next", type: "smoothstep" },
      { id: "re2", source: "react-mem-read", target: "react-llm", label: "next", type: "smoothstep" },
      { id: "re3", source: "react-llm", target: "react-router", label: "on_success", type: "smoothstep" },
      { id: "re4", source: "react-router", target: "react-tool", label: "true", type: "smoothstep" },
      { id: "re5", source: "react-router", target: "react-fallback", label: "false", type: "smoothstep" },
      { id: "re6", source: "react-tool", target: "react-llm", label: "tool_result", type: "smoothstep" },
      { id: "re7", source: "react-fallback", target: "react-sink", label: "on_success", type: "smoothstep" },
    ],
  },
  {
    id: "template-http-router",
    name: "HTTP API & JS Router",
    description: "Fetches live user details, mutates payload with JavaScript, and routes to appropriate target.",
    isTemplate: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    nodes: [
      {
        id: "api-trigger",
        type: "agent",
        position: { x: 360, y: 20 },
        data: {
          kind: "trigger",
          name: "api_trigger",
          isEntry: true,
          config: { source: "webhook", schema: "{ username: str }" },
        },
      },
      {
        id: "api-http",
        type: "agent",
        position: { x: 360, y: 150 },
        data: {
          kind: "http",
          name: "fetch_github_user",
          config: {
            url: "https://api.github.com/users/{{state.username}}",
            method: "GET",
            headers: '{"User-Agent": "agent_flow_canvas"}',
          },
        },
      },
      {
        id: "api-script",
        type: "agent",
        position: { x: 360, y: 280 },
        data: {
          kind: "script",
          name: "normalize_payload",
          config: {
            code: "state.has_bio = !!(state.last_output && state.last_output.data && state.last_output.data.bio);\nstate.user_followers = (state.last_output && state.last_output.data) ? state.last_output.data.followers : 0;\nreturn state;",
          },
        },
      },
      {
        id: "api-router",
        type: "agent",
        position: { x: 360, y: 410 },
        data: {
          kind: "router",
          name: "has_followers",
          config: { predicate: "state.user_followers > 10" },
        },
      },
      {
        id: "api-sink-popular",
        type: "agent",
        position: { x: 180, y: 550 },
        data: {
          kind: "sink",
          name: "route_popular",
          isTerminal: true,
          config: { target: "popular_users" },
        },
      },
      {
        id: "api-sink-standard",
        type: "agent",
        position: { x: 540, y: 550 },
        data: {
          kind: "sink",
          name: "route_standard",
          isTerminal: true,
          config: { target: "standard_users" },
        },
      },
    ],
    edges: [
      { id: "he1", source: "api-trigger", target: "api-http", label: "next", type: "smoothstep" },
      { id: "he2", source: "api-http", target: "api-script", label: "next", type: "smoothstep" },
      { id: "he3", source: "api-script", target: "api-router", label: "next", type: "smoothstep" },
      { id: "he4", source: "api-router", target: "api-sink-popular", label: "true", type: "smoothstep" },
      { id: "he5", source: "api-router", target: "api-sink-standard", label: "false", type: "smoothstep" },
    ],
  },
  {
    id: "template-translation-hitl",
    name: "Translation with Human-in-the-Loop",
    description: "Translates input text using an LLM, pauses for a human proofread/feedback, and refines if feedback is submitted.",
    isTemplate: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    nodes: [
      {
        id: "trans-trigger",
        type: "agent",
        position: { x: 360, y: 20 },
        data: {
          kind: "trigger",
          name: "on_translate_request",
          isEntry: true,
          config: { source: "manual", schema: "{ query: str }" },
        },
      },
      {
        id: "trans-llm-initial",
        type: "agent",
        position: { x: 360, y: 150 },
        data: {
          kind: "llm",
          name: "translate_to_french",
          config: {
            model: "gpt-4o-mini",
            prompt: "Translate the user query text into beautiful French. Be concise.",
          },
        },
      },
      {
        id: "trans-hitl",
        type: "agent",
        position: { x: 360, y: 280 },
        data: {
          kind: "human",
          name: "proofread_translation",
          config: {
            channel: "ui",
            prompt: "Please review this translation. Approve to ship, or reject/feedback to suggest changes:\n{{state.last_output.text}}",
          },
        },
      },
      {
        id: "trans-router",
        type: "agent",
        position: { x: 360, y: 410 },
        data: {
          kind: "router",
          name: "is_approved",
          config: {
            predicate: "state.last_output && state.last_output.decision === 'approved'",
          },
        },
      },
      {
        id: "trans-llm-refine",
        type: "agent",
        position: { x: 100, y: 540 },
        data: {
          kind: "llm",
          name: "refine_translation",
          config: {
            model: "gpt-4o-mini",
            prompt: "Refine the translation using the human feedback: '{{state.last_output.decision}}'. Target sentence was: '{{state.query}}'. Make sure to apply their changes.",
          },
        },
      },
      {
        id: "trans-sink",
        type: "agent",
        position: { x: 540, y: 540 },
        data: {
          kind: "sink",
          name: "ship_translation",
          isTerminal: true,
          config: { target: "db" },
        },
      },
    ],
    edges: [
      { id: "te1", source: "trans-trigger", target: "trans-llm-initial", label: "next", type: "smoothstep" },
      { id: "te2", source: "trans-llm-initial", target: "trans-hitl", label: "on_success", type: "smoothstep" },
      { id: "te3", source: "trans-hitl", target: "trans-router", label: "next", type: "smoothstep" },
      { id: "te4", source: "trans-router", target: "trans-llm-refine", label: "false", type: "smoothstep" },
      { id: "te5", source: "trans-router", target: "trans-sink", label: "true", type: "smoothstep" },
      { id: "te6", source: "trans-llm-refine", target: "trans-sink", label: "on_success", type: "smoothstep" },
    ],
  },
];

export function loadWorkflows(): Workflow[] {
  try {
    const raw = localStorage.getItem(WORKFLOWS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Failed to load workflows:", e);
  }
  return [];
}

export function saveWorkflows(wfs: Workflow[]): void {
  try {
    localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(wfs));
  } catch (e) {
    console.error("Failed to save workflows:", e);
  }
}

export function loadActiveWorkflowId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveWorkflowId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_ID_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_ID_STORAGE_KEY);
    }
  } catch (e) {
    console.error("Failed to save active workflow ID:", e);
  }
}

export function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "wf_" + Math.random().toString(36).slice(2, 10);
}
