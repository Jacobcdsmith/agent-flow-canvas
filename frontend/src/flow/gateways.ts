// Gateway / provider configuration. 100% client-side.
// Stored in localStorage under "agent_flow.gateways.v2".
// API keys never leave the browser.

export type Provider =
  | "openai"
  | "openai-compatible"
  | "anthropic"
  | "gemini"
  | "ollama";

export interface Gateway {
  id: string;
  name: string;
  provider: Provider;
  baseUrl: string;
  apiKey: string; // plain text in localStorage
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  extraHeaders?: Record<string, string>;
}

export const PROVIDERS: { value: Provider; label: string; needsKey: boolean }[] = [
  { value: "openai", label: "OpenAI", needsKey: true },
  { value: "openai-compatible", label: "OpenAI-compatible (OpenRouter, Groq, Together, vLLM, LM Studio…)", needsKey: true },
  { value: "anthropic", label: "Anthropic Claude", needsKey: true },
  { value: "gemini", label: "Google Gemini", needsKey: true },
  { value: "ollama", label: "Ollama (local)", needsKey: false },
];

export const PROVIDER_DEFAULTS: Record<Provider, Partial<Gateway>> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 1024,
  },
  "openai-compatible": {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 1024,
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-3-5-haiku-latest",
    temperature: 0.7,
    maxTokens: 1024,
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com",
    defaultModel: "gemini-2.5-flash",
    temperature: 0.7,
    maxTokens: 1024,
  },
  ollama: {
    baseUrl: "http://localhost:11434",
    defaultModel: "llama3.2",
    temperature: 0.7,
    maxTokens: 1024,
  },
};

export interface GatewayErrors {
  name?: string;
  baseUrl?: string;
  defaultModel?: string;
  apiKey?: string;
  temperature?: string;
  maxTokens?: string;
}

export function validateGateway(g: Gateway): GatewayErrors {
  const errs: GatewayErrors = {};
  if (!g.name?.trim()) errs.name = "required";
  const url = (g.baseUrl ?? "").trim();
  if (!url) {
    errs.baseUrl = "required";
  } else {
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        errs.baseUrl = "must be http:// or https://";
      } else if (url.endsWith("/")) {
        errs.baseUrl = "must not end with '/'";
      }
    } catch {
      errs.baseUrl = "invalid URL";
    }
  }
  if (!g.defaultModel?.trim()) errs.defaultModel = "required";
  const provMeta = PROVIDERS.find((p) => p.value === g.provider);
  if (provMeta?.needsKey && !g.apiKey?.trim()) errs.apiKey = "required for this provider";
  if (typeof g.temperature !== "number" || Number.isNaN(g.temperature)) {
    errs.temperature = "must be a number";
  } else if (g.temperature < 0 || g.temperature > 2) {
    errs.temperature = "must be 0–2";
  }
  if (!Number.isFinite(g.maxTokens) || !Number.isInteger(g.maxTokens) || g.maxTokens < 1) {
    errs.maxTokens = "must be ≥ 1";
  } else if (g.maxTokens > 32000) {
    errs.maxTokens = "must be ≤ 32000";
  }
  return errs;
}

export const hasGatewayErrors = (e: GatewayErrors) => Object.keys(e).length > 0;

const STORAGE_KEY = "agent_flow.gateways.v2";
const LEGACY_KEY = "agent_flow.gateway";

export function newGateway(provider: Provider = "openai"): Gateway {
  const d = PROVIDER_DEFAULTS[provider];
  return {
    id: cryptoId(),
    name:
      provider === "ollama"
        ? "Local Ollama"
        : provider === "anthropic"
          ? "Anthropic"
          : provider === "gemini"
            ? "Gemini"
            : provider === "openai"
              ? "OpenAI"
              : "Custom OpenAI-compatible",
    provider,
    baseUrl: d.baseUrl ?? "",
    apiKey: "",
    defaultModel: d.defaultModel ?? "",
    temperature: d.temperature ?? 0.7,
    maxTokens: d.maxTokens ?? 1024,
  };
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "gw_" + Math.random().toString(36).slice(2, 10);
}

export function loadGateways(): Gateway[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(coerceGateway);
    }
    // legacy single-gateway migration
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy);
      const migrated: Gateway = {
        ...newGateway("openai-compatible"),
        name: "Legacy gateway",
        baseUrl: old.baseUrl ?? PROVIDER_DEFAULTS["openai-compatible"].baseUrl ?? "",
        defaultModel: old.defaultModel ?? "",
        temperature: old.temperature ?? 0.7,
        maxTokens: old.maxTokens ?? 1024,
      };
      saveGateways([migrated]);
      return [migrated];
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveGateways(gws: Gateway[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gws));
  } catch {
    /* ignore */
  }
}

export function clearAllKeys(gws: Gateway[]): Gateway[] {
  const next = gws.map((g) => ({ ...g, apiKey: "" }));
  saveGateways(next);
  return next;
}

function coerceGateway(g: unknown): Gateway {
  const o = (g ?? {}) as Partial<Gateway>;
  const provider = (o.provider as Provider) || "openai";
  const def = PROVIDER_DEFAULTS[provider] ?? {};
  return {
    id: o.id ?? cryptoId(),
    name: o.name ?? "Untitled",
    provider,
    baseUrl: o.baseUrl ?? def.baseUrl ?? "",
    apiKey: o.apiKey ?? "",
    defaultModel: o.defaultModel ?? def.defaultModel ?? "",
    temperature: typeof o.temperature === "number" ? o.temperature : (def.temperature ?? 0.7),
    maxTokens: typeof o.maxTokens === "number" ? o.maxTokens : (def.maxTokens ?? 1024),
    extraHeaders: o.extraHeaders,
  };
}
