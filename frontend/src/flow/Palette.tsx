import { useMemo, useState } from "react";
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
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NODE_TYPES;
    return NODE_TYPES.filter((m) => {
      return (
        m.label.toLowerCase().includes(q) ||
        m.kind.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.defaultName.toLowerCase().includes(q) ||
        m.configFields.some((f) => f.key.toLowerCase().includes(q))
      );
    });
  }, [query]);

  return (
    <aside className="w-[280px] shrink-0 border-r border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--paper))] flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--paper))]/60 backdrop-blur-sm">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
          palette
        </div>
        <h2 className="font-mono text-sm font-semibold text-[hsl(var(--ink))] mt-0.5">
          Node types
        </h2>
        <div className="mt-2 flex items-center gap-1.5 border border-dashed border-[hsl(var(--grid-line))] focus-within:border-[hsl(var(--ink))] px-2">
          <span className="font-mono text-[10px] text-[hsl(var(--ink-faint))]">/</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search nodes…"
            className="flex-1 bg-transparent py-1.5 font-mono text-[11px] text-[hsl(var(--ink))] placeholder:text-[hsl(var(--ink-faint))] outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="font-mono text-[11px] text-[hsl(var(--ink-faint))] hover:text-[hsl(var(--ink))]"
              aria-label="clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0 overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 && (
            <div className="font-mono text-[10px] text-[hsl(var(--ink-faint))] px-1 py-2">
              no node type matches “{query}”
            </div>
          )}
          {filtered.map((meta) => (
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
