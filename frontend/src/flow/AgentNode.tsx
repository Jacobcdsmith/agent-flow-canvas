import { Handle, Position, NodeProps } from "reactflow";
import { AgentNodeData, NODE_TYPES } from "./types";
import { cn } from "@/lib/utils";

const KIND_COLOR: Record<string, string> = {
  trigger: "hsl(var(--node-trigger))",
  llm: "hsl(var(--node-llm))",
  tool: "hsl(var(--node-tool))",
  router: "hsl(var(--node-router))",
  subagent: "hsl(var(--node-subagent))",
  memory: "hsl(var(--node-memory))",
  human: "hsl(var(--node-human))",
  sink: "hsl(var(--node-sink))",
  http: "hsl(var(--node-http))",
  script: "hsl(var(--node-script))",
};

interface ExtraData extends AgentNodeData {
  hasIssue?: boolean;
  issueText?: string;
}

export function AgentNode({ data, selected }: NodeProps<ExtraData>) {
  const meta = NODE_TYPES.find((n) => n.kind === data.kind)!;
  const color = KIND_COLOR[data.kind];
  const entry = data.isEntry || meta.isEntry;
  const terminal = data.isTerminal || meta.isTerminal;

  return (
    <div
      className={cn(
        "w-[240px] bg-[hsl(var(--paper))] font-mono text-[11px] relative",
        terminal ? "border-2 border-solid" : "border-2 border-dashed",
      )}
      style={{
        borderColor: selected ? "hsl(var(--edge-selected))" : "hsl(var(--ink))",
        borderWidth: selected ? 3 : 2,
        background: "var(--gradient-node)",
        boxShadow: selected
          ? "0 0 0 1px hsl(var(--edge-selected) / 0.3)"
          : "0 1px 0 hsl(var(--ink) / 0.05)",
      }}
    >
      {data.hasIssue && (
        <div
          title={data.issueText}
          className="absolute -top-2 -right-2 w-4 h-4 flex items-center justify-center text-[10px] font-bold text-[hsl(var(--paper))] z-10"
          style={{ background: "hsl(var(--issue))" }}
        >
          !
        </div>
      )}

      {!entry && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2.5 !h-2.5 !bg-[hsl(var(--paper))] !border !border-[hsl(var(--ink))] !rounded-none"
        />
      )}

      <div className="flex items-center justify-between px-3 py-1.5 border-b border-dashed border-[hsl(var(--grid-line))]">
        <span
          className="uppercase tracking-[0.15em] text-[10px] font-semibold"
          style={{ color }}
        >
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
            const val = data.config?.[f.key];
            if (!val) return null;
            return (
              <div key={f.key} className="flex gap-1.5 text-[10px] leading-tight">
                <span className="text-[hsl(var(--ink-faint))] shrink-0">{f.label}:</span>
                <span className="text-[hsl(var(--ink-soft))] truncate">{val}</span>
              </div>
            );
          })}
        </div>
        {data.hasIssue && data.issueText && (
          <div
            className="mt-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-dashed"
            style={{ color: "hsl(var(--issue))", borderColor: "hsl(var(--issue))" }}
          >
            {data.issueText}
          </div>
        )}
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
