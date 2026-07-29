import { Link } from "react-router-dom";
import { OpeningAnimation } from "@/components/landing/OpeningAnimation";
import { Faq } from "@/components/landing/Faq";

const GITHUB_URL = "https://github.com/Jacobcdsmith/agent-flow-canvas";

const FEATURES = [
  {
    title: "TEN NODE TYPES",
    color: "hsl(var(--node-llm))",
    body: "Trigger, LLM Agent, Tool Call, Router, Subagent, Memory R/W, Human-in-the-Loop, Sink, HTTP Request, and JS Script — enough to model a real production graph, not just a toy demo.",
  },
  {
    title: "RUNS LIVE, IN-BROWSER",
    color: "hsl(var(--node-tool))",
    body: "Press run and the graph actually executes — LLM nodes call the provider you configure, routers branch on real state, no backend or sandbox required.",
  },
  {
    title: "BYO PROVIDER, BYO KEYS",
    color: "hsl(var(--node-router))",
    body: "OpenAI, Anthropic, Gemini, Ollama, or any OpenAI-compatible endpoint. Keys live only in your browser's localStorage and are never sent anywhere but the provider.",
  },
  {
    title: "EXPORTS RUNNABLE CODE",
    color: "hsl(var(--node-trigger))",
    body: "One click turns the visual graph into clean Python or JavaScript pseudocode you can paste straight into LangGraph, LangChain, AutoGen, or a hand-rolled runtime.",
  },
  {
    title: "GRAPH VALIDATION",
    color: "hsl(var(--node-subagent))",
    body: "Inline issue markers catch dangling edges, missing entry points, and unreachable nodes before you ever try to run the pipeline.",
  },
  {
    title: "ZERO INSTALL",
    color: "hsl(var(--node-sink))",
    body: "No account, no download, no CLI. Open a tab and start wiring — import and export your graph as JSON whenever you need to hand it off.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[hsl(var(--paper))] font-mono text-[hsl(var(--ink))]">
      <header className="flex items-center justify-between gap-4 border-b border-dashed border-[hsl(var(--grid-line))] px-6 py-[22px] sm:px-10">
        <div className="shrink-0 whitespace-nowrap text-[16px] font-bold tracking-[0.02em]">
          <span className="text-[hsl(var(--ink-faint))]">[</span> AGENT_FLOW
          <span className="text-[hsl(var(--accent-cyan))]">.</span>CANVAS{" "}
          <span className="text-[hsl(var(--ink-faint))]">]</span>
        </div>
        <nav className="flex gap-7 text-[12px] uppercase tracking-[0.1em] text-[hsl(var(--ink-soft))]">
          <a href="#faq" className="hover:text-[hsl(var(--accent-deep))] hover:underline">
            faq
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-[hsl(var(--accent-deep))] hover:underline"
          >
            github
          </a>
          <Link to="/app" className="hover:text-[hsl(var(--accent-deep))] hover:underline">
            open canvas
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex max-w-[960px] flex-col items-center gap-6 px-6 pb-10 pt-[88px] text-center sm:px-10">
        <div className="border border-[hsl(var(--grid-line))] px-3.5 py-1.5 text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
          // free &middot; browser-based &middot; no login
        </div>
        <h1 className="m-0 text-[36px] font-bold leading-[1.12] tracking-[-0.01em] sm:text-[52px]">
          Compose AI agent workflows
          <br />
          on a browser canvas.
        </h1>
        <p className="m-0 max-w-[640px] text-[17px] leading-[1.6] text-[hsl(var(--ink-soft))]">
          Drag, drop, and wire Trigger, LLM, Router, Tool, Memory, Subagent, Human, and Sink nodes into a working
          pipeline — then export runnable Python or JavaScript in one click. Your API keys never leave the browser.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3.5">
          <Link
            to="/app"
            className="bg-[hsl(var(--ink))] px-6 py-3.5 text-[13px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--paper))] no-underline"
          >
            open the canvas &rarr;
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="border border-[hsl(var(--ink))] px-6 py-3.5 text-[13px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--ink))] no-underline"
          >
            view on github
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-6 pb-[100px] pt-5 sm:px-10">
        <div className="relative aspect-video overflow-hidden border-2 border-dashed border-[hsl(var(--ink))] bg-[hsl(var(--paper))]">
          <OpeningAnimation />
        </div>
        <div className="mt-3.5 text-center text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--ink-faint))]">
          fig. 01 — a workflow assembling itself, live
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-6 pb-[100px] pt-5 sm:px-10">
        <div className="mb-2.5 text-center text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
          // why agent_flow.canvas
        </div>
        <h2 className="m-0 mb-10 text-center text-[28px] font-bold">
          Built for the way agent pipelines actually get designed
        </h2>
        <div className="grid grid-cols-1 gap-px border border-[hsl(var(--grid-line))] bg-[hsl(var(--grid-line))] sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-[hsl(var(--paper))] px-6 py-[26px]">
              <div className="mb-2.5 text-[11px] font-bold tracking-[0.13em]" style={{ color: f.color }}>
                {f.title}
              </div>
              <p className="m-0 text-sm leading-[1.7] text-[hsl(var(--ink-soft))]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-[760px] px-6 pb-[120px] pt-5 sm:px-10">
        <div className="mb-2.5 text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">// faq</div>
        <h2 className="m-0 mb-8 text-[28px] font-bold">Frequently asked questions</h2>
        <Faq />
      </section>

      <footer className="flex items-center justify-between gap-4 border-t border-dashed border-[hsl(var(--grid-line))] px-6 py-[26px] text-[11px] uppercase tracking-[0.08em] text-[hsl(var(--ink-faint))] sm:px-10">
        <span>MIT license &mdash; do whatever you want</span>
        <span>agent_flow.canvas</span>
      </footer>
    </div>
  );
}
