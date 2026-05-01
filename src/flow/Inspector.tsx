import { useState } from "react";
import { Edge, Node } from "reactflow";
import { AgentNodeData, NODE_TYPES } from "./types";

interface Props {
  node: Node<AgentNodeData> | null;
  edges: Edge[];
  nodes: Node<AgentNodeData>[];
  onChange: (id: string, data: Partial<AgentNodeData>) => void;
  onDelete: (id: string) => void;
}

export function Inspector({ node, edges, nodes, onChange, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);

  if (!node) {
    return (
      <div className="px-4 py-3 font-mono text-[11px] text-[hsl(var(--ink-faint))]">
        Select a node to edit its config.
      </div>
    );
  }
  const meta = NODE_TYPES.find((m) => m.kind === node.data.kind)!;
  const outgoing = edges.filter((e) => e.source === node.id);
  const incoming = edges.filter((e) => e.target === node.id);
  const nameOf = (id: string) => nodes.find((n) => n.id === id)?.data.name ?? id;

  return (
    <div className="p-4 space-y-3 font-mono text-[11px]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
          {meta.label}
        </span>
      </div>

      <label className="block">
        <span className="text-[10px] text-[hsl(var(--ink-faint))]">name</span>
        <input
          value={node.data.name}
          onChange={(e) => onChange(node.id, { name: e.target.value })}
          className="mt-1 w-full bg-transparent border-b border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1 text-[hsl(var(--ink))]"
        />
      </label>

      {meta.configFields.map((f) => (
        <label key={f.key} className="block">
          <span className="text-[10px] text-[hsl(var(--ink-faint))]">{f.label}</span>
          <input
            value={node.data.config?.[f.key] ?? ""}
            placeholder={f.placeholder}
            onChange={(e) =>
              onChange(node.id, {
                config: { ...node.data.config, [f.key]: e.target.value },
              })
            }
            className="mt-1 w-full bg-transparent border-b border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1 text-[hsl(var(--ink))] placeholder:text-[hsl(var(--ink-faint))]"
          />
        </label>
      ))}

      <div className="flex items-center gap-4 pt-1">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!node.data.isEntry}
            onChange={(e) => onChange(node.id, { isEntry: e.target.checked })}
            className="accent-[hsl(var(--ink))]"
          />
          <span className="text-[hsl(var(--ink-soft))]">entry</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!node.data.isTerminal}
            onChange={(e) => onChange(node.id, { isTerminal: e.target.checked })}
            className="accent-[hsl(var(--ink))]"
          />
          <span className="text-[hsl(var(--ink-soft))]">terminal</span>
        </label>
      </div>

      <div className="pt-3 border-t border-dashed border-[hsl(var(--grid-line))]">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))] mb-1.5">
          edges
        </div>
        {outgoing.length === 0 && incoming.length === 0 && (
          <div className="text-[10px] text-[hsl(var(--ink-faint))]">no connections</div>
        )}
        {outgoing.map((e) => (
          <div key={e.id} className="text-[10px] text-[hsl(var(--ink-soft))]">
            → <span className="uppercase">{String(e.label ?? "next")}</span>: {nameOf(e.target)}
          </div>
        ))}
        {incoming.map((e) => (
          <div key={e.id} className="text-[10px] text-[hsl(var(--ink-faint))]">
            ← <span className="uppercase">{String(e.label ?? "next")}</span>: {nameOf(e.source)}
          </div>
        ))}
      </div>

      <div className="pt-4">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full text-[10px] uppercase tracking-wider py-2 border border-dashed"
            style={{ color: "hsl(var(--issue))", borderColor: "hsl(var(--issue))" }}
          >
            delete node
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                onDelete(node.id);
                setConfirming(false);
              }}
              className="flex-1 text-[10px] uppercase tracking-wider py-2 text-[hsl(var(--paper))]"
              style={{ background: "hsl(var(--issue))" }}
            >
              confirm delete
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 text-[10px] uppercase tracking-wider py-2 border border-dashed border-[hsl(var(--ink))]"
            >
              cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
