import { useMemo, useState } from "react";
import {
  Gateway,
  GatewayErrors,
  PROVIDERS,
  PROVIDER_DEFAULTS,
  Provider,
  hasGatewayErrors,
  newGateway,
  validateGateway,
} from "./gateways";

interface Props {
  gateways: Gateway[];
  onChange: (next: Gateway[]) => void;
  onClearAllKeys: () => void;
  onClose: () => void;
}

export function GatewayManager({ gateways, onChange, onClearAllKeys, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    gateways[0]?.id ?? null,
  );
  const [showKey, setShowKey] = useState(false);

  const selected = gateways.find((g) => g.id === selectedId) ?? null;
  const errors: GatewayErrors = useMemo(
    () => (selected ? validateGateway(selected) : {}),
    [selected],
  );
  const invalid = hasGatewayErrors(errors);

  const updateSelected = (patch: Partial<Gateway>) => {
    if (!selected) return;
    const updated = { ...selected, ...patch };
    onChange(gateways.map((g) => (g.id === selected.id ? updated : g)));
  };

  const switchProvider = (provider: Provider) => {
    if (!selected) return;
    const def = PROVIDER_DEFAULTS[provider];
    updateSelected({
      provider,
      baseUrl: def.baseUrl ?? selected.baseUrl,
      defaultModel: def.defaultModel ?? selected.defaultModel,
    });
  };

  const addGateway = (provider: Provider = "openai") => {
    const g = newGateway(provider);
    onChange([...gateways, g]);
    setSelectedId(g.id);
  };

  const removeSelected = () => {
    if (!selected) return;
    if (!confirm(`Delete gateway "${selected.name}"?`)) return;
    const next = gateways.filter((g) => g.id !== selected.id);
    onChange(next);
    setSelectedId(next[0]?.id ?? null);
  };

  const exportJSON = (includeKeys: boolean) => {
    const sanitized = gateways.map((g) =>
      includeKeys ? g : { ...g, apiKey: "" },
    );
    navigator.clipboard.writeText(JSON.stringify(sanitized, null, 2));
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
              gateways · BYO key
            </div>
            <h2 className="font-mono text-sm font-semibold">
              {gateways.length} gateway{gateways.length === 1 ? "" : "s"}
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
            <div className="p-2 border-b border-dashed border-[hsl(var(--grid-line))]">
              <button
                onClick={() => addGateway("openai")}
                className="w-full font-mono text-[10px] uppercase tracking-wider px-2 py-1.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
              >
                + add gateway
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {gateways.length === 0 && (
                <div className="p-3 font-mono text-[10px] text-[hsl(var(--ink-faint))] leading-relaxed">
                  No gateways yet. Add one to call any LLM provider directly
                  from your browser.
                </div>
              )}
              {gateways.map((g) => {
                const errs = validateGateway(g);
                const bad = hasGatewayErrors(errs);
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedId(g.id)}
                    className={`w-full text-left px-3 py-2 border-b border-dashed border-[hsl(var(--grid-line))] font-mono text-[11px] ${
                      selectedId === g.id
                        ? "bg-[hsl(var(--ink)/0.06)]"
                        : "hover:bg-[hsl(var(--ink)/0.03)]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {bad && (
                        <span className="text-[hsl(var(--issue))]" title="invalid">
                          ⚠
                        </span>
                      )}
                      <span className="truncate">{g.name || "untitled"}</span>
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.15em] text-[hsl(var(--ink-faint))] mt-0.5">
                      {g.provider}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="p-2 border-t border-dashed border-[hsl(var(--grid-line))] space-y-1.5">
              <button
                onClick={onClearAllKeys}
                title="Wipe all API keys from this browser"
                className="w-full font-mono text-[10px] uppercase tracking-wider px-2 py-1.5 border border-dashed text-[hsl(var(--issue))] border-[hsl(var(--issue))] hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))]"
              >
                clear all keys
              </button>
              <button
                onClick={() => exportJSON(false)}
                className="w-full font-mono text-[10px] uppercase tracking-wider px-2 py-1.5 border border-dashed border-[hsl(var(--ink-faint))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
                title="Copy JSON (without API keys) to clipboard"
              >
                export (no keys)
              </button>
            </div>
          </aside>

          {/* editor */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            {!selected ? (
              <div className="p-6 font-mono text-[11px] text-[hsl(var(--ink-faint))] leading-relaxed">
                <p className="mb-2 uppercase tracking-[0.2em] text-[10px]">
                  no gateway selected
                </p>
                <p>
                  Add a gateway to start calling LLMs directly from your
                  browser. Pick from OpenAI, Anthropic, Gemini, Ollama (local),
                  or any OpenAI-compatible base URL.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => addGateway(p.value)}
                      className="font-mono text-[10px] uppercase tracking-wider px-2 py-2 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] text-left"
                    >
                      + {p.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4 font-mono text-[11px]">
                <div
                  className="border border-dashed border-[hsl(var(--grid-line))] p-2 text-[10px] leading-relaxed"
                  style={{ background: "hsl(var(--ink)/0.03)", color: "hsl(var(--ink-soft))" }}
                >
                  <span className="uppercase tracking-[0.15em] text-[hsl(var(--ink-faint))]">
                    privacy ·
                  </span>{" "}
                  Keys are stored only in this browser&rsquo;s{" "}
                  <code className="text-[hsl(var(--ink))]">localStorage</code>. Nothing is sent
                  to any server we control. Each LLM node fetches the provider
                  directly from your tab.
                </div>

                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
                    name
                  </span>
                  <input
                    value={selected.name}
                    onChange={(e) => updateSelected({ name: e.target.value })}
                    aria-invalid={!!errors.name}
                    className={`mt-1 w-full bg-transparent border-b border-dashed outline-none py-1 text-[hsl(var(--ink))] ${
                      errors.name
                        ? "border-[hsl(var(--issue))]"
                        : "border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))]"
                    }`}
                  />
                  {errors.name && (
                    <p className="mt-1 text-[10px] text-[hsl(var(--issue))]">⚠ {errors.name}</p>
                  )}
                </label>

                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
                    provider
                  </span>
                  <select
                    value={selected.provider}
                    onChange={(e) => switchProvider(e.target.value as Provider)}
                    className="mt-1 w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1.5 px-2 text-[hsl(var(--ink))]"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
                    base url
                  </span>
                  <input
                    value={selected.baseUrl}
                    onChange={(e) => updateSelected({ baseUrl: e.target.value })}
                    aria-invalid={!!errors.baseUrl}
                    className={`mt-1 w-full bg-transparent border-b border-dashed outline-none py-1 text-[hsl(var(--ink))] ${
                      errors.baseUrl
                        ? "border-[hsl(var(--issue))]"
                        : "border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))]"
                    }`}
                  />
                  {errors.baseUrl && (
                    <p className="mt-1 text-[10px] text-[hsl(var(--issue))]">⚠ {errors.baseUrl}</p>
                  )}
                </label>

                <label className="block">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
                      api key
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="text-[10px] uppercase tracking-wider text-[hsl(var(--ink-faint))] hover:text-[hsl(var(--ink))]"
                    >
                      {showKey ? "hide" : "show"}
                    </button>
                  </div>
                  <input
                    type={showKey ? "text" : "password"}
                    value={selected.apiKey}
                    placeholder={
                      selected.provider === "ollama"
                        ? "(not required for local Ollama)"
                        : "sk-… / api-key"
                    }
                    onChange={(e) => updateSelected({ apiKey: e.target.value })}
                    aria-invalid={!!errors.apiKey}
                    autoComplete="off"
                    className={`mt-1 w-full bg-transparent border-b border-dashed outline-none py-1 text-[hsl(var(--ink))] ${
                      errors.apiKey
                        ? "border-[hsl(var(--issue))]"
                        : "border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))]"
                    }`}
                  />
                  {errors.apiKey && (
                    <p className="mt-1 text-[10px] text-[hsl(var(--issue))]">⚠ {errors.apiKey}</p>
                  )}
                </label>

                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
                    default model
                  </span>
                  <input
                    value={selected.defaultModel}
                    onChange={(e) => updateSelected({ defaultModel: e.target.value })}
                    aria-invalid={!!errors.defaultModel}
                    className={`mt-1 w-full bg-transparent border-b border-dashed outline-none py-1 text-[hsl(var(--ink))] ${
                      errors.defaultModel
                        ? "border-[hsl(var(--issue))]"
                        : "border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))]"
                    }`}
                  />
                  {errors.defaultModel && (
                    <p className="mt-1 text-[10px] text-[hsl(var(--issue))]">
                      ⚠ {errors.defaultModel}
                    </p>
                  )}
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
                        temperature
                      </span>
                      <span className="text-[10px] text-[hsl(var(--ink))]">
                        {selected.temperature.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={selected.temperature}
                      onChange={(e) =>
                        updateSelected({ temperature: parseFloat(e.target.value) })
                      }
                      className="mt-1 w-full accent-[hsl(var(--ink))]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
                      max tokens
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={32000}
                      value={selected.maxTokens}
                      onChange={(e) =>
                        updateSelected({
                          maxTokens: parseInt(e.target.value || "0", 10) || 0,
                        })
                      }
                      aria-invalid={!!errors.maxTokens}
                      className={`mt-1 w-full bg-transparent border-b border-dashed outline-none py-1 text-[hsl(var(--ink))] ${
                        errors.maxTokens
                          ? "border-[hsl(var(--issue))]"
                          : "border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))]"
                      }`}
                    />
                    {errors.maxTokens && (
                      <p className="mt-1 text-[10px] text-[hsl(var(--issue))]">
                        ⚠ {errors.maxTokens}
                      </p>
                    )}
                  </label>
                </div>

                {selected.provider === "anthropic" && (
                  <div
                    className="border border-dashed border-[hsl(var(--grid-line))] p-2 text-[10px] leading-relaxed text-[hsl(var(--ink-soft))]"
                    style={{ background: "hsl(var(--ink)/0.03)" }}
                  >
                    <span className="uppercase tracking-[0.15em] text-[hsl(var(--ink-faint))]">
                      note ·
                    </span>{" "}
                    Anthropic requires the
                    <code className="text-[hsl(var(--ink))]"> anthropic-dangerous-direct-browser-access</code>{" "}
                    header (sent automatically). Your key never leaves the browser.
                  </div>
                )}
                {selected.provider === "ollama" && (
                  <div
                    className="border border-dashed border-[hsl(var(--grid-line))] p-2 text-[10px] leading-relaxed text-[hsl(var(--ink-soft))]"
                    style={{ background: "hsl(var(--ink)/0.03)" }}
                  >
                    <span className="uppercase tracking-[0.15em] text-[hsl(var(--ink-faint))]">
                      note ·
                    </span>{" "}
                    For browser CORS, start Ollama with{" "}
                    <code className="text-[hsl(var(--ink))]">OLLAMA_ORIGINS=*</code> (or this app&rsquo;s origin).
                  </div>
                )}

                {invalid && (
                  <div
                    className="border border-dashed p-2 text-[10px]"
                    style={{
                      borderColor: "hsl(var(--issue))",
                      background: "hsl(var(--issue)/0.08)",
                      color: "hsl(var(--issue))",
                    }}
                  >
                    <span className="uppercase tracking-[0.15em] font-semibold">
                      ⚠ invalid
                    </span>{" "}
                    — fix the fields above before this gateway can run.
                  </div>
                )}

                <div className="pt-2 flex">
                  <button
                    onClick={removeSelected}
                    className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-dashed text-[hsl(var(--issue))] border-[hsl(var(--issue))] hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))]"
                  >
                    delete gateway
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
