import { useState, useMemo } from "react";
import {
  GlobalVar,
  SecretVar,
  cryptoId,
} from "./globals";

interface Props {
  globals: GlobalVar[];
  secrets: SecretVar[];
  onGlobalsChange: (next: GlobalVar[]) => void;
  onSecretsChange: (next: SecretVar[]) => void;
  onClose: () => void;
}

export function GlobalsManager({
  globals,
  secrets,
  onGlobalsChange,
  onSecretsChange,
  onClose,
}: Props) {
  // Search query state
  const [searchQuery, setSearchQuery] = useState("");

  // Combine globals and secrets into a unified list for the sidebar
  const items = useMemo(() => {
    const gList = globals.map((g) => ({ ...g, type: "global" as const }));
    const sList = secrets.map((s) => ({ ...s, type: "secret" as const }));
    return [...gList, ...sList];
  }, [globals, secrets]);

  // Filter items in real-time based on the search query
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (item) =>
        item.key.toLowerCase().includes(query) ||
        item.value.toLowerCase().includes(query) ||
        item.type.includes(query)
    );
  }, [items, searchQuery]);

  const [selectedId, setSelectedId] = useState<string | null>(
    filteredItems[0]?.id ?? null
  );
  const [showSecretMap, setShowSecretMap] = useState<Record<string, boolean>>({});

  // Import Overlay state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const selected = useMemo(() => {
    return items.find((item) => item.id === selectedId) ?? null;
  }, [items, selectedId]);

  const validateKey = (key: string): string | null => {
    const trimmed = key.trim();
    if (!trimmed) return "Key is required";
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
      return "Key must be a valid identifier (alphanumeric & underscore, start with letter/underscore)";
    }
    // Check for duplicate keys of the same type or cross-type duplicate
    const matches = items.filter(
      (item) => item.key.trim().toLowerCase() === trimmed.toLowerCase() && item.id !== selectedId
    );
    if (matches.length > 0) {
      return "Key must be unique across all globals & secrets";
    }
    return null;
  };

  const keyError = useMemo(() => {
    if (!selected) return null;
    return validateKey(selected.key);
  }, [selected, selectedId, items]);

  const updateSelected = (patch: { key?: string; value?: string }) => {
    if (!selected) return;
    if (selected.type === "global") {
      const updated = globals.map((g) =>
        g.id === selected.id ? { ...g, ...patch } : g
      );
      onGlobalsChange(updated);
    } else {
      const updated = secrets.map((s) =>
        s.id === selected.id ? { ...s, ...patch } : s
      );
      onSecretsChange(updated);
    }
  };

  const addVariable = (type: "global" | "secret") => {
    const id = cryptoId();
    const prefix = type === "global" ? "GLOBAL_" : "SECRET_";
    // Find unique name
    let index = 1;
    let key = `${prefix}${index}`;
    while (items.some((item) => item.key === key)) {
      index++;
      key = `${prefix}${index}`;
    }

    if (type === "global") {
      const newItem: GlobalVar = { id, key, value: "value" };
      onGlobalsChange([...globals, newItem]);
    } else {
      const newItem: SecretVar = { id, key, value: "supersecret" };
      onSecretsChange([...secrets, newItem]);
    }
    setSelectedId(id);
    setSearchQuery(""); // Clear search to make newly added item visible
  };

  const removeSelected = () => {
    if (!selected) return;
    if (!confirm(`Delete ${selected.type} "${selected.key}"?`)) return;

    if (selected.type === "global") {
      const next = globals.filter((g) => g.id !== selected.id);
      onGlobalsChange(next);
      const remaining = [...next.map((g) => g.id), ...secrets.map((s) => s.id)];
      setSelectedId(remaining[0] ?? null);
    } else {
      const next = secrets.filter((s) => s.id !== selected.id);
      onSecretsChange(next);
      const remaining = [...globals.map((g) => g.id), ...next.map((s) => s.id)];
      setSelectedId(remaining[0] ?? null);
    }
  };

  const handleClearAll = () => {
    if (items.length === 0) {
      alert("No environment variables to clear.");
      return;
    }
    if (confirm("Are you absolutely sure you want to clear ALL global variables and secrets? This action cannot be undone.")) {
      onGlobalsChange([]);
      onSecretsChange([]);
      setSelectedId(null);
    }
  };

  const handleExport = () => {
    const data = {
      globals,
      secrets,
    };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      .then(() => alert("Environment configuration copied to clipboard!"))
      .catch((err) => alert(`Failed to copy to clipboard: ${err}`));
  };

  const handleImportSubmit = (mode: "merge" | "replace") => {
    setImportError(null);
    try {
      const parsed = JSON.parse(importText.trim());
      let importedGlobals: GlobalVar[] = [];
      let importedSecrets: SecretVar[] = [];

      if (Array.isArray(parsed)) {
        // Flat array format
        parsed.forEach((item: any) => {
          if (item && typeof item === 'object' && typeof item.key === 'string' && typeof item.value === 'string') {
            const type = item.type === 'secret' ? 'secret' : 'global';
            const newItem = {
              id: item.id || cryptoId(),
              key: item.key.trim(),
              value: item.value,
            };
            if (type === 'global') {
              importedGlobals.push(newItem);
            } else {
              importedSecrets.push(newItem);
            }
          }
        });
      } else if (parsed && typeof parsed === 'object') {
        // Nested format { globals: [...], secrets: [...] }
        if (Array.isArray(parsed.globals)) {
          parsed.globals.forEach((g: any) => {
            if (g && typeof g === 'object' && typeof g.key === 'string' && typeof g.value === 'string') {
              importedGlobals.push({
                id: g.id || cryptoId(),
                key: g.key.trim(),
                value: g.value,
              });
            }
          });
        }
        if (Array.isArray(parsed.secrets)) {
          parsed.secrets.forEach((s: any) => {
            if (s && typeof s === 'object' && typeof s.key === 'string' && typeof s.value === 'string') {
              importedSecrets.push({
                id: s.id || cryptoId(),
                key: s.key.trim(),
                value: s.value,
              });
            }
          });
        }
      } else {
        throw new Error("Invalid format. Expected a list or { globals, secrets } object.");
      }

      if (importedGlobals.length === 0 && importedSecrets.length === 0) {
        throw new Error("No valid global variables or secrets found in the JSON.");
      }

      if (mode === "replace") {
        onGlobalsChange(importedGlobals);
        onSecretsChange(importedSecrets);
        const remaining = [...importedGlobals.map((g) => g.id), ...importedSecrets.map((s) => s.id)];
        setSelectedId(remaining[0] ?? null);
      } else {
        // Merge mode: keys must be unique. Update existing, append new.
        const mergedGlobalsMap = new Map<string, GlobalVar>();
        globals.forEach((g) => mergedGlobalsMap.set(g.key.toLowerCase(), g));
        importedGlobals.forEach((ig) => {
          mergedGlobalsMap.set(ig.key.toLowerCase(), ig);
        });

        const mergedSecretsMap = new Map<string, SecretVar>();
        secrets.forEach((s) => mergedSecretsMap.set(s.key.toLowerCase(), s));
        importedSecrets.forEach((is) => {
          mergedSecretsMap.set(is.key.toLowerCase(), is);
        });

        const finalGlobals = Array.from(mergedGlobalsMap.values());
        const finalSecrets = Array.from(mergedSecretsMap.values());

        onGlobalsChange(finalGlobals);
        onSecretsChange(finalSecrets);
        const remaining = [...finalGlobals.map((g) => g.id), ...finalSecrets.map((s) => s.id)];
        setSelectedId(remaining[0] ?? null);
      }

      setShowImportModal(false);
      setImportText("");
      alert(`Imported successfully (${importedGlobals.length} globals, ${importedSecrets.length} secrets).`);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Invalid JSON syntax");
    }
  };

  const toggleSecretVisibility = (id: string) => {
    setShowSecretMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
              workspace · environment
            </div>
            <h2 className="font-mono text-sm font-semibold">
              Globals & Secrets Configuration
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
          >
            close
          </button>
        </div>

        {/* Content Panel */}
        <div className="flex flex-1 min-h-0">

          {/* Sidebar */}
          <aside className="w-[220px] shrink-0 border-r border-dashed border-[hsl(var(--grid-line))] flex flex-col bg-[hsl(var(--paper))]">
            {/* Search Input */}
            <div className="p-2 border-b border-dashed border-[hsl(var(--grid-line))]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search keys, values..."
                className="w-full bg-transparent border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1 px-2 font-mono text-[10px] text-[hsl(var(--ink))]"
              />
            </div>

            <div className="p-2 border-b border-dashed border-[hsl(var(--grid-line))] space-y-1">
              <button
                onClick={() => addVariable("global")}
                className="w-full font-mono text-[10px] uppercase tracking-wider px-2 py-1.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] text-left flex items-center justify-between"
              >
                <span>+ Add Global</span>
                <span className="text-[9px] bg-[hsl(var(--ink)/0.05)] px-1 py-0.2 text-[hsl(var(--ink-soft))]">VAR</span>
              </button>
              <button
                onClick={() => addVariable("secret")}
                className="w-full font-mono text-[10px] uppercase tracking-wider px-2 py-1.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] text-left flex items-center justify-between"
              >
                <span>+ Add Secret</span>
                <span className="text-[9px] bg-[hsl(var(--issue)/0.08)] text-[hsl(var(--issue))] px-1 py-0.2">KEY</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredItems.length === 0 && (
                <div className="p-3 font-mono text-[10px] text-[hsl(var(--ink-faint))] leading-relaxed text-center">
                  {items.length === 0 ? "No variables configured yet." : "No matching variables found."}
                </div>
              )}
              {filteredItems.map((item) => {
                const isSel = selectedId === item.id;
                const bad = !!validateKey(item.key);
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left px-3 py-2 border-b border-dashed border-[hsl(var(--grid-line))] font-mono text-[11px] flex flex-col ${
                      isSel
                        ? "bg-[hsl(var(--ink)/0.06)]"
                        : "hover:bg-[hsl(var(--ink)/0.03)]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 w-full justify-between">
                      <span className="truncate flex items-center gap-1">
                        {bad && <span className="text-[hsl(var(--issue))]" title="invalid key">⚠</span>}
                        {item.key || "untitled"}
                      </span>
                      <span
                        className={`text-[8px] px-1 py-0.5 border uppercase font-semibold ${
                          item.type === "global"
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

            {/* Sidebar actions: Clear, Import, Export */}
            <div className="p-2 border-t border-dashed border-[hsl(var(--grid-line))] space-y-1 bg-[hsl(var(--ink)/0.01)]">
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={handleExport}
                  title="Export all to clipboard as JSON"
                  className="w-full font-mono text-[9px] uppercase px-1.5 py-1 border border-dashed border-[hsl(var(--ink-faint))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] text-center"
                >
                  Export
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  title="Import from JSON"
                  className="w-full font-mono text-[9px] uppercase px-1.5 py-1 border border-dashed border-[hsl(var(--ink-faint))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] text-center"
                >
                  Import
                </button>
              </div>
              <button
                onClick={handleClearAll}
                title="Wipe all variables and secrets"
                className="w-full font-mono text-[9px] uppercase px-1.5 py-1 border border-dashed text-[hsl(var(--issue))] border-[hsl(var(--issue))] hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))] text-center"
              >
                Clear All
              </button>
            </div>
          </aside>

          {/* Editor Area */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-[hsl(var(--paper))]">
            {!selected ? (
              <div className="p-6 font-mono text-[11px] text-[hsl(var(--ink-faint))] leading-relaxed space-y-3">
                <p className="uppercase tracking-[0.2em] text-[10px] text-[hsl(var(--ink-soft))]">
                  How to Use Environment Variables
                </p>
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-2 bg-[hsl(var(--ink)/0.02)]">
                  <p>
                    Add workspace variables here to substitute secrets (API keys, passwords) and dynamic values in your graph without hardcoding.
                  </p>
                  <p className="font-semibold text-[hsl(var(--ink-soft))]">Syntax Referencing:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>
                      Global variables: Use{" "}
                      <code className="text-[hsl(var(--ink))] bg-[hsl(var(--ink)/0.05)] px-1 font-bold">
                        {"{{global.KEY}}"}
                      </code>
                    </li>
                    <li>
                      Secrets: Use{" "}
                      <code className="text-[hsl(var(--ink))] bg-[hsl(var(--ink)/0.05)] px-1 font-bold">
                        {"{{secret.KEY}}"}
                      </code>
                    </li>
                  </ul>
                  <p className="text-[10px]">
                    Placeholders are replaced dynamically during browser flow execution and exported code (Python & Javascript).
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-5 font-mono text-[11px]">

                {/* Header Badge */}
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] uppercase tracking-[0.2em] font-bold px-2 py-1 border ${
                      selected.type === "global"
                        ? "border-[hsl(var(--ink))] text-[hsl(var(--ink))]"
                        : "border-[hsl(var(--issue))] text-[hsl(var(--issue))]"
                    }`}
                  >
                    Editing {selected.type}
                  </span>
                  <span className="text-[10px] text-[hsl(var(--ink-faint))]">
                    id: {selected.id}
                  </span>
                </div>

                {/* Key Form */}
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--ink-faint))]">
                    variable key (identifier)
                  </span>
                  <input
                    value={selected.key}
                    onChange={(e) => updateSelected({ key: e.target.value })}
                    className={`mt-1 w-full bg-transparent border-b border-dashed outline-none py-1.5 font-bold text-[hsl(var(--ink))] ${
                      keyError
                        ? "border-[hsl(var(--issue))]"
                        : "border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))]"
                    }`}
                    placeholder="e.g. DATABASE_URL"
                    autoComplete="off"
                  />
                  {keyError && (
                    <p className="mt-1.5 text-[10px] text-[hsl(var(--issue))] leading-normal">
                      ⚠ {keyError}
                    </p>
                  )}
                </label>

                {/* Value Form */}
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--ink-faint))]">
                    variable value
                  </span>
                  {selected.type === "global" ? (
                    <textarea
                      value={selected.value}
                      onChange={(e) => updateSelected({ value: e.target.value })}
                      rows={5}
                      className="mt-1 w-full bg-transparent border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none p-2 font-mono text-[11px] text-[hsl(var(--ink))] resize-y"
                      placeholder="Enter global variable value..."
                    />
                  ) : (
                    <div className="relative mt-1 flex items-center border border-dashed border-[hsl(var(--ink-faint))] focus-within:border-[hsl(var(--ink))]">
                      <input
                        type={showSecretMap[selected.id] ? "text" : "password"}
                        value={selected.value}
                        onChange={(e) => updateSelected({ value: e.target.value })}
                        className="w-full bg-transparent outline-none py-2 px-2 pr-12 font-mono text-[11px] text-[hsl(var(--ink))]"
                        placeholder="Enter secret key value..."
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => toggleSecretVisibility(selected.id)}
                        className="absolute right-2 text-[10px] uppercase tracking-wider text-[hsl(var(--ink-faint))] hover:text-[hsl(var(--ink))] bg-[hsl(var(--paper))] px-1 py-0.5 border border-dashed border-[hsl(var(--ink-faint))]"
                      >
                        {showSecretMap[selected.id] ? "hide" : "show"}
                      </button>
                    </div>
                  )}
                </label>

                {/* Info Note */}
                <div
                  className="border border-dashed border-[hsl(var(--grid-line))] p-2 text-[10px] leading-relaxed text-[hsl(var(--ink-soft))]"
                  style={{ background: "hsl(var(--ink)/0.02)" }}
                >
                  <span className="uppercase tracking-[0.15em] font-semibold">Usage Reference:</span>{" "}
                  You can interpolate this value in prompt prompts, urls, header structures, and HTTP bodies as{" "}
                  <code className="text-[hsl(var(--ink))] bg-[hsl(var(--ink)/0.05)] px-1 font-bold">
                    {"{{"}
                    {selected.type}.{selected.key || "KEY"}
                    {"}}"}
                  </code>
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-dashed border-[hsl(var(--grid-line))] flex items-center justify-between">
                  <button
                    onClick={removeSelected}
                    className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-dashed text-[hsl(var(--issue))] border-[hsl(var(--issue))] hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))]"
                  >
                    delete {selected.type}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Import Modal Overlay */}
      {showImportModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--ink)/0.4)] backdrop-blur-xs">
          <div className="w-[90%] max-w-lg bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] p-4 flex flex-col space-y-3">
            <div className="flex justify-between items-center border-b border-dashed border-[hsl(var(--grid-line))] pb-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">Import Environment Variables</span>
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
              Paste a JSON array of variables, or an object in the format:
              <code className="text-[hsl(var(--ink))] block bg-[hsl(var(--ink)/0.03)] p-1 mt-1 font-semibold">
                {`{ "globals": [{ "key": "K", "value": "V" }], "secrets": [...] }`}
              </code>
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='Paste JSON content here...'
              rows={8}
              className="w-full bg-transparent border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none p-2 font-mono text-[11px] text-[hsl(var(--ink))] resize-y"
            />
            {importError && (
              <p className="text-[10px] text-[hsl(var(--issue))] font-mono">
                ⚠ {importError}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleImportSubmit("merge")}
                className="flex-1 font-mono text-[10px] uppercase tracking-wider py-2 bg-[hsl(var(--ink))] text-[hsl(var(--paper))] hover:opacity-90 font-bold transition-all"
              >
                Merge-Import
              </button>
              <button
                onClick={() => handleImportSubmit("replace")}
                className="flex-1 font-mono text-[10px] uppercase tracking-wider py-2 border border-dashed border-[hsl(var(--issue))] text-[hsl(var(--issue))] hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))] transition-all"
              >
                Replace-Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
