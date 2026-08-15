import { NodeProps } from "reactflow";
import { AgentNodeData } from "./types";
import { cn } from "@/lib/utils";

const NOTE_THEMES: Record<string, { bg: string; border: string; text: string; header: string }> = {
  yellow: {
    bg: "hsl(48 100% 94%)",
    border: "hsl(45 90% 48%)",
    text: "hsl(40 90% 18%)",
    header: "hsl(45 90% 48%)",
  },
  blue: {
    bg: "hsl(200 100% 95%)",
    border: "hsl(200 90% 45%)",
    text: "hsl(210 90% 20%)",
    header: "hsl(200 90% 45%)",
  },
  green: {
    bg: "hsl(130 80% 94%)",
    border: "hsl(140 65% 42%)",
    text: "hsl(140 80% 18%)",
    header: "hsl(140 65% 42%)",
  },
  pink: {
    bg: "hsl(340 100% 95%)",
    border: "hsl(340 85% 55%)",
    text: "hsl(340 85% 20%)",
    header: "hsl(340 85% 55%)",
  },
  purple: {
    bg: "hsl(270 100% 96%)",
    border: "hsl(270 75% 55%)",
    text: "hsl(270 80% 22%)",
    header: "hsl(270 75% 55%)",
  },
};

interface ExtraData extends AgentNodeData {
  hasIssue?: boolean;
  issueText?: string;
}

export function NoteNode({ data, selected }: NodeProps<ExtraData>) {
  const colorKey = (data.config?.color || "yellow").toLowerCase();
  const theme = NOTE_THEMES[colorKey] ?? NOTE_THEMES.yellow;
  const content = data.config?.content || "Click to add note content...";

  return (
    <div
      className={cn(
        "w-[240px] min-h-[120px] p-3 font-mono text-[11px] relative border-2 border-dashed transition-all",
      )}
      style={{
        backgroundColor: theme.bg,
        borderColor: selected ? "hsl(var(--edge-selected))" : theme.border,
        borderWidth: selected ? 3 : 2,
        color: theme.text,
        boxShadow: selected
          ? "0 0 0 1px hsl(var(--edge-selected) / 0.3)"
          : "0 2px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-dashed" style={{ borderColor: theme.border }}>
        <span className="font-semibold uppercase tracking-[0.15em] text-[9px]" style={{ color: theme.header }}>
          📌 NOTE · {data.name}
        </span>
      </div>
      <div className="whitespace-pre-wrap text-[11px] leading-relaxed break-words font-mono opacity-90">
        {content}
      </div>
    </div>
  );
}
