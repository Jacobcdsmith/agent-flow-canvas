import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  WorkspaceBundle,
  exportWorkspaceBundle,
  downloadWorkspaceBundleFile,
  validateWorkspaceBundle,
  importWorkspaceBundle,
} from "./workspace";
import { Workflow } from "./workflows";
import { GlobalVar, SecretVar } from "./globals";
import { Gateway } from "./gateways";

interface WorkspaceManagerProps {
  onClose: () => void;
  onWorkspaceImported: (data: {
    workflows: Workflow[];
    globals: GlobalVar[];
    secrets: SecretVar[];
    gateways: Gateway[];
  }) => void;
}

export function WorkspaceManager({ onClose, onWorkspaceImported }: WorkspaceManagerProps) {
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importJsonStr, setImportJsonStr] = useState("");
  const [validatedBundle, setValidatedBundle] = useState<WorkspaceBundle | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentBundle = exportWorkspaceBundle();

  useEffect(() => {
    if (!importJsonStr.trim()) {
      setValidatedBundle(null);
      setValidationError(null);
      return;
    }
    const res = validateWorkspaceBundle(importJsonStr);
    if (res.valid && res.bundle) {
      setValidatedBundle(res.bundle);
      setValidationError(null);
    } else {
      setValidatedBundle(null);
      setValidationError(res.error || "Invalid workspace bundle format");
    }
  }, [importJsonStr]);

  const handleCopyExportJson = () => {
    const jsonStr = JSON.stringify(currentBundle, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      toast.success("Workspace bundle JSON copied to clipboard");
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setImportJsonStr(text);
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = () => {
    if (!validatedBundle) {
      toast.error("Cannot import: Bundle validation failed");
      return;
    }

    if (importMode === "replace") {
      if (!confirm("Warning: Replace Mode will wipe existing custom workflows, presets, globals, secrets, and gateways. Continue?")) {
        return;
      }
    }

    try {
      const updated = importWorkspaceBundle(validatedBundle, importMode);
      onWorkspaceImported(updated);
      toast.success(
        `Workspace successfully restored (${importMode === "replace" ? "Replaced" : "Merged"} ${validatedBundle.workflows.length} workflows, ${validatedBundle.globals.length} globals, ${validatedBundle.secrets.length} secrets, ${validatedBundle.gateways.length} gateways)`
      );
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Workspace import failed: ${msg}`);
    }
  };

  const totalPresetsCount = Object.values(currentBundle.presets).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] shadow-xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{ background: "var(--gradient-paper)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              workspace manager · backup & restore
            </div>
            <h2 className="font-mono text-sm font-semibold text-[hsl(var(--ink))] mt-0.5">
              Workspace Portability & Bundle Sync
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            × close
          </button>
        </div>

        {/* Tab Selection Bar */}
        <div className="flex border-b border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.02)]">
          <button
            type="button"
            onClick={() => setActiveTab("export")}
            className={`flex-1 font-mono text-[11px] uppercase tracking-wider py-2.5 transition-colors border-r border-dashed border-[hsl(var(--grid-line))] ${
              activeTab === "export"
                ? "bg-[hsl(var(--paper))] font-bold text-[hsl(var(--ink))] border-b-2 border-b-[hsl(var(--ink))]"
                : "text-[hsl(var(--ink-soft))] hover:bg-[hsl(var(--ink)/0.04)]"
            }`}
          >
            📦 Export Backup Bundle
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("import")}
            className={`flex-1 font-mono text-[11px] uppercase tracking-wider py-2.5 transition-colors ${
              activeTab === "import"
                ? "bg-[hsl(var(--paper))] font-bold text-[hsl(var(--ink))] border-b-2 border-b-[hsl(var(--ink))]"
                : "text-[hsl(var(--ink-soft))] hover:bg-[hsl(var(--ink)/0.04)]"
            }`}
          >
            📥 Import & Restore Workspace
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "export" ? (
            <div className="space-y-4 font-mono">
              <div className="border border-dashed border-[hsl(var(--grid-line))] p-3.5 bg-[hsl(var(--ink)/0.01)] space-y-2">
                <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[hsl(var(--ink-soft))] block">
                  Current Workspace Snapshot
                </span>
                <p className="text-[11px] text-[hsl(var(--ink-soft))] leading-relaxed">
                  Export your full workspace bundle containing all custom workflows, node state presets, global variables, secret definitions, and gateway profiles.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[10px]">
                  <div className="border border-dashed border-[hsl(var(--grid-line))] p-2 bg-[hsl(var(--paper))] text-center">
                    <div className="text-[8px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Workflows</div>
                    <div className="font-bold text-[hsl(var(--ink))] text-sm">{currentBundle.workflows.length}</div>
                  </div>
                  <div className="border border-dashed border-[hsl(var(--grid-line))] p-2 bg-[hsl(var(--paper))] text-center">
                    <div className="text-[8px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Presets</div>
                    <div className="font-bold text-[hsl(var(--ink))] text-sm">{totalPresetsCount}</div>
                  </div>
                  <div className="border border-dashed border-[hsl(var(--grid-line))] p-2 bg-[hsl(var(--paper))] text-center">
                    <div className="text-[8px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Globals & Secrets</div>
                    <div className="font-bold text-[hsl(var(--ink))] text-sm">{currentBundle.globals.length + currentBundle.secrets.length}</div>
                  </div>
                  <div className="border border-dashed border-[hsl(var(--grid-line))] p-2 bg-[hsl(var(--paper))] text-center">
                    <div className="text-[8px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Gateways</div>
                    <div className="font-bold text-[hsl(var(--ink))] text-sm">{currentBundle.gateways.length}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={downloadWorkspaceBundleFile}
                  className="flex-1 font-mono text-[11px] uppercase tracking-wider py-2.5 px-3 border border-dashed text-[hsl(var(--paper))] font-semibold transition-all hover:opacity-90"
                  style={{ background: "var(--gradient-accent)", borderColor: "hsl(var(--accent-deep))" }}
                >
                  Download Bundle File (.json)
                </button>
                <button
                  type="button"
                  onClick={handleCopyExportJson}
                  className="flex-1 font-mono text-[11px] uppercase tracking-wider py-2.5 px-3 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-all"
                >
                  Copy Bundle JSON
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 font-mono">
              <div className="border border-dashed border-[hsl(var(--grid-line))] p-3.5 bg-[hsl(var(--ink)/0.01)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[hsl(var(--ink-soft))]">
                    Restore Mode Selection
                  </span>
                  <div className="flex border border-dashed border-[hsl(var(--ink))] text-[10px]">
                    <button
                      type="button"
                      onClick={() => setImportMode("merge")}
                      className={`px-3 py-1 uppercase tracking-wider transition-colors ${
                        importMode === "merge"
                          ? "bg-[hsl(var(--ink))] text-[hsl(var(--paper))]"
                          : "hover:bg-[hsl(var(--ink)/0.05)] text-[hsl(var(--ink))]"
                      }`}
                    >
                      Merge Import
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode("replace")}
                      className={`px-3 py-1 uppercase tracking-wider transition-colors border-l border-dashed border-[hsl(var(--ink))] ${
                        importMode === "replace"
                          ? "bg-[hsl(var(--issue))] text-[hsl(var(--paper))]"
                          : "hover:bg-[hsl(var(--ink)/0.05)] text-[hsl(var(--issue))]"
                      }`}
                    >
                      Replace Import
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-[hsl(var(--ink-soft))] leading-relaxed">
                  {importMode === "merge"
                    ? "Merge Mode combines imported workflows, presets, globals, secrets, and gateways with existing ones, preserving non-conflicting items."
                    : "Replace Mode completely overwrites all existing workflows, presets, global variables, secret keys, and gateway profiles with the imported bundle."}
                </p>
              </div>

              {/* Upload or Paste section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[hsl(var(--ink-soft))]">
                    Bundle JSON Content
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".json"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-all"
                  >
                    Upload File (.json)
                  </button>
                </div>
                <textarea
                  value={importJsonStr}
                  onChange={(e) => setImportJsonStr(e.target.value)}
                  rows={7}
                  placeholder={`Paste workspace bundle JSON here... (schemaVersion: "${currentBundle.schemaVersion}")`}
                  className={`w-full font-mono text-[10px] p-2.5 bg-transparent border border-dashed outline-none resize-y ${
                    validationError
                      ? "border-[hsl(var(--issue))] text-[hsl(var(--issue))]"
                      : validatedBundle
                      ? "border-emerald-600"
                      : "border-[hsl(var(--grid-line))] focus:border-[hsl(var(--ink))]"
                  }`}
                />

                {validationError && (
                  <div className="text-[10px] text-[hsl(var(--issue))] font-semibold">
                    ⚠ Validation Error: {validationError}
                  </div>
                )}

                {validatedBundle && (
                  <div className="border border-dashed border-emerald-600 p-2.5 bg-emerald-500/5 text-[10px] space-y-1">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 block uppercase tracking-wider">
                      ✓ Valid Workspace Bundle Detected
                    </span>
                    <div className="text-[9.5px] text-[hsl(var(--ink-soft))]">
                      Workflows: {validatedBundle.workflows.length} · Globals: {validatedBundle.globals.length} · Secrets: {validatedBundle.secrets.length} · Gateways: {validatedBundle.gateways.length}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={!validatedBundle}
                  onClick={handleExecuteImport}
                  className={`w-full font-mono text-[11px] uppercase tracking-wider py-2.5 px-3 border border-dashed font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    importMode === "replace"
                      ? "bg-[hsl(var(--issue))] text-[hsl(var(--paper))] border-[hsl(var(--issue))]"
                      : "bg-[hsl(var(--ink))] text-[hsl(var(--paper))] border-[hsl(var(--ink))]"
                  }`}
                >
                  {importMode === "replace" ? "Execute Replace Import" : "Execute Merge Import"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
