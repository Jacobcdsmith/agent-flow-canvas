import { Edge, Node } from "reactflow";
import { AgentNodeData } from "./types";

export const exampleNodes: Node<AgentNodeData>[] = [
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
];

export const exampleEdges: Edge[] = [
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
];