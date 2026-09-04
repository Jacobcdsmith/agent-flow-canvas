import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  exportWorkspaceBundle,
  validateWorkspaceBundle,
  importWorkspaceBundle,
  WorkspaceBundle,
} from "./workspace";

interface WorkspaceManagerProps {
  onClose: () => void;
  onWorkspaceImported?: () => void;
}

export function WorkspaceManager({ onClose, onWorkspaceImported }: WorkspaceManagerProps) {
  const [tab, setTab] = useState<"export" | "import">("export");
  const [includeApiKeys, setIncludeApiKeys] = useState(false);

  // Import state
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importJsonText, setImportJsonText] = useState("");
  const [validatedBundle, setValidatedBundle] = useState<WorkspaceBundle | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (text: string) => {
    setImportJsonText(text);
    if (!text.trim()) {
      setValidatedBundle(null);
      setValidationError(null);
      return;
    }
    const res = validateWorkspaceBundle(text);
    if (res.valid && res.bundle) {
      setValidatedBundle(res.bundle);
      setValidationError(null);
    } else {
      setValidatedBundle(null);
      setValidationError(res.error || "Invalid workspace bundle");
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

  const handleExportDownload = () => {
    const bundle = exportWorkspaceBundle({ includeApiKeys });
    const dataStr = JSON.stringify(bundle, null, 2);
    const blob = new Blob([dataStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent_flow_workspace_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Workspace backup file downloaded");
  };

  const handleExportCopy = () => {
    const bundle = exportWorkspaceBundle({ includeApiKeys });
    const dataStr = JSON.stringify(bundle, null, 2);
    navigator.clipboard.writeText(dataStr).then(() => {
      toast.success("Workspace backup JSON copied to clipboard");
    });
  };

  const handleExecuteImport = () => {
    if (!validatedBundle) return;

    if (
      importMode === "replace" &&
      !confirm("Are you sure you want to REPLACE your entire workspace? Existing workflows and settings will be overwritten!")
    ) {
      return;
    }

    const result = importWorkspaceBundle(validatedBundle, importMode);
    toast.success(
      `Workspace restored (${importMode} mode): ${result.workflowsCount} workflows, ${result.globalsCount + result.secretsCount} variables/secrets, ${result.gatewaysCount} gateways.`
    );
    onWorkspaceImported?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--ink)/0.5)] backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] w-full max-w-xl flex flex-col shadow-2xl max-h-[90vh]">
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              Workspace Manager
            </div>
            <h2 className="font-mono text-sm font-semibold text-[hsl(var(--ink))]">
              Backup & Restore Full Workspace
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            × Close
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.02)]">
          <button
            type="button"
            onClick={() => setTab("export")}
            className="flex-1 font-mono text-[11px] uppercase tracking-wider py-2 font-semibold transition-colors border-r border-dashed border-[hsl(var(--grid-line))]"
            style={
              tab === "export"
                ? { background: "var(--gradient-accent)", color: "hsl(var(--paper))" }
                : { color: "hsl(var(--ink))" }
            }
          >
            Export Backup
          </button>
          <button
            type="button"
            onClick={() => setTab("import")}
            className="flex-1 font-mono text-[11px] uppercase tracking-wider py-2 font-semibold transition-colors"
            style={
              tab === "import"
                ? { background: "var(--gradient-accent)", color: "hsl(var(--paper))" }
                : { color: "hsl(var(--ink))" }
            }
          >
            Import & Restore
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto font-mono text-[11px]">
          {tab === "export" ? (
            <div className="space-y-4">
              <p className="text-[hsl(var(--ink-soft))] leading-relaxed">
                Export a full workspace bundle file (<code className="bg-[hsl(var(--ink)/0.05)] px-1 py-0.5">agent_flow.workspace.v1</code>)
                containing all custom workflows, initial state presets, dynamic global variables, secrets, and provider gateway settings.
              </p>

              <div className="p-3 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.01)] space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeApiKeys}
                    onChange={(e) => setIncludeApiKeys(e.target.checked)}
                    className="mt-0.5 accent-[hsl(var(--ink))]"
                  />
                  <div>
                    <span className="font-semibold text-[hsl(var(--ink))] block">
                      Include API Keys in Gateway Profiles
                    </span>
                    <span className="text-[10px] text-[hsl(var(--ink-faint))] block leading-tight">
                      {includeApiKeys
                        ? "⚠ Warning: Exported JSON will contain unencrypted API keys. Keep your backup file secure."
                        : "Recommended: API keys are omitted by default for safe sharing."}
                    </span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportDownload}
                  className="py-2 px-3 border border-dashed border-[hsl(var(--ink))] text-[hsl(var(--paper))] hover:opacity-90 font-semibold transition-all"
                  style={{ background: "var(--gradient-accent)" }}
                >
                  ↓ Download Backup (.json)
                </button>
                <button
                  type="button"
                  onClick={handleExportCopy}
                  className="py-2 px-3 border border-dashed border-[hsl(var(--ink))] bg-[hsl(var(--paper))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] font-semibold transition-all"
                >
                  📋 Copy JSON to Clipboard
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[hsl(var(--ink-soft))] leading-relaxed">
                Restore workspace workflows, presets, variables, and gateway settings from an existing backup bundle file or clipboard JSON.
              </p>

              {/* Import Mode Selection */}
              <div className="p-3 border border-dashed border-[hsl(var(--grid-line))] space-y-2 bg-[hsl(var(--ink)/0.01)]">
                <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] font-semibold block">
                  Import Mode
                </span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === "merge"}
                      onChange={() => setImportMode("merge")}
                      className="accent-[hsl(var(--ink))]"
                    />
                    <span>Merge (Combine with current state)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === "replace"}
                      onChange={() => setImportMode("replace")}
                      className="accent-[hsl(var(--issue))]"
                    />
                    <span className="text-[hsl(var(--issue))] font-semibold">
                      Replace (Overwrite workspace)
                    </span>
                  </label>
                </div>
              </div>

              {/* File upload or text paste */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] font-semibold">
                    Backup File or Raw JSON
                  </span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
                  >
                    📁 Upload File
                  </button>
                </div>
                <textarea
                  value={importJsonText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Paste agent_flow workspace bundle JSON here..."
                  rows={6}
                  className="w-full p-2.5 font-mono text-[10px] bg-transparent border border-dashed border-[hsl(var(--grid-line))] focus:border-[hsl(var(--ink))] outline-none resize-y"
                />
              </div>

              {/* Validation Status / Bundle Summary */}
              {validationError && (
                <div className="p-2 border border-dashed border-[hsl(var(--issue))] bg-[hsl(var(--issue)/0.05)] text-[hsl(var(--issue))] text-[10px]">
                  ⚠ Validation Error: {validationError}
                </div>
              )}

              {validatedBundle && (
                <div className="p-3 border border-dashed border-emerald-600 bg-emerald-500/5 space-y-1.5 text-[10px]">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    ✓ Valid Backup Bundle Detected
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[hsl(var(--ink))]">
                    <div>Workflows: {validatedBundle.workflows.length}</div>
                    <div>Globals: {validatedBundle.globals.length}</div>
                    <div>Secrets: {validatedBundle.secrets.length}</div>
                    <div>Gateways: {validatedBundle.gateways.length}</div>
                    <div>Exported: {new Date(validatedBundle.exportedAt).toLocaleString()}</div>
                  </div>
                </div>
              )}

              {/* Action button */}
              <button
                type="button"
                disabled={!validatedBundle}
                onClick={handleExecuteImport}
                className="w-full py-2 px-3 border border-dashed border-[hsl(var(--ink))] text-[hsl(var(--paper))] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed font-semibold uppercase tracking-wider transition-all"
                style={{ background: "var(--gradient-accent)" }}
              >
                Restore Workspace Backup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
