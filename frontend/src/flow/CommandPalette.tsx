import { useState, useEffect, useMemo, useRef } from "react";
import type { Node } from "reactflow";
import { NODE_TYPES, type AgentNodeData, type AgentNodeKind } from "./types";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<AgentNodeData>[];
  onSelectNode: (nodeId: string) => void;
  onAddNodeType: (kind: AgentNodeKind) => void;
  onRunCommand: (commandId: string) => void;
}

interface PaletteItem {
  id: string;
  category: "node" | "type" | "action";
  label: string;
  detail: string;
  action: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  nodes,
  onSelectNode,
  onAddNodeType,
  onRunCommand,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items = useMemo(() => {
    const list: PaletteItem[] = [];

    // 1. Existing canvas nodes
    nodes.forEach((n) => {
      list.push({
        id: `node-${n.id}`,
        category: "node",
        label: n.data.name || n.id,
        detail: `Canvas Node (${n.data.kind}) · ID: ${n.id}`,
        action: () => {
          onSelectNode(n.id);
          onClose();
        },
      });
    });

    // 2. Add Node Types
    NODE_TYPES.forEach((meta) => {
      list.push({
        id: `type-${meta.kind}`,
        category: "type",
        label: `+ Add ${meta.label}`,
        detail: meta.description,
        action: () => {
          onAddNodeType(meta.kind);
          onClose();
        },
      });
    });

    // 3. Actions
    list.push({
      id: "cmd-run",
      category: "action",
      label: "▶ Run Workflow",
      detail: "Execute graph in-browser sequentially",
      action: () => {
        onRunCommand("run_flow");
        onClose();
      },
    });

    list.push({
      id: "cmd-validate",
      category: "action",
      label: "✓ Validate Graph",
      detail: "Check workflow structure and generated code linting",
      action: () => {
        onRunCommand("validate_graph");
        onClose();
      },
    });

    list.push({
      id: "cmd-layout-tb",
      category: "action",
      label: "⤓ Auto-Layout Graph (Top-to-Bottom)",
      detail: "Hierarchical topological graph layout",
      action: () => {
        onRunCommand("layout_tb");
        onClose();
      },
    });

    list.push({
      id: "cmd-layout-lr",
      category: "action",
      label: "➔ Auto-Layout Graph (Left-to-Right)",
      detail: "Hierarchical topological horizontal layout",
      action: () => {
        onRunCommand("layout_lr");
        onClose();
      },
    });

    list.push({
      id: "cmd-code",
      category: "action",
      label: "Code View",
      detail: "Toggle Python / JavaScript generated code drawer",
      action: () => {
        onRunCommand("toggle_code");
        onClose();
      },
    });

    list.push({
      id: "cmd-gateways",
      category: "action",
      label: "⚙ Open Gateways Manager",
      detail: "Configure LLM provider API keys and default models",
      action: () => {
        onRunCommand("open_gateways");
        onClose();
      },
    });

    list.push({
      id: "cmd-workflows",
      category: "action",
      label: "📁 Workflows Library",
      detail: "Manage, create, or import custom workflows and templates",
      action: () => {
        onRunCommand("open_workflows");
        onClose();
      },
    });

    list.push({
      id: "cmd-globals",
      category: "action",
      label: "⚙ Globals & Secrets Manager",
      detail: "Manage environment variables and secrets",
      action: () => {
        onRunCommand("open_globals");
        onClose();
      },
    });

    const q = query.trim().toLowerCase();
    if (!q) return list;

    return list.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [nodes, query, onSelectNode, onAddNodeType, onRunCommand, onClose]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (items.length > 0 ? (prev - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[selectedIndex]) {
        items[selectedIndex].action();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] shadow-2xl overflow-hidden font-mono text-[11px] flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.02)] flex items-center gap-2">
          <span className="text-[hsl(var(--ink-faint))] font-bold text-[12px]">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search nodes (⌘K)..."
            className="flex-1 bg-transparent outline-none font-mono text-[12px] text-[hsl(var(--ink))] placeholder:text-[hsl(var(--ink-faint))]"
          />
          <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))] border border-dashed border-[hsl(var(--grid-line))] px-1.5 py-0.5">
            ESC to close
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <div className="p-4 text-center text-[hsl(var(--ink-faint))] uppercase tracking-wider">
              No matching commands or nodes found
            </div>
          ) : (
            items.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left p-2 flex items-center justify-between border transition-all ${
                    isSelected
                      ? "bg-[hsl(var(--ink))] text-[hsl(var(--paper))] border-[hsl(var(--ink))]"
                      : "bg-transparent border-transparent text-[hsl(var(--ink))] hover:bg-[hsl(var(--ink)/0.04)]"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{item.label}</span>
                    <span
                      className={`text-[9px] ${
                        isSelected ? "text-[hsl(var(--paper))/0.8]" : "text-[hsl(var(--ink-faint))]"
                      }`}
                    >
                      {item.detail}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 border ${
                      isSelected
                        ? "border-[hsl(var(--paper))] text-[hsl(var(--paper))]"
                        : "border-[hsl(var(--grid-line))] text-[hsl(var(--ink-soft))]"
                    }`}
                  >
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
