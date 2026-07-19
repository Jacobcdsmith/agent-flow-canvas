// Global Variables & Secrets management. 100% client-side.
// Stored in localStorage under "agent_flow.globals" and "agent_flow.secrets".
// Sensitive keys/values never leave the browser.

export interface GlobalVariable {
  id: string;
  key: string;
  value: string;
}

export interface Secret {
  id: string;
  key: string;
  value: string;
}

const GLOBALS_STORAGE_KEY = "agent_flow.globals";
const SECRETS_STORAGE_KEY = "agent_flow.secrets";

export function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "id_" + Math.random().toString(36).slice(2, 10);
}

export function newGlobal(): GlobalVariable {
  return {
    id: cryptoId(),
    key: "NEW_GLOBAL",
    value: "",
  };
}

export function newSecret(): Secret {
  return {
    id: cryptoId(),
    key: "NEW_SECRET",
    value: "",
  };
}

export function loadGlobals(): GlobalVariable[] {
  try {
    const raw = localStorage.getItem(GLOBALS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          id: item.id || cryptoId(),
          key: String(item.key || ""),
          value: String(item.value || ""),
        }));
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveGlobals(items: GlobalVariable[]): void {
  try {
    localStorage.setItem(GLOBALS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function loadSecrets(): Secret[] {
  try {
    const raw = localStorage.getItem(SECRETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          id: item.id || cryptoId(),
          key: String(item.key || ""),
          value: String(item.value || ""),
        }));
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveSecrets(items: Secret[]): void {
  try {
    localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

/**
 * Validates a key name.
 * Returns an error string or null if valid.
 */
export function validateKeyName(key: string, existingKeys: string[], id: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) {
    return "Key name is required";
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    return "Must be a valid variable name (letters, numbers, underscores, starting with letter/underscore)";
  }
  const isDuplicate = existingKeys.some((k, idx) => k.toLowerCase() === trimmed.toLowerCase());
  if (isDuplicate) {
    return "Key name must be unique";
  }
  return null;
}
