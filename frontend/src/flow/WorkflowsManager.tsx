import { useState, useMemo } from "react";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "./types";
import {
  SavedWorkflow,
  TEMPLATES,
  cryptoId,
} from "./workflows";

interface Props {
  workflows: SavedWorkflow[];
  activeWorkflowId: string | null;
  onWorkflowsChange: (next: SavedWorkflow[]) => void;
  onSelectWorkflow: (id: string, nodes: Node<AgentNodeData>[], edges: Edge[]) => void;
  onClose: () => void;
  // Fallbacks to get current visual state when creating a new custom workflow or saving the current one
  getCurrentGraph: () => { nodes: Node<AgentNodeData>[]; edges: Edge[] };
}

export function WorkflowsManager({
  workflows,
  activeWorkflowId,
  onWorkflowsChange,
  onSelectWorkflow,
  onClose,
  getCurrentGraph,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Combine custom workflows and standard templates for list views
  const customList = useMemo(() => {
    return workflows.map((w) => ({ ...w, type: "custom" as const }));
  }, [workflows]);

  const templatesList = useMemo(() => {
    return TEMPLATES.map((t) => ({ ...t, type: "template" as const }));
  }, []);

  const allItems = useMemo(() => {
    return [...customList, ...templatesList];
  }, [customList, templatesList]);

  // Filter items in real-time based on search query
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allItems;
    return allItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.type.includes(query)
    );
  }, [allItems, searchQuery]);

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (activeWorkflowId) return activeWorkflowId;
    return filteredItems[0]?.id ?? null;
  });

  const selectedItem = useMemo(() => {
    return allItems.find((item) => item.id === selectedId) ?? null;
  }, [allItems, selectedId]);

  const handleCreateWorkflow = () => {
    const id = cryptoId();
    let index = 1;
    let name = `Custom Workflow ${index}`;
    while (workflows.some((w) => w.name === name)) {
      index++;
      name = `Custom Workflow ${index}`;
    }

    const { nodes, edges } = getCurrentGraph();

    const newWorkflow: SavedWorkflow = {
      id,
      name,
      description: "A custom user-defined agent workflow builder.",
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    };

    const nextWorkflows = [...workflows, newWorkflow];
    onWorkflowsChange(nextWorkflows);
    setSelectedId(id);
    setSearchQuery("");
    // Automatically load the newly created workflow
    onSelectWorkflow(id, nodes, edges);
  };

  const handleDuplicateSelected = () => {
    if (!selectedItem) return;

    const id = cryptoId();
    let name = `Copy of ${selectedItem.name}`;
    let index = 1;
    while (workflows.some((w) => w.name === name)) {
      name = `Copy of ${selectedItem.name} (${index++})`;
    }

    const duplicated: SavedWorkflow = {
      id,
      name,
      description: selectedItem.description,
      nodes: JSON.parse(JSON.stringify(selectedItem.nodes)),
      edges: JSON.parse(JSON.stringify(selectedItem.edges)),
      updatedAt: new Date().toISOString(),
    };

    onWorkflowsChange([...workflows, duplicated]);
    setSelectedId(id);
  };

  const handleDeleteSelected = () => {
    if (!selectedItem || selectedItem.type !== "custom") return;
    if (!confirm(`Are you sure you want to delete custom workflow "${selectedItem.name}"?`)) return;

    const next = workflows.filter((w) => w.id !== selectedItem.id);
    onWorkflowsChange(next);

    const remaining = [...next.map((w) => w.id), ...TEMPLATES.map((t) => t.id)];
    setSelectedId(remaining[0] ?? null);
  };

  const handleLoadSelected = () => {
    if (!selectedItem) return;
    onSelectWorkflow(selectedItem.id, selectedItem.nodes, selectedItem.edges);
    onClose();
  };

  const handleUpdateField = (patch: Partial<SavedWorkflow>) => {
    if (!selectedItem || selectedItem.type !== "custom") return;
    const next = workflows.map((w) =>
      w.id === selectedItem.id
        ? { ...w, ...patch, updatedAt: new Date().toISOString() }
        : w
    );
    onWorkflowsChange(next);
  };

  const handleExportAll = () => {
    const data = {
      workflows,
    };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      .then(() => alert("All custom workflows copied to clipboard!"))
      .catch((err) => alert(`Failed to copy: ${err}`));
  };

  const handleImportSubmit = () => {
    setImportError(null);
    try {
      const parsed = JSON.parse(importText.trim());
      let importedWorkflows: SavedWorkflow[] = [];

      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.workflows)) {
          parsed.workflows.forEach((w: any) => {
            if (
              w &&
              typeof w === "object" &&
              typeof w.name === "string" &&
              Array.isArray(w.nodes) &&
              Array.isArray(w.edges)
            ) {
              importedWorkflows.push({
                id: w.id || cryptoId(),
                name: w.name,
                description: w.description || "Imported custom workflow.",
                nodes: w.nodes,
                edges: w.edges,
                updatedAt: w.updatedAt || new Date().toISOString(),
              });
            }
          });
        } else if (
          typeof parsed.name === "string" &&
          Array.isArray(parsed.nodes) &&
          Array.isArray(parsed.edges)
        ) {
          // Import a single workflow
          importedWorkflows.push({
            id: parsed.id || cryptoId(),
            name: parsed.name,
            description: parsed.description || "Imported custom workflow.",
            nodes: parsed.nodes,
            edges: parsed.edges,
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          });
        }
      }

      if (importedWorkflows.length === 0) {
        throw new Error("No valid workflows found in the JSON.");
      }

      // Merge and update names if conflict
      const nextWorkflows = [...workflows];
      importedWorkflows.forEach((iw) => {
        let uniqueName = iw.name;
        let index = 1;
        while (nextWorkflows.some((w) => w.name === uniqueName)) {
          uniqueName = `${iw.name} (Imported ${index++})`;
        }
        nextWorkflows.push({
          ...iw,
          name: uniqueName,
        });
      });

      onWorkflowsChange(nextWorkflows);
      setShowImportModal(false);
      setImportText("");
      setSelectedId(importedWorkflows[0].id);
      alert(`Successfully imported ${importedWorkflows.length} custom workflow(s).`);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Invalid JSON syntax");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--ink)/0.35)] backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] flex flex-col h-[600px] max-h-[90vh] relative">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              workspace · workflows library
            </div>
            <h2 className="font-mono text-sm font-semibold">
              Workflows & Templates Library
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
          >
            close
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <aside className="w-[230px] shrink-0 border-r border-dashed border-[hsl(var(--grid-line))] flex flex-col bg-[hsl(var(--paper))]">
            {/* Search */}
            <div className="p-2 border-b border-dashed border-[hsl(var(--grid-line))]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workflows..."
                className="w-full bg-transparent border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1 px-2 font-mono text-[10px] text-[hsl(var(--ink))]"
              />
            </div>

            {/* Quick Actions */}
            <div className="p-2 border-b border-dashed border-[hsl(var(--grid-line))]">
              <button
                onClick={handleCreateWorkflow}
                className="w-full font-mono text-[10px] uppercase tracking-wider px-2 py-1.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] text-left flex items-center justify-between font-bold"
              >
                <span>+ New Workflow</span>
                <span className="text-[9px] bg-[hsl(var(--ink)/0.05)] px-1 py-0.2">WF</span>
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filteredItems.length === 0 && (
                <div className="p-3 font-mono text-[10px] text-[hsl(var(--ink-faint))] text-center leading-relaxed">
                  No matching workflows or templates found.
                </div>
              )}
              {filteredItems.map((item) => {
                const isSel = selectedId === item.id;
                const isActive = activeWorkflowId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left px-3 py-2 border-b border-dashed border-[hsl(var(--grid-line))] font-mono text-[11px] flex flex-col ${
                      isSel ? "bg-[hsl(var(--ink)/0.06)]" : "hover:bg-[hsl(var(--ink)/0.03)]"
                    }`}
                  >
                    <div className="flex items-center gap-1 w-full justify-between">
                      <span className="truncate font-semibold flex items-center gap-1">
                        {isActive && <span className="text-[hsl(var(--accent-deep))]" title="Active Workflow">●</span>}
                        {item.name || "Untitled"}
                      </span>
                      <span
                        className={`text-[7px] px-1 py-0.2 border uppercase font-bold shrink-0 ${
                          item.type === "template"
                            ? "border-[hsl(var(--ink-faint))] text-[hsl(var(--ink-soft))]"
                            : "border-[hsl(var(--issue)/0.3)] text-[hsl(var(--issue))]"
                        }`}
                      >
                        {item.type}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Persistence Operations */}
            <div className="p-2 border-t border-dashed border-[hsl(var(--grid-line))] space-y-1 bg-[hsl(var(--ink)/0.01)]">
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={handleExportAll}
                  title="Copy all custom workflows to clipboard"
                  className="w-full font-mono text-[9px] uppercase px-1.5 py-1 border border-dashed border-[hsl(var(--ink-faint))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] text-center"
                >
                  Export All
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  title="Import workflow(s) from JSON"
                  className="w-full font-mono text-[9px] uppercase px-1.5 py-1 border border-dashed border-[hsl(var(--ink-faint))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] text-center"
                >
                  Import
                </button>
              </div>
            </div>
          </aside>

          {/* Main Workflows Editor/Inspector Panel */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-[hsl(var(--paper))]">
            {!selectedItem ? (
              <div className="p-6 font-mono text-[11px] text-[hsl(var(--ink-faint))] text-center leading-relaxed">
                Select a template or custom workflow to inspect or edit.
              </div>
            ) : (
              <div className="p-6 space-y-5 font-mono text-[11px]">
                {/* Header Metadata */}
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[8px] uppercase tracking-[0.15em] font-bold px-2 py-0.5 border ${
                      selectedItem.type === "template"
                        ? "border-[hsl(var(--ink))] text-[hsl(var(--ink))]"
                        : "border-[hsl(var(--issue))] text-[hsl(var(--issue))]"
                    }`}
                  >
                    {selectedItem.type} Details
                  </span>
                  {selectedItem.type === "custom" && (
                    <span className="text-[10px] text-[hsl(var(--ink-faint))]">
                      Updated: {new Date((selectedItem as SavedWorkflow).updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Edit forms for Custom, read-only stats for Templates */}
                {selectedItem.type === "custom" ? (
                  <div className="space-y-4">
                    <label className="block space-y-1">
                      <span className="text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--ink-faint))] font-semibold">
                        workflow name
                      </span>
                      <input
                        value={selectedItem.name}
                        onChange={(e) => handleUpdateField({ name: e.target.value })}
                        className="mt-1 w-full bg-transparent border-b border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1.5 font-bold text-[hsl(var(--ink))]"
                        placeholder="e.g. Translation HITL Workflow"
                        autoComplete="off"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--ink-faint))] font-semibold">
                        description
                      </span>
                      <textarea
                        value={selectedItem.description}
                        onChange={(e) => handleUpdateField({ description: e.target.value })}
                        rows={3}
                        className="mt-1 w-full bg-transparent border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none p-2 font-mono text-[11px] text-[hsl(var(--ink))] resize-none"
                        placeholder="Describe the workflow purpose..."
                      />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h3 className="font-bold text-sm text-[hsl(var(--ink))]">{selectedItem.name}</h3>
                    <p className="text-[hsl(var(--ink-soft))] leading-relaxed whitespace-pre-wrap">{selectedItem.description}</p>
                  </div>
                )}

                {/* Node & Edge Counts Stats */}
                <div className="grid grid-cols-2 gap-3 border border-dashed border-[hsl(var(--grid-line))] p-3 bg-[hsl(var(--ink)/0.01)]">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))] block font-semibold">
                      nodes count
                    </span>
                    <span className="text-sm font-bold text-[hsl(var(--ink))]">{selectedItem.nodes?.length ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))] block font-semibold">
                      edges count
                    </span>
                    <span className="text-sm font-bold text-[hsl(var(--ink))]">{selectedItem.edges?.length ?? 0}</span>
                  </div>
                </div>

                {/* Workflow actions */}
                <div className="pt-4 border-t border-dashed border-[hsl(var(--grid-line))] flex flex-col gap-2">
                  <button
                    onClick={handleLoadSelected}
                    className="w-full font-mono text-[11px] uppercase tracking-wider py-2 bg-[hsl(var(--ink))] text-[hsl(var(--paper))] hover:opacity-90 font-bold transition-all border border-transparent text-center"
                  >
                    Load into Workspace
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={handleDuplicateSelected}
                      className="flex-1 font-mono text-[10px] uppercase tracking-wider py-1.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] text-center transition-all"
                    >
                      Duplicate
                    </button>
                    {selectedItem.type === "custom" && (
                      <button
                        onClick={handleDeleteSelected}
                        className="flex-1 font-mono text-[10px] uppercase tracking-wider py-1.5 border border-dashed border-[hsl(var(--issue))] text-[hsl(var(--issue))] hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))] text-center transition-all"
                      >
                        Delete Workflow
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--ink)/0.4)] backdrop-blur-xs">
          <div className="w-[90%] max-w-lg bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] p-4 flex flex-col space-y-3">
            <div className="flex justify-between items-center border-b border-dashed border-[hsl(var(--grid-line))] pb-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">Import Workflows</span>
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
              Paste a custom workflow JSON or a list of workflows:
              <code className="text-[hsl(var(--ink))] block bg-[hsl(var(--ink)/0.03)] p-1 mt-1 font-semibold">
                {`{ "workflows": [{ "name": "W", "nodes": [], "edges": [] }] }`}
              </code>
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste JSON here..."
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
              className="w-full font-mono text-[10px] uppercase tracking-wider py-2 bg-[hsl(var(--ink))] text-[hsl(var(--paper))] hover:opacity-90 font-bold transition-all"
            >
              Submit Import
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
