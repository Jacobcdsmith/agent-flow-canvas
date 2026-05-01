import { NODE_TYPES, NodeTypeMeta } from "./types";

interface Props {
  onAdd: (meta: NodeTypeMeta) => void;
}

const KIND_COLOR: Record<string, string> = {
  trigger: "hsl(var(--node-trigger))",
  llm: "hsl(var(--node-llm))",
  tool: "hsl(var(--node-tool))",
  router: "hsl(var(--node-router))",
  subagent: "hsl(var(--node-subagent))",
  memory: "hsl(var(--node-memory))",
  human: "hsl(var(--node-human))",
  sink: "hsl(var(--node-sink))",
};

export function Palette({ onAdd }: Props) {
  return (
    <aside className="w-[280px] shrink-0 border-r border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--paper))] flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
          palette
        </div>
        <h2 className="font-mono text-sm font-semibold text-[hsl(var(--ink))] mt-0.5">
          Node types
        </h2>
      </div>
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0 overflow-y-auto p-3 space-y-2">
          {NODE_TYPES.map((meta) => (
            <button
              key={meta.kind}
              onClick={() => onAdd(meta)}
              className="w-full text-left border border-dashed border-[hsl(var(--grid-line))] hover:border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))]/[0.02] transition-colors p-2.5 group flex gap-2.5"
              style={{ borderLeft: `3px solid ${KIND_COLOR[meta.kind]}` }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
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
              </div>
            </button>
          ))}
        </div>
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-12"
          style={{
            background:
              "linear-gradient(to bottom, hsl(var(--paper) / 0), hsl(var(--paper)))",
          }}
        />
      </div>
    </aside>
  );
}
