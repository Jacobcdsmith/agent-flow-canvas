import React, { useRef, useState } from "react";
import {
  WorkspaceBundle,
  exportWorkspaceBundle,
  importWorkspaceBundle,
  downloadWorkspaceBundle,
} from "./workspace";
import { toast } from "sonner";

interface WorkspaceManagerProps {
  onClose: () => void;
  onWorkspaceReload: () => void;
}

export function WorkspaceManager({
  onClose,
  onWorkspaceReload,
}: WorkspaceManagerProps) {
  const [includeKeys, setIncludeKeys] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [preview, setPreview] = useState<Partial<WorkspaceBundle> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (text: string) => {
    setImportText(text);
    setError(null);
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.version === "agent_flow.workspace.v1") {
        setPreview(parsed);
      } else {
        setError("Invalid format: JSON missing 'agent_flow.workspace.v1' version");
        setPreview(null);
      }
    } catch {
      setError("Invalid JSON format");
      setPreview(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        handleTextChange(content);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleApplyImport = () => {
    if (!preview) return;
    try {
      const stats = importWorkspaceBundle(preview, { mode: importMode });
      toast.success(
        `Workspace imported! (${stats.workflowsCount} workflows, ${stats.globalsCount} globals, ${stats.gatewaysCount} gateways updated)`
      );
      onWorkspaceReload();
      onClose();
    } catch (e) {
      toast.error(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const currentBundle = exportWorkspaceBundle({
    includeGatewayKeys: includeKeys,
    includeSecretValues: includeKeys,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--ink)/0.5)] backdrop-blur-sm p-4 animate-in fade-in duration-150 font-mono text-[11px]">
      <div className="bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] shadow-xl w-full max-w-2xl flex flex-col">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              Workspace Operations
            </div>
            <h2 className="text-sm font-semibold text-[hsl(var(--ink))]">
              Workspace Backup & Restore Bundle
            </h2>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            ✕ Close
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Export Section */}
          <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-3 bg-[hsl(var(--ink)/0.01)]">
            <span className="font-bold uppercase tracking-wider text-[10px] text-[hsl(var(--ink-soft))] block">
              📦 Export Workspace Backup
            </span>
            <p className="text-[10px] text-[hsl(var(--ink-faint))] leading-relaxed">
              Export all custom workflows, templates, state presets, global variables, secret definitions, and gateway profiles into a single portable backup file.
            </p>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px]">
                <input
                  type="checkbox"
                  checked={includeKeys}
                  onChange={(e) => setIncludeKeys(e.target.checked)}
                  className="accent-[hsl(var(--ink))]"
                />
                <span>Include sensitive API Keys & Secret Values in export</span>
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => downloadWorkspaceBundle(includeKeys)}
                className="flex-1 py-1.5 px-3 bg-[hsl(var(--ink))] text-[hsl(var(--paper))] hover:opacity-90 font-bold uppercase tracking-wider text-[10px] transition-all"
              >
                Download Bundle (.json)
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(currentBundle, null, 2));
                  toast.success("Workspace JSON bundle copied to clipboard");
                }}
                className="py-1.5 px-3 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] font-bold uppercase tracking-wider text-[10px] transition-all"
              >
                Copy JSON
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-3 bg-[hsl(var(--ink)/0.01)]">
            <span className="font-bold uppercase tracking-wider text-[10px] text-[hsl(var(--ink-soft))] block">
              📥 Restore / Import Workspace Bundle
            </span>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-1 px-3 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] font-bold uppercase tracking-wider text-[10px] transition-all"
              >
                Upload File...
              </button>
              <span className="text-[10px] text-[hsl(var(--ink-faint))]">
                or paste JSON workspace bundle below:
              </span>
            </div>

            <textarea
              value={importText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Paste agent_flow.workspace.v1 bundle JSON here..."
              rows={4}
              className={`w-full p-2 bg-[hsl(var(--paper))] border border-dashed outline-none font-mono text-[10px] resize-y ${
                error
                  ? "border-[hsl(var(--issue))] text-[hsl(var(--issue))]"
                  : "border-[hsl(var(--grid-line))] focus:border-[hsl(var(--ink))]"
              }`}
            />
            {error && <div className="text-[9px] text-[hsl(var(--issue))] font-bold">{error}</div>}

            {/* Import Options & Preview */}
            {preview && (
              <div className="p-3 border border-dashed border-[hsl(var(--ink))] bg-[hsl(var(--paper))] space-y-3">
                <div className="font-bold text-[10px] text-[hsl(var(--edge-selected))] uppercase tracking-wider">
                  ✓ Valid Workspace Bundle Preview
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>Workflows: <span className="font-bold">{preview.workflows?.length || 0}</span></div>
                  <div>Globals: <span className="font-bold">{preview.globals?.length || 0}</span></div>
                  <div>Secrets: <span className="font-bold">{preview.secrets?.length || 0}</span></div>
                  <div>Gateways: <span className="font-bold">{preview.gateways?.length || 0}</span></div>
                </div>

                <div className="space-y-1 pt-1 border-t border-dotted border-[hsl(var(--grid-line))]">
                  <span className="text-[9px] text-[hsl(var(--ink-soft))] uppercase tracking-wider block font-semibold">
                    Import Mode:
                  </span>
                  <div className="flex border border-dashed border-[hsl(var(--ink))]">
                    <button
                      type="button"
                      onClick={() => setImportMode("merge")}
                      className={`flex-1 py-1 text-[9px] uppercase font-bold tracking-wider ${
                        importMode === "merge"
                          ? "bg-[hsl(var(--ink))] text-[hsl(var(--paper))]"
                          : "text-[hsl(var(--ink))]"
                      }`}
                    >
                      Merge (Preserve existing)
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode("replace")}
                      className={`flex-1 py-1 text-[9px] uppercase font-bold tracking-wider ${
                        importMode === "replace"
                          ? "bg-[hsl(var(--issue))] text-[hsl(var(--paper))]"
                          : "text-[hsl(var(--ink))]"
                      }`}
                    >
                      Replace Entire Workspace
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleApplyImport}
                  className="w-full py-1.5 bg-[hsl(var(--edge-selected))] text-[hsl(var(--paper))] hover:opacity-90 font-bold uppercase tracking-wider text-[10px] transition-all"
                >
                  Confirm & Apply Workspace Import
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
