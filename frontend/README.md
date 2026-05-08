# Agent Flow Canvas

> **Free, browser-based drag-and-drop wireframe builder for Python AI agent workflows.**
> Design, validate, and export production-ready agent pipelines — no install, no login.

[![Live Demo](https://img.shields.io/badge/live%20demo-open%20app-brightgreen)](https://p98pqg.lovable.app/)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)

---

## What is Agent Flow Canvas?

Agent Flow Canvas is a **visual workflow designer for Python AI agent pipelines**. It lets you drag and drop nodes onto a canvas, wire them together with typed edges, and instantly generate Python pseudocode that maps to frameworks like **LangGraph, LangChain, AutoGen, CrewAI**, or any custom Python agent architecture.

Think of it as a **whiteboard for AI agent design** — fast, frictionless, and shareable.

---

## Features

| Feature | Description |
|---|---|
| 🟦 **8 Node Types** | Trigger · LLM Agent · Tool Call · Condition/Router · Subagent · Memory R/W · Human-in-the-Loop · Output Sink |
| 🔗 **Typed Edges** | Label connections as `next`, `on_success`, `on_error`, `tool_result`, `true`, `false` |
| 📝 **Live Pseudocode** | Click *view pseudocode* → get Python code generated from your graph in real time |
| ✅ **Graph Validation** | Detects disconnected nodes, missing entry/exit points, and invalid topology |
| 📋 **JSON Import/Export** | Copy your workflow to clipboard as JSON; paste it back anywhere |
| ↩️ **Undo History** | Full undo stack (`Cmd/Ctrl+Z`) — never lose work |
| ⌨️ **Keyboard Shortcuts** | `Delete`/`Backspace` to remove selected node/edge · `Esc` to deselect · `⌘Z` to undo |
| 🌐 **Zero Install** | Runs entirely in the browser — Chrome, Firefox, Safari, Edge |

---

## Node Types

### 🔵 Trigger
Entry point for your agent pipeline. Accepts a webhook, cron schedule, or CLI invocation. Configurable with `source` and `input_schema`.

### 🧠 LLM Agent
A chat-completion reasoning step. Point it at any model (`gpt-5`, `claude-4`, `gemini-2`, etc.) and define its system/user prompt.

### 🔧 Tool Call
Invokes a Python function exposed to the agent. Specify the tool name and the argument mapping from agent state.

### 🔀 Condition / Router
Branches the workflow based on a predicate expression over the agent's state (e.g. `state.confidence > 0.7`). Outputs `true` and `false` edges.

### 👾 Subagent
Delegates a sub-task to a nested agent graph. Useful for composing multi-agent systems with specialized sub-pipelines.

### 🗃️ Memory R/W
Reads from or writes to persistent agent memory (e.g. a vector store or key-value store). Configurable operation (`read`/`write`) and memory key.

### 🙋 Human-in-the-Loop
Pauses execution and waits for human approval or input via Slack, a web UI, or any other channel.

### 🏁 Output / Sink
Terminal node. Returns the final result to a response, database, or downstream webhook.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:8080)
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

---

## How to Use

1. **Add nodes** — click a node type in the left palette to add it to the canvas.
2. **Connect nodes** — drag from an output handle (right side) to an input handle (left side) of another node.
3. **Label edges** — click an edge to select it, then click the label to cycle through flow types.
4. **Configure nodes** — select a node to open the inspector panel on the right; edit its name and config fields.
5. **Generate pseudocode** — click *view pseudocode* in the toolbar to see the Python representation of your graph.
6. **Validate** — click *validate* to check for structural issues. Problematic nodes are highlighted.
7. **Export** — click *export json* to copy the workflow to your clipboard; *import json* to restore it.

---

## Use Cases

- **Design agent pipelines before writing code** — sketch your LangGraph or AutoGen workflow visually
- **Onboarding & documentation** — share a canvas diagram with your team instead of a wall of code
- **Rapid prototyping** — iterate on multi-agent architectures without touching Python
- **Teaching & learning** — understand how agent flows work through a clear visual model

---

## Tech Stack

- **React 18** + **TypeScript**
- **React Flow (ReactFlow)** — node/edge canvas engine
- **Tailwind CSS** — utility-first styling
- **Vite** — build tooling
- **Shadcn/ui** — accessible component primitives
- **Vitest** — unit testing

---

## Development

```bash
npm run lint       # ESLint
npm run build      # Production build
npm test           # Unit tests (Vitest)
```

---

## License

MIT — free to use, modify, and distribute.

---

## Keywords

`ai agent workflow` · `python agent pipeline` · `langgraph visual editor` · `langchain diagram` · `autogen workflow designer` · `drag and drop ai` · `multi-agent orchestration` · `llm workflow builder` · `agent flow canvas` · `python ai tools` · `agentic ai` · `agent framework visual`

