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
  {
    id: "template-chronicle-tips",
    name: "/chronicle Tips Review",
    description: "Review recent session history, extract usage patterns, and generate personalized workflow tips.",
    isTemplate: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    nodes: [
      {
        id: "chronicle-trigger",
        type: "agent",
        position: { x: 360, y: 20 },
        data: {
          kind: "trigger",
          name: "on_chronicle_request",
          isEntry: true,
          config: {
            source: "manual",
            schema: "{ query: str, session_history: [{ title: str, summary: str, tools: str[] }] }",
          },
        },
      },
      {
        id: "chronicle-note",
        type: "agent",
        position: { x: 40, y: 130 },
        data: {
          kind: "note",
          name: "chronicle_instructions",
          config: {
            color: "blue",
            content:
              "Paste recent Copilot sessions into state.session_history. Each item can include title, summary, and tools. The workflow will extract patterns first, then write concise /chronicle-style tips.",
          },
        },
      },
      {
        id: "chronicle-script",
        type: "agent",
        position: { x: 360, y: 150 },
        data: {
          kind: "script",
          name: "summarize_usage_patterns",
          config: {
            code:
              "const sessions = Array.isArray(state.session_history) ? state.session_history : [];\nconst toolUsage = sessions.reduce((acc, session) => {\n  const tools = Array.isArray(session?.tools) ? session.tools : [];\n  tools.forEach((tool) => {\n    const key = String(tool || '').trim();\n    if (!key) return;\n    acc[key] = (acc[key] || 0) + 1;\n  });\n  return acc;\n}, {});\nconst topTools = Object.entries(toolUsage)\n  .sort((a, b) => Number(b[1]) - Number(a[1]))\n  .slice(0, 5)\n  .map(([name, count]) => `${name}:${count}`);\nstate.session_count = sessions.length;\nstate.top_tools = topTools;\nstate.history_excerpt = sessions\n  .map((session, index) => {\n    const title = session?.title || session?.name || `Session ${index + 1}`;\n    const summary = session?.summary || 'No summary provided';\n    const tools = Array.isArray(session?.tools) && session.tools.length ? ` [tools: ${session.tools.join(', ')}]` : '';\n    return `${index + 1}. ${title} — ${summary}${tools}`;\n  })\n  .join('\\n');\nreturn { sessions: state.session_count, top_tools: state.top_tools, history_excerpt: state.history_excerpt };",
          },
        },
      },
      {
        id: "chronicle-router",
        type: "agent",
        position: { x: 360, y: 310 },
        data: {
          kind: "router",
          name: "enough_history",
          config: {
            predicate: "Array.isArray(state.session_history) && state.session_history.length >= 2",
          },
        },
      },
      {
        id: "chronicle-llm",
        type: "agent",
        position: { x: 360, y: 470 },
        data: {
          kind: "llm",
          name: "generate_chronicle_tips",
          config: {
            model: "gpt-5",
            prompt:
              "You are /chronicle tips. Review the user's recent coding sessions and respond with: (1) strengths to keep, (2) 3 personalized tips, and (3) one next experiment. Be concise and actionable.\n\nRecent sessions:\n{{state.history_excerpt}}\n\nTop tools: {{state.top_tools}}\n\nUser request: {{state.query}}",
          },
        },
      },
      {
        id: "chronicle-fallback",
        type: "agent",
        position: { x: 80, y: 470 },
        data: {
          kind: "script",
          name: "draft_offline_tips",
          config: {
            code:
              "const topTools = Array.isArray(state.top_tools) ? state.top_tools.join(', ') : 'none yet';\nreturn {\n  text: `Strengths to keep: consistent exploration. Personalized tips: batch more searches, delegate long-running work sooner, and save durable memories more often. Next experiment: start each session by planning validation before editing. Top tools seen: ${topTools}.`,\n  source: 'offline-fallback'\n};",
          },
        },
      },
      {
        id: "chronicle-missing-history",
        type: "agent",
        position: { x: 640, y: 470 },
        data: {
          kind: "script",
          name: "request_more_history",
          config: {
            code:
              "return { text: 'Add at least two session_history entries in the initial state to get personalized /chronicle tips.', source: 'validator' };",
          },
        },
      },
      {
        id: "chronicle-memory",
        type: "agent",
        position: { x: 220, y: 630 },
        data: {
          kind: "memory",
          name: "save_latest_tips",
          config: { op: "write", key: "chronicle.tips.latest" },
        },
      },
      {
        id: "chronicle-sink",
        type: "agent",
        position: { x: 220, y: 790 },
        data: {
          kind: "sink",
          name: "return_tips",
          isTerminal: true,
          config: { target: "response" },
        },
      },
    ],
    edges: [
      { id: "ce1", source: "chronicle-trigger", target: "chronicle-script", label: "next", type: "smoothstep" },
      { id: "ce2", source: "chronicle-script", target: "chronicle-router", label: "next", type: "smoothstep" },
      { id: "ce3", source: "chronicle-router", target: "chronicle-llm", label: "true", type: "smoothstep" },
      { id: "ce4", source: "chronicle-router", target: "chronicle-missing-history", label: "false", type: "smoothstep" },
      { id: "ce5", source: "chronicle-llm", target: "chronicle-memory", label: "on_success", type: "smoothstep" },
      { id: "ce6", source: "chronicle-llm", target: "chronicle-fallback", label: "on_error", type: "smoothstep" },
      { id: "ce7", source: "chronicle-fallback", target: "chronicle-memory", label: "next", type: "smoothstep" },
      { id: "ce8", source: "chronicle-missing-history", target: "chronicle-sink", label: "next", type: "smoothstep" },
      { id: "ce9", source: "chronicle-memory", target: "chronicle-sink", label: "next", type: "smoothstep" },
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
