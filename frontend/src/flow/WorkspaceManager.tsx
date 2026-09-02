import React, { useState, useRef } from "react";
import { exportWorkspaceBundle, importWorkspaceBundle } from "./workspace";
import { toast } from "sonner";

interface WorkspaceManagerProps {
  onClose: () => void;
  onWorkspaceRestored: () => void;
}

export const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({
  onClose,
  onWorkspaceRestored,
}) => {
  const [maskKeys, setMaskKeys] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importJsonText, setImportJsonText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBackup = () => {
    const bundle = exportWorkspaceBundle(maskKeys);
    const text = JSON.stringify(bundle, null, 2);
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agent_flow.workspace.v1.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Workspace backup bundle downloaded");
  };

  const handleCopyBackup = () => {
    const bundle = exportWorkspaceBundle(maskKeys);
    navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    toast.success("Workspace backup copied to clipboard");
  };

  const handleImportText = () => {
    if (!importJsonText.trim()) {
      toast.error("Paste JSON content to import");
      return;
    }

    try {
      const parsed = JSON.parse(importJsonText);
      const res = importWorkspaceBundle(parsed, importMode);
      if (res.success) {
        toast.success(res.message);
        onWorkspaceRestored();
        onClose();
      } else {
        toast.error(`Import failed: ${res.message}`);
      }
    } catch (e) {
      toast.error("Invalid workspace JSON syntax");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== "string") return;
        const parsed = JSON.parse(text);
        const res = importWorkspaceBundle(parsed, importMode);
        if (res.success) {
          toast.success(res.message);
          onWorkspaceRestored();
          onClose();
        } else {
          toast.error(`Import failed: ${res.message}`);
        }
      } catch (e) {
        toast.error("Invalid workspace file JSON");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--ink)/0.5)] backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] shadow-xl flex flex-col font-mono text-[11px] overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">💾</span>
            <div>
              <h2 className="font-semibold text-sm text-[hsl(var(--ink))]">
                Workspace Backup & Restore Manager
              </h2>
              <div className="text-[10px] text-[hsl(var(--ink-faint))] uppercase tracking-wider">
                Full Portability for Workflows, Gateways & Globals
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            × Close
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Export Section */}
          <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-2 bg-[hsl(var(--ink)/0.01)]">
            <span className="text-[10px] uppercase font-bold text-[hsl(var(--ink-soft))] block">
              1. Export Workspace Backup Bundle
            </span>
            <p className="text-[10px] text-[hsl(var(--ink-faint))] leading-relaxed">
              Exports all custom workflows, active canvas layout, global variables, secret definitions, and gateway profiles into a single portable bundle file (<code className="text-[hsl(var(--ink))]">agent_flow.workspace.v1.json</code>).
            </p>

            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-[hsl(var(--ink))]">
                <input
                  type="checkbox"
                  checked={maskKeys}
                  onChange={(e) => setMaskKeys(e.target.checked)}
                  className="accent-[hsl(var(--ink))]"
                />
                <span>Mask sensitive Gateway API Keys (********)</span>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleDownloadBackup}
                className="flex-1 font-mono text-[10px] uppercase tracking-wider py-1.5 bg-[hsl(var(--ink))] text-[hsl(var(--paper))] hover:opacity-90 font-bold transition-all"
              >
                💾 Download Backup File
              </button>
              <button
                onClick={handleCopyBackup}
                className="flex-1 font-mono text-[10px] uppercase tracking-wider py-1.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-all"
              >
                📋 Copy Bundle JSON
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-3 bg-[hsl(var(--ink)/0.01)]">
            <span className="text-[10px] uppercase font-bold text-[hsl(var(--ink-soft))] block">
              2. Restore / Import Workspace Bundle
            </span>

            {/* Mode selection */}
            <div className="flex items-center gap-3 border-b border-dotted border-[hsl(var(--grid-line))] pb-2">
              <span className="text-[10px] font-bold text-[hsl(var(--ink-soft))]">Import Mode:</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="merge"
                  checked={importMode === "merge"}
                  onChange={() => setImportMode("merge")}
                  className="accent-[hsl(var(--ink))]"
                />
                <span>Merge (Combine with existing)</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer text-[hsl(var(--issue))]">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === "replace"}
                  onChange={() => setImportMode("replace")}
                  className="accent-[hsl(var(--issue))]"
                />
                <span className="font-bold">Replace (Overwrite workspace)</span>
              </label>
            </div>

            {/* File Upload Option */}
            <div className="flex items-center justify-between gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full font-mono text-[10px] uppercase tracking-wider py-1.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-all"
              >
                📂 Upload Backup File (.json)
              </button>
            </div>

            {/* Textarea Paste Option */}
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))] block">
                Or paste JSON content directly:
              </span>
              <textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                rows={4}
                placeholder="Paste agent_flow.workspace.v1 JSON content here..."
                className="w-full font-mono text-[10px] p-2 bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--grid-line))] focus:border-[hsl(var(--ink))] outline-none resize-none"
              />
              <button
                onClick={handleImportText}
                disabled={!importJsonText.trim()}
                className="w-full font-mono text-[10px] uppercase tracking-wider py-1.5 bg-[hsl(var(--ink))] text-[hsl(var(--paper))] disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 font-bold transition-all"
              >
                Import Workspace from Text
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
