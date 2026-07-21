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
  // Combine globals and secrets into a unified list for the sidebar
  const items = useMemo(() => {
    const gList = globals.map((g) => ({ ...g, type: "global" as const }));
    const sList = secrets.map((s) => ({ ...s, type: "secret" as const }));
    return [...gList, ...sList];
  }, [globals, secrets]);

  const [selectedId, setSelectedId] = useState<string | null>(
    items[0]?.id ?? null
  );
  const [showSecretMap, setShowSecretMap] = useState<Record<string, boolean>>({});

  const [searchQuery, setSearchQuery] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      return (
        item.key.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery]);

  const handleClearAllGlobals = () => {
    if (globals.length === 0) return;
    if (!confirm("Are you sure you want to delete ALL global variables? This action cannot be undone.")) return;
    onGlobalsChange([]);
    setSelectedId(secrets[0]?.id ?? null);
  };

  const handleClearAllSecrets = () => {
    if (secrets.length === 0) return;
    if (!confirm("Are you sure you want to delete ALL secrets? This action cannot be undone.")) return;
    onSecretsChange([]);
    setSelectedId(globals[0]?.id ?? null);
  };

  const handleExportAll = () => {
    const env = {
      globals: globals.map(({ key, value }) => ({ key, value })),
      secrets: secrets.map(({ key, value }) => ({ key, value })),
    };
    const data = JSON.stringify(env, null, 2);
    navigator.clipboard.writeText(data).then(() => {
      alert("Environment variables copied to clipboard!");
    });
  };

  const handleImportAll = (replace: boolean) => {
    setImportError(null);
    if (!importText.trim()) {
      setImportError("Please paste a JSON environment configuration first.");
      return;
    }
    try {
      const parsed = JSON.parse(importText);
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Input must be a JSON object containing 'globals' and/or 'secrets'.");
      }

      const importedGlobals: GlobalVar[] = [];
      const importedSecrets: SecretVar[] = [];

      if (parsed.globals) {
        if (!Array.isArray(parsed.globals)) {
          throw new Error("'globals' must be an array.");
        }
        parsed.globals.forEach((g: any, index: number) => {
          if (!g || typeof g !== "object" || typeof g.key !== "string") {
            throw new Error(`Invalid global variable definition at index ${index}`);
          }
          importedGlobals.push({
            id: cryptoId(),
            key: g.key,
            value: typeof g.value === "string" ? g.value : JSON.stringify(g.value),
          });
        });
      }

      if (parsed.secrets) {
        if (!Array.isArray(parsed.secrets)) {
          throw new Error("'secrets' must be an array.");
        }
        parsed.secrets.forEach((s: any, index: number) => {
          if (!s || typeof s !== "object" || typeof s.key !== "string") {
            throw new Error(`Invalid secret definition at index ${index}`);
          }
          importedSecrets.push({
            id: cryptoId(),
            key: s.key,
            value: typeof s.value === "string" ? s.value : JSON.stringify(s.value),
          });
        });
      }

      if (importedGlobals.length === 0 && importedSecrets.length === 0) {
        throw new Error("No variables found to import. Verify your JSON format.");
      }

      if (replace) {
        if (!confirm("Are you sure you want to REPLACE all current globals and secrets with the imported ones?")) {
          return;
        }
        onGlobalsChange(importedGlobals);
        onSecretsChange(importedSecrets);
        setSelectedId(importedGlobals[0]?.id ?? importedSecrets[0]?.id ?? null);
      } else {
        // Merge-import
        const nextGlobals = [...globals];
        importedGlobals.forEach((ig) => {
          const idx = nextGlobals.findIndex((g) => g.key.toLowerCase() === ig.key.toLowerCase());
          if (idx >= 0) {
            nextGlobals[idx] = ig;
          } else {
            nextGlobals.push(ig);
          }
        });

        const nextSecrets = [...secrets];
        importedSecrets.forEach((is) => {
          const idx = nextSecrets.findIndex((s) => s.key.toLowerCase() === is.key.toLowerCase());
          if (idx >= 0) {
            nextSecrets[idx] = is;
          } else {
            nextSecrets.push(is);
          }
        });

        onGlobalsChange(nextGlobals);
        onSecretsChange(nextSecrets);
        setSelectedId(importedGlobals[0]?.id ?? importedSecrets[0]?.id ?? null);
      }

      setImportText("");
      alert("Environment successfully imported!");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to parse JSON");
    }
  };

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

  const toggleSecretVisibility = (id: string) => {
    setShowSecretMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--ink)/0.35)] backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] flex flex-col h-[600px] max-h-[90vh]">

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

            {/* Sidebar Search */}
            <div className="p-2 border-b border-dashed border-[hsl(var(--grid-line))]">
              <div className="flex items-center gap-1.5 border border-dashed border-[hsl(var(--grid-line))] focus-within:border-[hsl(var(--ink))] px-2 bg-transparent">
                <span className="font-mono text-[10px] text-[hsl(var(--ink-faint))]">/</span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="search variables…"
                  className="flex-1 bg-transparent py-1 font-mono text-[10px] text-[hsl(var(--ink))] placeholder:text-[hsl(var(--ink-faint))] outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="font-mono text-[10px] text-[hsl(var(--ink-faint))] hover:text-[hsl(var(--ink))]"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredItems.length === 0 && (
                <div className="p-3 font-mono text-[10px] text-[hsl(var(--ink-faint))] leading-relaxed text-center">
                  No variables found.
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

            {/* Sidebar Bulk Clear Actions */}
            <div className="p-2 border-t border-dashed border-[hsl(var(--grid-line))] space-y-1.5">
              <button
                disabled={globals.length === 0}
                onClick={handleClearAllGlobals}
                className="w-full font-mono text-[9px] uppercase tracking-wider px-2 py-1.5 border border-dashed text-[hsl(var(--issue))] border-[hsl(var(--issue))] hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))] disabled:opacity-40 disabled:cursor-not-allowed text-left"
              >
                Clear All Globals
              </button>
              <button
                disabled={secrets.length === 0}
                onClick={handleClearAllSecrets}
                className="w-full font-mono text-[9px] uppercase tracking-wider px-2 py-1.5 border border-dashed text-[hsl(var(--issue))] border-[hsl(var(--issue))] hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))] disabled:opacity-40 disabled:cursor-not-allowed text-left"
              >
                Clear All Secrets
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
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-2 bg-[hsl(var(--ink)/0.02)] mb-4">
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

                <p className="uppercase tracking-[0.2em] text-[10px] text-[hsl(var(--ink-soft))] pt-2">
                  Backup & Portability
                </p>
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-3 bg-[hsl(var(--ink)/0.02)] text-[hsl(var(--ink))]">
                  <p className="text-[10px] text-[hsl(var(--ink-soft))]">
                    Backup or share your workspace environment. API Keys/secrets values are included in plaintext in the JSON.
                  </p>
                  <button
                    type="button"
                    onClick={handleExportAll}
                    className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
                  >
                    Export Environment (Copy JSON)
                  </button>

                  <div className="space-y-1 pt-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] block">
                      Import Environment
                    </span>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder='Paste environment JSON here, e.g. { "globals": [], "secrets": [] }'
                      rows={4}
                      className={`w-full bg-[hsl(var(--paper))] border border-dashed outline-none p-2 font-mono text-[10px] resize-none ${
                        importError
                          ? "border-[hsl(var(--issue))] text-[hsl(var(--issue))]"
                          : "border-[hsl(var(--grid-line))] focus:border-[hsl(var(--ink))]"
                      }`}
                    />
                    {importError && (
                      <p className="text-[9px] text-[hsl(var(--issue))] leading-normal">
                        ⚠ {importError}
                      </p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleImportAll(false)}
                        className="font-mono text-[9px] uppercase tracking-wider px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
                      >
                        Merge Import
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImportAll(true)}
                        className="font-mono text-[9px] uppercase tracking-wider px-2 py-1 border border-dashed border-[hsl(var(--issue))] text-[hsl(var(--issue))] hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))]"
                      >
                        Replace All & Import
                      </button>
                    </div>
                  </div>
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
    </div>
  );
}
