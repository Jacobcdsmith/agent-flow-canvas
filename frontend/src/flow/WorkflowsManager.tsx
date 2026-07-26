import { useState, useMemo } from "react";
import { Edge, Node } from "reactflow";
import { AgentNodeData } from "./types";
import {
  Workflow,
  TEMPLATES,
  cryptoId,
} from "./workflows";

interface Props {
  workflows: Workflow[];
  activeWorkflowId: string | null;
  currentNodes: Node<AgentNodeData>[];
  currentEdges: Edge[];
  onSelectWorkflow: (id: string | null) => void;
  onWorkflowsChange: (next: Workflow[]) => void;
  onClose: () => void;
}

export function WorkflowsManager({
  workflows,
  activeWorkflowId,
  currentNodes,
  currentEdges,
  onSelectWorkflow,
  onWorkflowsChange,
  onClose,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  // Merge custom workflows with read-only templates for visual listing
  const allWorkflows = useMemo(() => {
    return [...TEMPLATES, ...workflows];
  }, [workflows]);

  // Filter workflows in real-time based on query
  const filteredWorkflows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allWorkflows;
    return allWorkflows.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.description && w.description.toLowerCase().includes(q))
    );
  }, [allWorkflows, searchQuery]);

  const activeWorkflow = useMemo(() => {
    return allWorkflows.find((w) => w.id === activeWorkflowId) ?? null;
  }, [allWorkflows, activeWorkflowId]);

  const handleCreateNew = () => {
    const id = cryptoId();
    // Default nodes for a new workflow
    const newWf: Workflow = {
      id,
      name: "New Custom Workflow",
      description: "A blank canvas starting point.",
      nodes: [
        {
          id: "new-trigger",
          type: "agent",
          position: { x: 250, y: 100 },
          data: {
            kind: "trigger",
            name: "on_start",
            isEntry: true,
            config: { source: "manual" },
          },
        },
      ],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onWorkflowsChange([...workflows, newWf]);
    onSelectWorkflow(id);
    setSearchQuery("");
  };

  const handleDuplicate = (target: Workflow) => {
    const id = cryptoId();
    const duplicate: Workflow = {
      ...target,
      id,
      name: `${target.name} (Copy)`,
      isTemplate: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onWorkflowsChange([...workflows, duplicate]);
    onSelectWorkflow(id);
  };

  const handleDelete = (target: Workflow) => {
    if (target.isTemplate) return;
    if (!confirm(`Are you sure you want to delete "${target.name}"?`)) return;

    const nextWorkflows = workflows.filter((w) => w.id !== target.id);
    onWorkflowsChange(nextWorkflows);
    if (activeWorkflowId === target.id) {
      onSelectWorkflow(null); // Fallback to default
    }
  };

  const handleExport = (target: Workflow) => {
    const serialized = JSON.stringify(
      {
        name: target.name,
        description: target.description,
        nodes: target.isTemplate
          ? target.nodes
          : activeWorkflowId === target.id
            ? currentNodes
            : target.nodes,
        edges: target.isTemplate
          ? target.edges
          : activeWorkflowId === target.id
            ? currentEdges
            : target.edges,
      },
      null,
      2
    );
    navigator.clipboard.writeText(serialized)
      .then(() => alert(`Workflow "${target.name}" configuration copied to clipboard!`))
      .catch((err) => alert(`Failed to copy to clipboard: ${err}`));
  };

  const handleImportSubmit = () => {
    setImportError(null);
    try {
      const parsed = JSON.parse(importText.trim());
      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        throw new Error("Missing valid 'nodes' array.");
      }
      const id = cryptoId();
      const importedWf: Workflow = {
        id,
        name: parsed.name ? String(parsed.name).trim() : "Imported Workflow",
        description: parsed.description ? String(parsed.description).trim() : "Imported via JSON snippet.",
        nodes: parsed.nodes,
        edges: Array.isArray(parsed.edges) ? parsed.edges : [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      onWorkflowsChange([...workflows, importedWf]);
      onSelectWorkflow(id);
      setShowImportModal(false);
      setImportText("");
      alert(`Imported "${importedWf.name}" successfully.`);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Invalid JSON format.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--ink)/0.35)] backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] flex flex-col h-[520px] max-h-[85vh] relative">

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              workflows library
            </div>
            <h2 className="font-mono text-sm font-semibold">
              Manage Workflows & Templates
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
          >
            close
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b border-dashed border-[hsl(var(--grid-line))] flex items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workflows, templates..."
            className="flex-1 bg-transparent border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1.5 px-3 font-mono text-[11px] text-[hsl(var(--ink))]"
          />
          <button
            onClick={handleCreateNew}
            className="font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] whitespace-nowrap"
          >
            + Create Blank
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] whitespace-nowrap"
          >
            Import JSON
          </button>
        </div>

        {/* Workflows List Grid */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredWorkflows.length === 0 && (
            <div className="p-6 font-mono text-[11px] text-[hsl(var(--ink-faint))] text-center leading-relaxed">
              No workflows or templates matched your filter.
            </div>
          )}
          {filteredWorkflows.map((w) => {
            const isActive = w.id === activeWorkflowId;
            return (
              <div
                key={w.id}
                className={`border border-dashed p-3 font-mono text-[11px] flex flex-col justify-between transition-colors ${
                  isActive
                    ? "border-[hsl(var(--edge-selected))] bg-[hsl(var(--edge-selected)/0.03)]"
                    : "border-[hsl(var(--grid-line))] hover:border-[hsl(var(--ink))] bg-[hsl(var(--ink)/0.01)]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[13px] text-[hsl(var(--ink))]">
                        {w.name}
                      </span>
                      {w.isTemplate ? (
                        <span className="text-[8px] px-1.5 py-0.2 border border-[hsl(var(--ink-faint))] text-[hsl(var(--ink-soft))] uppercase tracking-wider font-semibold">
                          template
                        </span>
                      ) : (
                        <span className="text-[8px] px-1.5 py-0.2 border border-[hsl(var(--issue)/0.3)] text-[hsl(var(--issue))] uppercase tracking-wider font-semibold">
                          custom
                        </span>
                      )}
                      {isActive && (
                        <span className="text-[8px] px-1.5 py-0.2 bg-[hsl(var(--edge-selected))] text-[hsl(var(--paper))] uppercase tracking-wider font-semibold">
                          active
                        </span>
                      )}
                    </div>
                    {w.description && (
                      <p className="text-[10px] text-[hsl(var(--ink-soft))] leading-snug">
                        {w.description}
                      </p>
                    )}
                    <div className="text-[9px] text-[hsl(var(--ink-faint))] pt-0.5">
                      {w.nodes.length} nodes · {w.edges.length} edges
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                    {!isActive && (
                      <button
                        onClick={() => {
                          onSelectWorkflow(w.id);
                          toastMessage(`Switched to workflow "${w.name}"`);
                        }}
                        className="px-2.5 py-1 text-[10px] uppercase tracking-wider border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
                      >
                        Load
                      </button>
                    )}
                    <button
                      onClick={() => handleDuplicate(w)}
                      className="px-2.5 py-1 text-[10px] uppercase tracking-wider border border-dashed border-[hsl(var(--ink-faint))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleExport(w)}
                      className="px-2.5 py-1 text-[10px] uppercase tracking-wider border border-dashed border-[hsl(var(--ink-faint))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
                    >
                      Copy Snippet
                    </button>
                    {!w.isTemplate && (
                      <button
                        onClick={() => handleDelete(w)}
                        className="px-2.5 py-1 text-[10px] uppercase tracking-wider border border-dashed text-[hsl(var(--issue))] border-[hsl(var(--issue))] hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))]"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info banner */}
        <div
          className="p-2 border-t border-dashed border-[hsl(var(--grid-line))] font-mono text-[9px] text-[hsl(var(--ink-faint))] uppercase tracking-[0.1em] text-center"
          style={{ background: "hsl(var(--ink)/0.01)" }}
        >
          Custom workflows and configurations are saved locally inside your browser.
        </div>

      </div>

      {/* Local JSON Import Modal */}
      {showImportModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--ink)/0.4)] backdrop-blur-xs">
          <div className="w-[90%] max-w-md bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] p-4 flex flex-col space-y-3">
            <div className="flex justify-between items-center border-b border-dashed border-[hsl(var(--grid-line))] pb-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                Import Workflow Configuration
              </span>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportError(null);
                  setImportText("");
                }}
                className="font-mono text-[10px] border border-dashed px-1.5 py-0.5 hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
              >
                Close
              </button>
            </div>
            <p className="font-mono text-[10px] text-[hsl(var(--ink-soft))] leading-relaxed">
              Paste the serialized workflow JSON representation (which contains standard nodes and edges fields):
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='Paste JSON snippet here...'
              rows={8}
              className="w-full bg-transparent border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none p-2 font-mono text-[11px] text-[hsl(var(--ink))] resize-y"
            />
            {importError && (
              <p className="text-[10px] text-[hsl(var(--issue))] font-mono">
                ⚠ {importError}
              </p>
            )}
            <button
              onClick={handleImportSubmit}
              className="w-full font-mono text-[11px] uppercase tracking-wider py-2 bg-[hsl(var(--ink))] text-[hsl(var(--paper))] hover:opacity-90 font-bold transition-all"
            >
              Submit Import
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline fallback for Toasting
function toastMessage(msg: string) {
  try {
    // Attempt standard sonner toast, fallback to console log
    const { toast } = require("sonner");
    toast.success(msg);
  } catch {
    console.log("[toast]", msg);
  }
}
