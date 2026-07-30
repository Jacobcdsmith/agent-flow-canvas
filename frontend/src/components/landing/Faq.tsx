import { useState } from "react";

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: "What is Agent Flow Canvas?",
    a: "A free, browser-based visual tool for designing Python AI agent workflows. You drag and drop nodes — LLM agents, tool calls, routers, memory steps — onto a canvas, connect them with typed edges, and export the resulting pipeline as Python pseudocode.",
  },
  {
    q: "What node types does it support?",
    a: "Ten node types: Trigger, LLM Agent, Tool Call, Condition/Router, Subagent, Memory R/W, Human-in-the-Loop, Output/Sink, HTTP Request, and JS Script.",
  },
  {
    q: "Does it generate code?",
    a: 'Yes. Click "view code" in the toolbar and it instantly generates runnable Python or JavaScript pseudocode from your visual workflow graph, ready to copy to the clipboard.',
  },
  {
    q: "Is it free to use?",
    a: "Completely free. It runs entirely in your browser — no login, no account, no installation.",
  },
  {
    q: "Can I export and import my workflow?",
    a: 'Yes. Use "export json" to copy your graph (nodes and edges) as JSON, and "import json" to restore a previously exported graph.',
  },
  {
    q: "What frameworks does it work with?",
    a: "It is framework-agnostic. The canvas and code output map naturally onto LangGraph, LangChain, AutoGen, CrewAI, or a custom Python agent architecture.",
  },
  {
    q: "How do I connect nodes?",
    a: "Drag from the output handle of one node to the input handle of another. Click an edge to select it, then click its label to cycle through flow types: next, on_success, on_error, tool_result, true, false.",
  },
];

export function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <div className="flex flex-col">
      {FAQS.map((faq, i) => {
        const isOpen = i === open;
        return (
          <div key={faq.q} className="border-t border-dashed border-[hsl(var(--grid-line))]">
            <button
              onClick={() => setOpen((current) => (current === i ? -1 : i))}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 py-5 px-1 text-left cursor-pointer"
            >
              <span className="flex items-center gap-3.5">
                <span className="shrink-0 border border-[hsl(var(--accent-cyan))] px-[7px] py-[3px] text-[11px] text-[hsl(var(--accent-cyan))]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[15px] font-semibold">{faq.q}</span>
              </span>
              <span className="shrink-0 text-base text-[hsl(var(--ink-faint))]">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <p className="m-0 mb-[22px] ml-[39px] max-w-[600px] text-sm leading-[1.7] text-[hsl(var(--ink-soft))]">
                {faq.a}
              </p>
            )}
          </div>
        );
      })}
      <div className="border-t border-dashed border-[hsl(var(--grid-line))]" />
    </div>
  );
}
