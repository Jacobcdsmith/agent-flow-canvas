import { NODE_TYPES, NodeTypeMeta } from "./types";

interface Props {
  onAdd: (meta: NodeTypeMeta) => void;
}

const KIND_DOT: Record<string, string> = {
  trigger: "bg-[hsl(var(--node-trigger))]",
  llm: "bg-[hsl(var(--node-llm))]",
  tool: "bg-[hsl(var(--node-tool))]",
  router: "bg-[hsl(var(--node-router))]",
  subagent: "bg-[hsl(var(--node-subagent))]",
  memory: "bg-[hsl(var(--node-memory))]",
  human: "bg-[hsl(var(--node-human))]",
  sink: "bg-[hsl(var(--node-sink))]",
};

export function Palette({ onAdd }: Props) {
  return (
    <aside className="w-[280px] shrink-0 border-r border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--paper))] flex flex-col">
      <div className="px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
          palette
        </div>
        <h2 className="font-mono text-sm font-semibold text-[hsl(var(--ink))] mt-0.5">
          Node types
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {NODE_TYPES.map((meta) => (
          <button
            key={meta.kind}
            onClick={() => onAdd(meta)}
            className="w-full text-left border border-dashed border-[hsl(var(--grid-line))] hover:border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))]/[0.02] transition-colors p-2.5 group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 ${KIND_DOT[meta.kind]} shrink-0`} />
              <span className="font-mono text-[12px] font-semibold text-[hsl(var(--ink))]">
                {meta.label}
              </span>
              <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))] group-hover:text-[hsl(var(--ink))]">
                + add
              </span>
            </div>
            <p className="font-mono text-[10px] leading-snug text-[hsl(var(--ink-soft))]">
              {meta.description}
            </p>
          </button>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-dashed border-[hsl(var(--grid-line))]">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))] mb-1.5">
          edge labels
        </div>
        <div className="flex flex-wrap gap-1">
          {["next", "on_success", "on_error", "tool_result", "true", "false"].map((l) => (
            <span
              key={l}
              className="font-mono text-[9px] px-1.5 py-0.5 border border-dashed border-[hsl(var(--grid-line))] text-[hsl(var(--ink-soft))]"
            >
              {l}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}