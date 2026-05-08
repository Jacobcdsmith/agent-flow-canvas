import { useState } from "react";

const STEPS: { title: string; body: string; bullets?: string[] }[] = [
  {
    title: "welcome to agent_flow.canvas",
    body: "An open-source visual builder for Python AI agent workflows. Design graphs, generate runnable code, and execute through the built-in MCP gateway — all in one wireframe canvas.",
    bullets: [
      "Drag-and-drop nodes for triggers, LLMs, tools, routers & memory",
      "Live Python + JavaScript code generation",
      "Run flows directly through Lovable AI Gateway",
    ],
  },
  {
    title: "1 · build the graph",
    body: "Use the palette on the left (or the + node button on mobile) to add nodes. Drag from a node handle to another to wire them together. Click an edge to relabel (next, on_success, true/false…) or delete it.",
    bullets: [
      "Click a node → edit name & config in the Inspector",
      "Mark a node as entry or terminal",
      "⌘Z to undo · Del to remove the selection",
    ],
  },
  {
    title: "2 · validate & generate code",
    body: "Hit validate to flag missing triggers, orphaned nodes, or routers without true/false branches. Then view code to see a real, runnable Python (or JS) script — copy it out and execute it locally.",
    bullets: [
      "Issues are pinned directly on offending nodes",
      "Python output uses asyncio + a dataclass-based Graph runtime",
      "Export / import the whole graph as JSON via clipboard",
    ],
  },
  {
    title: "3 · run through the gateway",
    body: "Press ▶ run to execute the live graph. LLM nodes route through the MCP gateway using your configured model, temperature, and max-tokens — globally or per-node.",
    bullets: [
      "Open ⚙ gateway to set base URL, default model, temperature, max tokens",
      "Override per node by setting model / temperature / max_tokens in the Inspector",
      "Each step shows latency, output, and any errors",
    ],
  },
];

interface Props {
  onClose: () => void;
  onOpenGateway: () => void;
}

export function IntroTutorial({ onClose, onOpenGateway }: Props) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--ink)/0.45)] backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] flex flex-col">
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-5 h-5 border-2 border-[hsl(var(--ink))]"
              style={{ background: "var(--gradient-accent)" }}
            />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
                tutorial · {step + 1} / {STEPS.length}
              </div>
              <h2 className="font-mono text-sm font-semibold">{s.title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
          >
            skip
          </button>
        </div>

        <div className="p-5 space-y-3 font-mono text-[12px] leading-relaxed text-[hsl(var(--ink-soft))]">
          <p>{s.body}</p>
          {s.bullets && (
            <ul className="space-y-1.5 text-[11px] text-[hsl(var(--ink))]">
              {s.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-[hsl(var(--ink-faint))]">›</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-dashed border-[hsl(var(--grid-line))]">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`step ${i + 1}`}
                className="w-6 h-1 border border-[hsl(var(--ink))]"
                style={i === step ? { background: "hsl(var(--ink))" } : { background: "transparent" }}
              />
            ))}
          </div>
          <button
            onClick={() => setStep((v) => Math.max(0, v - 1))}
            disabled={step === 0}
            className="ml-auto font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-dashed border-[hsl(var(--ink))] disabled:opacity-30"
          >
            back
          </button>
          {isLast ? (
            <>
              <button
                onClick={() => {
                  onClose();
                  onOpenGateway();
                }}
                className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
              >
                open gateway
              </button>
              <button
                onClick={onClose}
                className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-dashed text-[hsl(var(--paper))]"
                style={{ background: "var(--gradient-accent)", borderColor: "hsl(var(--accent-deep))" }}
              >
                start building
              </button>
            </>
          ) : (
            <button
              onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))}
              className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-dashed text-[hsl(var(--paper))]"
              style={{ background: "var(--gradient-accent)", borderColor: "hsl(var(--accent-deep))" }}
            >
              next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
