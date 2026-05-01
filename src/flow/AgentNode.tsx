import { Handle, Position, NodeProps } from "reactflow";
import { AgentNodeData, NODE_TYPES } from "./types";
import { cn } from "@/lib/utils";

const KIND_TOKEN: Record<string, string> = {
  trigger: "border-[hsl(var(--node-trigger))] text-[hsl(var(--node-trigger))]",
  llm: "border-[hsl(var(--node-llm))] text-[hsl(var(--node-llm))]",
  tool: "border-[hsl(var(--node-tool))] text-[hsl(var(--node-tool))]",
  router: "border-[hsl(var(--node-router))] text-[hsl(var(--node-router))]",
  subagent: "border-[hsl(var(--node-subagent))] text-[hsl(var(--node-subagent))]",
  memory: "border-[hsl(var(--node-memory))] text-[hsl(var(--node-memory))]",
  human: "border-[hsl(var(--node-human))] text-[hsl(var(--node-human))]",
  sink: "border-[hsl(var(--node-sink))] text-[hsl(var(--node-sink))]",
};

export function AgentNode({ data, selected }: NodeProps<AgentNodeData>) {
  const meta = NODE_TYPES.find((n) => n.kind === data.kind)!;
  const tokens = KIND_TOKEN[data.kind];
  const entry = data.isEntry || meta.isEntry;
  const terminal = data.isTerminal || meta.isTerminal;

  return (
    <div
      className={cn(
        "w-[240px] bg-[hsl(var(--paper))] border-2 border-dashed font-mono text-[11px]",
        "transition-shadow",
        selected ? "shadow-[0_0_0_2px_hsl(var(--ink))]" : "shadow-none",
        terminal ? "border-solid" : "border-dashed",
      )}
    >
      {!entry && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2.5 !h-2.5 !bg-[hsl(var(--paper))] !border !border-[hsl(var(--ink))] !rounded-none"
        />
      )}

      <div className="flex items-center justify-between px-3 py-1.5 border-b border-dashed border-[hsl(var(--grid-line))]">
        <span className={cn("uppercase tracking-[0.15em] text-[10px] font-semibold", tokens.split(" ")[1])}>
          {meta.label}
        </span>
        {entry && (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-[hsl(var(--ink))] text-[hsl(var(--ink))]">
            entry
          </span>
        )}
        {terminal && (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-[hsl(var(--ink))] text-[hsl(var(--paper))]">
            terminal
          </span>
        )}
      </div>

      <div className="px-3 py-2">
        <div className="text-[hsl(var(--ink))] text-[13px] font-semibold mb-1.5 truncate">
          {data.name}
        </div>
        <div className="space-y-1">
          {meta.configFields.map((f) => {
            const val = data.config[f.key];
            if (!val) return null;
            return (
              <div key={f.key} className="flex gap-1.5 text-[10px] leading-tight">
                <span className="text-[hsl(var(--ink-faint))] shrink-0">{f.label}:</span>
                <span className="text-[hsl(var(--ink-soft))] truncate">{val}</span>
              </div>
            );
          })}
        </div>
      </div>

      {!terminal && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-2.5 !h-2.5 !bg-[hsl(var(--paper))] !border !border-[hsl(var(--ink))] !rounded-none"
        />
      )}
    </div>
  );
}