import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  exportWorkspaceBundle,
  importWorkspaceBundle,
  validateWorkspaceBundle,
  WorkspaceBundle,
} from "./workspace";

interface WorkspaceManagerProps {
  onClose: () => void;
  onWorkspaceRestored: () => void;
}

export function WorkspaceManager({ onClose, onWorkspaceRestored }: WorkspaceManagerProps) {
  const [importJson, setImportJson] = useState("");
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentBundle = exportWorkspaceBundle();

  const handleExportDownload = () => {
    const data = JSON.stringify(currentBundle, null, 2);
    const blob = new Blob([data], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent_flow_workspace_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Workspace bundle downloaded");
  };

  const handleExportCopy = () => {
    const data = JSON.stringify(currentBundle, null, 2);
    navigator.clipboard.writeText(data).then(() => {
      toast.success("Workspace bundle copied to clipboard");
    });
  };

  const handleTextChange = (text: string) => {
    setImportJson(text);
    if (!text.trim()) {
      setValidationError(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      const val = validateWorkspaceBundle(parsed);
      setValidationError(val.valid ? null : val.error || "Invalid bundle");
    } catch {
      setValidationError("Invalid JSON text");
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

  const handleImport = () => {
    if (!importJson.trim()) {
      toast.error("Please paste or upload a workspace bundle JSON first");
      return;
    }
    try {
      const parsed = JSON.parse(importJson) as WorkspaceBundle;
      const val = validateWorkspaceBundle(parsed);
      if (!val.valid) {
        toast.error(val.error || "Invalid workspace bundle");
        return;
      }

      if (importMode === "replace") {
        if (!confirm("WARNING: Replace mode will overwrite your current workspace workflows, gateways, and variables. Continue?")) {
          return;
        }
      }

      const res = importWorkspaceBundle(parsed, importMode);
      if (res.success) {
        toast.success(res.message);
        onWorkspaceRestored();
        onClose();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("Failed to parse workspace JSON");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] shadow-2xl w-full max-w-2xl flex flex-col font-mono text-[11px] overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📦</span>
            <div>
              <h2 className="font-semibold text-sm text-[hsl(var(--ink))]">Workspace Backup & Restore</h2>
              <p className="text-[10px] text-[hsl(var(--ink-faint))] uppercase tracking-wider">
                Export or import complete agent workspace bundles
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            × Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Export Section */}
          <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-3 bg-[hsl(var(--ink)/0.01)]">
            <div className="flex items-center justify-between border-b border-dotted border-[hsl(var(--grid-line))] pb-1">
              <span className="font-semibold uppercase text-[10px] text-[hsl(var(--ink-soft))]">
                1. Export Current Workspace
              </span>
              <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">
                Format: agent_flow.workspace.v1
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px]">
              <div className="border border-dashed border-[hsl(var(--grid-line))] p-1.5 bg-[hsl(var(--paper))]">
                <div className="text-[8px] uppercase text-[hsl(var(--ink-faint))]">Workflows</div>
                <div className="font-bold text-[hsl(var(--ink))]">{currentBundle.workflows.length}</div>
              </div>
              <div className="border border-dashed border-[hsl(var(--grid-line))] p-1.5 bg-[hsl(var(--paper))]">
                <div className="text-[8px] uppercase text-[hsl(var(--ink-faint))]">Gateways</div>
                <div className="font-bold text-[hsl(var(--ink))]">{currentBundle.gateways.length}</div>
              </div>
              <div className="border border-dashed border-[hsl(var(--grid-line))] p-1.5 bg-[hsl(var(--paper))]">
                <div className="text-[8px] uppercase text-[hsl(var(--ink-faint))]">Globals/Secrets</div>
                <div className="font-bold text-[hsl(var(--ink))]">
                  {currentBundle.globals.length + currentBundle.secrets.length}
                </div>
              </div>
              <div className="border border-dashed border-[hsl(var(--grid-line))] p-1.5 bg-[hsl(var(--paper))]">
                <div className="text-[8px] uppercase text-[hsl(var(--ink-faint))]">Presets</div>
                <div className="font-bold text-[hsl(var(--ink))]">
                  {Object.values(currentBundle.presets).reduce((acc, l) => acc + l.length, 0)}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportDownload}
                className="flex-1 font-mono text-[10px] uppercase tracking-wider py-1.5 bg-[hsl(var(--ink))] text-[hsl(var(--paper))] hover:opacity-90 transition-opacity"
              >
                Download Workspace (.json)
              </button>
              <button
                type="button"
                onClick={handleExportCopy}
                className="flex-1 font-mono text-[10px] uppercase tracking-wider py-1.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
              >
                Copy Bundle to Clipboard
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-3 bg-[hsl(var(--ink)/0.01)]">
            <div className="flex items-center justify-between border-b border-dotted border-[hsl(var(--grid-line))] pb-1">
              <span className="font-semibold uppercase text-[10px] text-[hsl(var(--ink-soft))]">
                2. Import Workspace Bundle
              </span>
              {validationError ? (
                <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--issue))] font-bold">
                  ⚠ {validationError}
                </span>
              ) : importJson.trim() ? (
                <span className="text-[9px] uppercase tracking-wider text-emerald-700 font-bold">
                  ✓ Valid Bundle
                </span>
              ) : null}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors uppercase text-[10px]"
              >
                📁 Upload Workspace File
              </button>
            </div>

            <textarea
              value={importJson}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Paste workspace bundle JSON here..."
              rows={5}
              className="w-full font-mono text-[10px] p-2 bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--grid-line))] focus:border-[hsl(var(--ink))] outline-none resize-y"
            />

            {/* Import Mode Radio Options */}
            <div className="space-y-1.5 pt-1">
              <span className="font-semibold uppercase text-[10px] text-[hsl(var(--ink-soft))] block">
                Import Restore Mode:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <label
                  onClick={() => setImportMode("merge")}
                  className={`p-2 border border-dashed cursor-pointer transition-colors flex flex-col gap-0.5 ${
                    importMode === "merge"
                      ? "border-[hsl(var(--ink))] bg-[hsl(var(--ink)/0.04)] font-bold"
                      : "border-[hsl(var(--grid-line))] hover:bg-[hsl(var(--ink)/0.02)]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] uppercase">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === "merge"}
                      onChange={() => setImportMode("merge")}
                      className="accent-[hsl(var(--ink))]"
                    />
                    <span>Merge Import</span>
                  </div>
                  <span className="text-[8px] text-[hsl(var(--ink-soft))] font-sans leading-tight">
                    Adds new workflows, gateways, & variables without removing existing items.
                  </span>
                </label>

                <label
                  onClick={() => setImportMode("replace")}
                  className={`p-2 border border-dashed cursor-pointer transition-colors flex flex-col gap-0.5 ${
                    importMode === "replace"
                      ? "border-[hsl(var(--issue))] bg-[hsl(var(--issue)/0.04)] font-bold text-[hsl(var(--issue))]"
                      : "border-[hsl(var(--grid-line))] hover:bg-[hsl(var(--ink)/0.02)]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] uppercase">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === "replace"}
                      onChange={() => setImportMode("replace")}
                      className="accent-[hsl(var(--issue))]"
                    />
                    <span>Replace Import</span>
                  </div>
                  <span className="text-[8px] text-[hsl(var(--ink-soft))] font-sans leading-tight">
                    Completely resets workspace and replaces with imported bundle.
                  </span>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={handleImport}
              disabled={!importJson.trim() || !!validationError}
              className="w-full font-mono text-[10px] uppercase tracking-wider py-2 bg-[hsl(var(--ink))] text-[hsl(var(--paper))] hover:opacity-90 disabled:opacity-40 transition-opacity font-bold"
            >
              Execute Workspace Restore
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
