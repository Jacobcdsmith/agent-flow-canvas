import { useState, useEffect, useMemo, useRef } from "react";
import { Node, useReactFlow } from "reactflow";
import { AgentNodeData, NODE_TYPES, NodeTypeMeta } from "./types";

interface Props {
  isOpen: boolean;
  nodes: Node<AgentNodeData>[];
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onAddNodeType: (meta: NodeTypeMeta) => void;
}

export function CommandPalette({
  isOpen,
  nodes,
  onClose,
  onSelectNode,
  onAddNodeType,
}: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const rf = useReactFlow();

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Trigger handled in parent or here
        }
      } else if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter(
      (n) =>
        n.data.name.toLowerCase().includes(q) ||
        n.data.kind.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q)
    );
  }, [nodes, query]);

  const filteredNodeTypes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NODE_TYPES;
    return NODE_TYPES.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.kind.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
    );
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-[hsl(var(--ink)/0.4)] backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] shadow-xl overflow-hidden font-mono flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-dashed border-[hsl(var(--grid-line))] flex items-center gap-2">
          <span className="text-[hsl(var(--ink-faint))] text-xs">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search canvas nodes or add node types... (⌘K)"
            className="w-full bg-transparent outline-none text-xs text-[hsl(var(--ink))] placeholder:text-[hsl(var(--ink-faint))]"
          />
          <button
            onClick={onClose}
            className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-dashed border-[hsl(var(--ink-faint))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
          >
            esc
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {/* Canvas Nodes Section */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] font-semibold text-[hsl(var(--ink-faint))] px-2 py-1">
              Canvas Nodes ({filteredNodes.length})
            </div>
            {filteredNodes.length === 0 ? (
              <div className="text-[10px] text-[hsl(var(--ink-faint))] px-2 py-1 italic">
                No matching nodes on canvas
              </div>
            ) : (
              <div className="space-y-1">
                {filteredNodes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      onSelectNode(n.id);
                      if (typeof rf.setCenter === "function") {
                        rf.setCenter(n.position.x + 100, n.position.y + 50, {
                          zoom: 1.2,
                          duration: 400,
                        });
                      }
                      onClose();
                    }}
                    className="w-full text-left p-2 border border-dashed border-[hsl(var(--grid-line))] hover:border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink)/0.03)] flex items-center justify-between transition-colors group"
                  >
                    <div>
                      <span className="text-[11px] font-semibold text-[hsl(var(--ink))] group-hover:underline">
                        {n.data.name}
                      </span>
                      <span className="ml-2 text-[9px] uppercase text-[hsl(var(--ink-soft))] border border-[hsl(var(--ink-faint))] px-1 py-0.2">
                        {n.data.kind}
                      </span>
                    </div>
                    <span className="text-[9px] text-[hsl(var(--ink-faint))] uppercase tracking-wider">
                      Focus →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add Node Types Section */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] font-semibold text-[hsl(var(--ink-faint))] px-2 py-1">
              Add Node Type ({filteredNodeTypes.length})
            </div>
            {filteredNodeTypes.length === 0 ? (
              <div className="text-[10px] text-[hsl(var(--ink-faint))] px-2 py-1 italic">
                No matching node types
              </div>
            ) : (
              <div className="space-y-1">
                {filteredNodeTypes.map((meta) => (
                  <button
                    key={meta.kind}
                    onClick={() => {
                      onAddNodeType(meta);
                      onClose();
                    }}
                    className="w-full text-left p-2 border border-dashed border-[hsl(var(--grid-line))] hover:border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink)/0.03)] flex items-center justify-between transition-colors group"
                  >
                    <div>
                      <span className="text-[11px] font-semibold text-[hsl(var(--ink))] group-hover:underline">
                        + {meta.label}
                      </span>
                      <p className="text-[9px] text-[hsl(var(--ink-soft))] leading-tight mt-0.5">
                        {meta.description}
                      </p>
                    </div>
                    <span className="text-[9px] text-[hsl(var(--ink-faint))] uppercase tracking-wider shrink-0 ml-2">
                      + Add
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
