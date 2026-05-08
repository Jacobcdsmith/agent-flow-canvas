# agent_flow.canvas

A lightweight, **browser-based**, **open-source** visual builder for AI agent
workflows.

- **No download. No install. No login.**
- **BYO API keys.** Add as many gateways/providers as you want — keys live only
  in your browser's `localStorage`.
- **No backend required.** LLM nodes call providers (OpenAI, Anthropic, Gemini,
  Ollama, or any OpenAI-compatible base URL) directly from your tab.
- **Generates runnable Python / JavaScript** code from your graph for export.

## Run locally

```bash
cd frontend
yarn install
yarn dev      # http://localhost:8080
# or
yarn start    # http://localhost:3000 (binds 0.0.0.0)
```

The whole app is a static SPA. Build with `yarn build` and host the `dist/` on
GitHub Pages, Cloudflare Pages, Netlify, S3, or any static host.

## Supported providers

| Provider | Base URL default | Auth |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `Authorization: Bearer …` |
| OpenAI-compatible (OpenRouter, Groq, Together, vLLM, LM Studio…) | configurable | `Authorization: Bearer …` |
| Anthropic Claude | `https://api.anthropic.com` | `x-api-key` + `anthropic-dangerous-direct-browser-access` (sent automatically) |
| Google Gemini | `https://generativelanguage.googleapis.com` | `?key=…` |
| Ollama (local) | `http://localhost:11434` | none — start Ollama with `OLLAMA_ORIGINS=*` for browser CORS |

## Privacy

API keys are stored in `localStorage` under `agent_flow.gateways.v2`. They are
**never** transmitted anywhere except directly to the provider you configure.
Use the **clear all keys** button in the Gateways panel to wipe them at any
time.

## How it works

1. Open the canvas, drag nodes from the palette (Trigger, LLM, Tool, Router,
   Memory, Subagent, Human, Sink) and wire them together.
2. Open `⚙ gateways`, add one or more provider profiles. Optionally pick a
   gateway per LLM node in the Inspector.
3. Press `▶ run` to execute the graph in your browser. LLM nodes hit your
   configured providers; non-LLM nodes are schematic (router/memory branch
   logic still works).
4. `view code` to copy a runnable Python / JS script of the graph.

## License

MIT — do whatever you want.
