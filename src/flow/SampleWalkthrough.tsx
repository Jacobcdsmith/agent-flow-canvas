import { useEffect, useState } from "react";
import { useReactFlow } from "reactflow";
import { Edge, Node } from "reactflow";
import { AgentNodeData } from "./types";
import { exampleEdges, exampleNodes } from "./exampleWorkflow";

interface Step {
  id: string;
  title: string;
  body: string;
  nodeIds: string[];
  edgeIds?: string[];
  badge: string;
  tone: "tool" | "memory" | "fallback" | "llm" | "trigger" | "sink";
}

const STEPS: Step[] = [
  {
    id: "trigger",
    title: "1 · trigger entry",
    body: "Every flow starts at a trigger node — here a webhook delivering { query: str }.",
    nodeIds: ["trigger"],
    badge: "entry",
    tone: "trigger",
  },
  {
    id: "memory",
    title: "2 · memory read",
    body: "load_history reads prior turns from session.history before the agent reasons. Memory R/W nodes persist state across runs.",
    nodeIds: ["mem_read", "mem_write"],
    edgeIds: ["e1", "e2", "e8", "e9", "e10"],
    badge: "memory",
    tone: "memory",
  },
  {
    id: "llm",
    title: "3 · ReAct reasoning",
    body: "react_loop calls an LLM with the prompt 'Reason → Act'. It decides whether to call a tool or answer directly.",
    nodeIds: ["react", "router"],
    edgeIds: ["e3"],
    badge: "llm",
    tone: "llm",
  },
  {
    id: "tool",
    title: "4 · tool call branch",
    body: "When the router predicate is true, search_web runs and feeds its result back into the LLM via tool_result. This is the classic ReAct loop.",
    nodeIds: ["tool"],
    edgeIds: ["e4", "e6"],
    badge: "tool",
    tone: "tool",
  },
  {
    id: "fallback",
    title: "5 · fallback branch",
    body: "If the router is false, the flow delegates to a fallback_researcher subagent and pauses for human approval before persisting.",
    nodeIds: ["fallback", "human"],
    edgeIds: ["e5", "e7"],
    badge: "fallback",
    tone: "fallback",
  },
  {
    id: "sink",
    title: "6 · sink output",
    body: "The terminal sink returns the response to the caller. After this step you are ready to validate and run the graph.",
    nodeIds: ["sink"],
    badge: "exit",
    tone: "sink",
  },
];

const TONE_COLOR: Record<Step["tone"], string> = {
  trigger: "hsl(var(--ink))",
  memory: "hsl(220 70% 50%)",
  llm: "hsl(var(--accent-deep))",
  tool: "hsl(160 70% 38%)",
  fallback: "hsl(20 80% 50%)",
  sink: "hsl(var(--ink))",
};

interface Props {
  onClose: () => void;
  loadGraph: (nodes: Node<AgentNodeData>[], edges: Edge[]) => void;
  setHighlight: (h: { nodeIds: Set<string>; edgeIds: Set<string>; color: string } | null) => void;
  selectNode: (id: string | null) => void;
}

export function SampleWalkthrough({ onClose, loadGraph, setHighlight, selectNode }: Props) {
  const [step, setStep] = useState(0);
  const rf = useReactFlow();

  // load the canonical example graph on mount
  useEffect(() => {
    loadGraph(
      exampleNodes.map((n) => ({ ...n, data: { ...n.data, config: { ...n.data.config } } })),
      exampleEdges.map((e) => ({ ...e })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync highlight + focus camera on the highlighted nodes
  useEffect(() => {
    const s = STEPS[step];
    setHighlight({
      nodeIds: new Set(s.nodeIds),
      edgeIds: new Set(s.edgeIds ?? []),
      color: TONE_COLOR[s.tone],
    });
    selectNode(s.nodeIds[0] ?? null);
    // best-effort camera fit
    const t = setTimeout(() => {
      try {
        rf.fitView({
          nodes: s.nodeIds.map((id) => ({ id })),
          padding: 0.4,
          duration: 400,
          maxZoom: 1.2,
        });
      } catch {
        /* noop */
      }
    }, 50);
    return () => clearTimeout(t);
  }, [step, rf, setHighlight, selectNode]);

  // clear highlight when closing
  const close = () => {
    setHighlight(null);
    onClose();
  };

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-4 z-40 w-[calc(100%-2rem)] max-w-xl bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] shadow-lg"
      style={{ background: "hsl(var(--paper))" }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-dashed border-[hsl(var(--grid-line))]"
        style={{ background: "var(--gradient-header)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="font-mono text-[9px] uppercase tracking-[0.2em] px-1.5 py-0.5 border border-dashed text-[hsl(var(--paper))] shrink-0"
            style={{ background: TONE_COLOR[s.tone], borderColor: TONE_COLOR[s.tone] }}
          >
            {s.badge}
          </span>
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              sample · ReAct pipeline · {step + 1}/{STEPS.length}
            </div>
            <h3 className="font-mono text-[12px] font-semibold truncate">{s.title}</h3>
          </div>
        </div>
        <button
          onClick={close}
          className="font-mono text-[10px] px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
        >
          close
        </button>
      </div>

      <div className="px-4 py-2.5 font-mono text-[11px] leading-relaxed text-[hsl(var(--ink-soft))]">
        {s.body}
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-t border-dashed border-[hsl(var(--grid-line))]">
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`step ${i + 1}`}
              className="w-5 h-1 border border-[hsl(var(--ink))]"
              style={i === step ? { background: "hsl(var(--ink))" } : { background: "transparent" }}
            />
          ))}
        </div>
        <button
          onClick={() => setStep((v) => Math.max(0, v - 1))}
          disabled={step === 0}
          className="ml-auto font-mono text-[10px] uppercase tracking-wider px-3 py-1 border border-dashed border-[hsl(var(--ink))] disabled:opacity-30"
        >
          back
        </button>
        {isLast ? (
          <button
            onClick={close}
            className="font-mono text-[10px] uppercase tracking-wider px-3 py-1 border border-dashed text-[hsl(var(--paper))]"
            style={{ background: "var(--gradient-accent)", borderColor: "hsl(var(--accent-deep))" }}
          >
            done
          </button>
        ) : (
          <button
            onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))}
            className="font-mono text-[10px] uppercase tracking-wider px-3 py-1 border border-dashed text-[hsl(var(--paper))]"
            style={{ background: "var(--gradient-accent)", borderColor: "hsl(var(--accent-deep))" }}
          >
            next →
          </button>
        )}
      </div>
    </div>
  );
}
