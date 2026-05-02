import { useState } from "react";

export interface GatewayConfig {
  baseUrl: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_GATEWAY: GatewayConfig = {
  baseUrl: "https://ai.gateway.lovable.dev/v1",
  defaultModel: "google/gemini-3-flash-preview",
  temperature: 0.7,
  maxTokens: 1024,
};

const MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-pro-preview",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-5.2",
];

interface Props {
  config: GatewayConfig;
  onChange: (next: GatewayConfig) => void;
  onClose: () => void;
  onReset: () => void;
}

export function GatewaySettings({ config, onChange, onClose, onReset }: Props) {
  const [local, setLocal] = useState<GatewayConfig>(config);

  const apply = (patch: Partial<GatewayConfig>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--ink)/0.35)] backdrop-blur-sm">
      <div className="w-full max-w-md bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] flex flex-col max-h-[90vh]">
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              mcp gateway
            </div>
            <h2 className="font-mono text-sm font-semibold">global settings</h2>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
          >
            close
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto font-mono text-[11px]">
          <p className="text-[10px] text-[hsl(var(--ink-faint))] leading-relaxed">
            These defaults apply to every LLM node unless overridden in the inspector.
          </p>

          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              base url
            </span>
            <input
              value={local.baseUrl}
              onChange={(e) => apply({ baseUrl: e.target.value })}
              className="mt-1 w-full bg-transparent border-b border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1 text-[hsl(var(--ink))]"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              default model
            </span>
            <select
              value={MODELS.includes(local.defaultModel) ? local.defaultModel : "__custom"}
              onChange={(e) => {
                if (e.target.value !== "__custom") apply({ defaultModel: e.target.value });
              }}
              className="mt-1 w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1.5 px-2 text-[hsl(var(--ink))]"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value="__custom">custom…</option>
            </select>
            <input
              value={local.defaultModel}
              onChange={(e) => apply({ defaultModel: e.target.value })}
              className="mt-1 w-full bg-transparent border-b border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1 text-[hsl(var(--ink))] text-[10px]"
            />
          </label>

          <label className="block">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
                temperature
              </span>
              <span className="text-[10px] text-[hsl(var(--ink))]">{local.temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={local.temperature}
              onChange={(e) => apply({ temperature: parseFloat(e.target.value) })}
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
              value={local.maxTokens}
              onChange={(e) => apply({ maxTokens: parseInt(e.target.value || "0", 10) || 0 })}
              className="mt-1 w-full bg-transparent border-b border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1 text-[hsl(var(--ink))]"
            />
          </label>

          <div
            className="border border-dashed border-[hsl(var(--grid-line))] p-2 text-[10px] text-[hsl(var(--ink-soft))] leading-relaxed"
            style={{ background: "hsl(var(--ink) / 0.03)" }}
          >
            <span className="uppercase tracking-[0.15em] text-[hsl(var(--ink-faint))]">per-node override:</span>{" "}
            select an LLM node, then set <code className="text-[hsl(var(--ink))]">model</code>,{" "}
            <code className="text-[hsl(var(--ink))]">temperature</code>, or{" "}
            <code className="text-[hsl(var(--ink))]">max_tokens</code> in the Inspector.
          </div>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-dashed border-[hsl(var(--grid-line))]">
          <button
            onClick={() => {
              setLocal(DEFAULT_GATEWAY);
              onReset();
            }}
            className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
          >
            reset
          </button>
          <button
            onClick={onClose}
            className="ml-auto font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-dashed text-[hsl(var(--paper))]"
            style={{ background: "var(--gradient-accent)", borderColor: "hsl(var(--accent-deep))" }}
          >
            done
          </button>
        </div>
      </div>
    </div>
  );
}
