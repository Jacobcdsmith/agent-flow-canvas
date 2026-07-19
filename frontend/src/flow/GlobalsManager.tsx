import { useState, useMemo } from "react";
import {
  GlobalVariable,
  Secret,
  newGlobal,
  newSecret,
  validateKeyName,
} from "./globals";

interface Props {
  globals: GlobalVariable[];
  onGlobalsChange: (next: GlobalVariable[]) => void;
  secrets: Secret[];
  onSecretsChange: (next: Secret[]) => void;
  onClose: () => void;
}

type Tab = "globals" | "secrets";

export function GlobalsManager({
  globals,
  onGlobalsChange,
  secrets,
  onSecretsChange,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("globals");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showValueMap, setShowValueMap] = useState<Record<string, boolean>>({});

  // Auto-select first item if selectedId is null and items are available
  const activeItems = activeTab === "globals" ? globals : secrets;
  const selected = activeItems.find((item) => item.id === selectedId) ?? activeItems[0] ?? null;

  const keyError = useMemo(() => {
    if (!selected) return null;
    const existingKeys = activeItems
      .filter((item) => item.id !== selected.id)
      .map((item) => item.key);
    return validateKeyName(selected.key, existingKeys, selected.id);
  }, [selected, activeItems]);

  const updateSelected = (patch: Partial<GlobalVariable | Secret>) => {
    if (!selected) return;
    if (activeTab === "globals") {
      const nextGlobals = globals.map((g) =>
        g.id === selected.id ? { ...g, ...patch } as GlobalVariable : g
      );
      onGlobalsChange(nextGlobals);
    } else {
      const nextSecrets = secrets.map((s) =>
        s.id === selected.id ? { ...s, ...patch } as Secret : s
      );
      onSecretsChange(nextSecrets);
    }
  };

  const addItem = () => {
    if (activeTab === "globals") {
      const g = newGlobal();
      // Ensure unique name
      let key = "GLOBAL_VAR";
      let count = 1;
      while (globals.some((x) => x.key === key)) {
        key = `GLOBAL_VAR_${count++}`;
      }
      g.key = key;
      onGlobalsChange([...globals, g]);
      setSelectedId(g.id);
    } else {
      const s = newSecret();
      let key = "SECRET_VAR";
      let count = 1;
      while (secrets.some((x) => x.key === key)) {
        key = `SECRET_VAR_${count++}`;
      }
      s.key = key;
      onSecretsChange([...secrets, s]);
      setSelectedId(s.id);
    }
  };

  const deleteSelected = () => {
    if (!selected) return;
    if (!confirm(`Delete variable "${selected.key}"?`)) return;
    if (activeTab === "globals") {
      const next = globals.filter((g) => g.id !== selected.id);
      onGlobalsChange(next);
      setSelectedId(next[0]?.id ?? null);
    } else {
      const next = secrets.filter((s) => s.id !== selected.id);
      onSecretsChange(next);
      setSelectedId(next[0]?.id ?? null);
    }
  };

  const toggleValueVisibility = (id: string) => {
    setShowValueMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--ink)/0.35)] backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] flex flex-col max-h-[90vh]">
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              globals & secrets
            </div>
            <h2 className="font-mono text-sm font-semibold">
              Manage Environment & State Constants
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
          >
            close
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* sidebar */}
          <aside className="w-[200px] shrink-0 border-r border-dashed border-[hsl(var(--grid-line))] flex flex-col">
            {/* Tabs Selector */}
            <div className="flex border-b border-dashed border-[hsl(var(--grid-line))]">
              <button
                onClick={() => {
                  setActiveTab("globals");
                  setSelectedId(null);
                }}
                className={`flex-1 font-mono text-[10px] uppercase tracking-wider py-2 border-r border-dashed border-[hsl(var(--grid-line))] ${
                  activeTab === "globals"
                    ? "bg-[hsl(var(--ink)/0.06)] font-bold"
                    : "hover:bg-[hsl(var(--ink)/0.03)]"
                }`}
              >
                Globals ({globals.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab("secrets");
                  setSelectedId(null);
                }}
                className={`flex-1 font-mono text-[10px] uppercase tracking-wider py-2 ${
                  activeTab === "secrets"
                    ? "bg-[hsl(var(--ink)/0.06)] font-bold"
                    : "hover:bg-[hsl(var(--ink)/0.03)]"
                }`}
              >
                Secrets ({secrets.length})
              </button>
            </div>

            <div className="p-2 border-b border-dashed border-[hsl(var(--grid-line))]">
              <button
                onClick={addItem}
                className="w-full font-mono text-[10px] uppercase tracking-wider px-2 py-1.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
              >
                + add {activeTab === "globals" ? "global" : "secret"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {activeItems.length === 0 && (
                <div className="p-3 font-mono text-[10px] text-[hsl(var(--ink-faint))] leading-relaxed">
                  No {activeTab} yet. Define constants that can be used in HTTP requests, prompts, and scripts using {"{{global.VAR}}"} or {"{{secret.VAR}}"}.
                </div>
              )}
              {activeItems.map((item) => {
                const existing = activeItems
                  .filter((x) => x.id !== item.id)
                  .map((x) => x.key);
                const err = validateKeyName(item.key, existing, item.id);
                const hasError = !!err;
                const isSel = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left px-3 py-2 border-b border-dashed border-[hsl(var(--grid-line))] font-mono text-[11px] ${
                      isSel
                        ? "bg-[hsl(var(--ink)/0.06)]"
                        : "hover:bg-[hsl(var(--ink)/0.03)]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {hasError && (
                        <span className="text-[hsl(var(--issue))]" title={err || ""}>
                          ⚠
                        </span>
                      )}
                      <span className="truncate">{item.key || "untitled"}</span>
                    </div>
                    {item.value && (
                      <div className="text-[9px] text-[hsl(var(--ink-faint))] mt-0.5 truncate">
                        {activeTab === "secrets" ? "••••••••" : item.value}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* editor */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            {!selected ? (
              <div className="p-6 font-mono text-[11px] text-[hsl(var(--ink-faint))] leading-relaxed">
                <p className="mb-2 uppercase tracking-[0.2em] text-[10px]">
                  no {activeTab === "globals" ? "global variable" : "secret"} selected
                </p>
                <p className="mb-4">
                  Select or add a {activeTab === "globals" ? "global variable" : "secret"} from the left sidebar to edit its key-value pairing.
                </p>
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 bg-[hsl(var(--ink)/0.01)] text-[10px]">
                  <span className="font-bold uppercase tracking-wide block mb-1">Interpolation Syntax:</span>
                  Use template variables in LLM prompts, HTTP paths/headers/bodies, and tools.
                  <ul className="list-disc pl-4 mt-1.5 space-y-1">
                    <li><code className="bg-[hsl(var(--ink)/0.05)] px-1 py-0.5">{"{{global.VARIABLE_NAME}}"}</code></li>
                    <li><code className="bg-[hsl(var(--ink)/0.05)] px-1 py-0.5">{"{{secret.SECRET_NAME}}"}</code></li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4 font-mono text-[11px]">
                <div
                  className="border border-dashed border-[hsl(var(--grid-line))] p-2 text-[10px] leading-relaxed"
                  style={{ background: "hsl(var(--ink)/0.03)", color: "hsl(var(--ink-soft))" }}
                >
                  <span className="uppercase tracking-[0.15em] text-[hsl(var(--ink-faint))]">
                    usage ·
                  </span>{" "}
                  Reference this variable inside curly braces:{" "}
                  <code className="text-[hsl(var(--ink))]">
                    {"{{"}
                    {activeTab === "globals" ? "global" : "secret"}
                    {"."}
                    {selected.key || "VAR"}
                    {"}}"}
                  </code>
                </div>

                {/* Key Field */}
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
                    variable key / identifier
                  </span>
                  <input
                    value={selected.key}
                    onChange={(e) => updateSelected({ key: e.target.value.toUpperCase() })}
                    aria-invalid={!!keyError}
                    className={`mt-1 w-full bg-transparent border-b border-dashed outline-none py-1 text-[hsl(var(--ink))] ${
                      keyError
                        ? "border-[hsl(var(--issue))]"
                        : "border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))]"
                    }`}
                  />
                  {keyError && (
                    <p className="mt-1 text-[10px] text-[hsl(var(--issue))]">⚠ {keyError}</p>
                  )}
                </label>

                {/* Value Field */}
                <label className="block">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
                      value
                    </span>
                    {activeTab === "secrets" && (
                      <button
                        type="button"
                        onClick={() => toggleValueVisibility(selected.id)}
                        className="text-[10px] uppercase tracking-wider text-[hsl(var(--ink-faint))] hover:text-[hsl(var(--ink))]"
                      >
                        {showValueMap[selected.id] ? "hide value" : "show value"}
                      </button>
                    )}
                  </div>
                  {activeTab === "globals" ? (
                    <textarea
                      value={selected.value}
                      onChange={(e) => updateSelected({ value: e.target.value })}
                      rows={3}
                      className="mt-1 w-full bg-transparent border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none p-1.5 font-mono text-[11px] text-[hsl(var(--ink))] resize-y"
                      placeholder="Enter value"
                    />
                  ) : (
                    <input
                      type={showValueMap[selected.id] ? "text" : "password"}
                      value={selected.value}
                      onChange={(e) => updateSelected({ value: e.target.value })}
                      className="mt-1 w-full bg-transparent border-b border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1 text-[hsl(var(--ink))] placeholder:text-[hsl(var(--ink-faint))]"
                      placeholder="sk-..."
                    />
                  )}
                </label>

                <div className="pt-4 flex border-t border-dashed border-[hsl(var(--grid-line))]">
                  <button
                    onClick={deleteSelected}
                    className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-dashed text-[hsl(var(--issue))] border-[hsl(var(--issue))] hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))]"
                  >
                    delete variable
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
