import { Node } from "reactflow";
import { AgentNodeData, NODE_TYPES } from "./types";

interface Props {
  node: Node<AgentNodeData> | null;
  onChange: (id: string, data: Partial<AgentNodeData>) => void;
  onDelete: (id: string) => void;
}

export function Inspector({ node, onChange, onDelete }: Props) {
  if (!node) {
    return (
      <div className="px-4 py-3 font-mono text-[11px] text-[hsl(var(--ink-faint))]">
        Select a node to edit its config.
      </div>
    );
  }
  const meta = NODE_TYPES.find((m) => m.kind === node.data.kind)!;

  return (
    <div className="p-4 space-y-3 font-mono text-[11px]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
          {meta.label}
        </span>
        <button
          onClick={() => onDelete(node.id)}
          className="text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] hover:text-[hsl(var(--ink))] border border-dashed border-[hsl(var(--grid-line))] hover:border-[hsl(var(--ink))] px-2 py-0.5"
        >
          delete
        </button>
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
            value={node.data.config[f.key] ?? ""}
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

      <label className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          checked={!!node.data.isEntry}
          onChange={(e) => onChange(node.id, { isEntry: e.target.checked })}
          className="accent-[hsl(var(--ink))]"
        />
        <span className="text-[hsl(var(--ink-soft))]">mark as entry</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!node.data.isTerminal}
          onChange={(e) => onChange(node.id, { isTerminal: e.target.checked })}
          className="accent-[hsl(var(--ink))]"
        />
        <span className="text-[hsl(var(--ink-soft))]">mark as terminal</span>
      </label>
    </div>
  );
}