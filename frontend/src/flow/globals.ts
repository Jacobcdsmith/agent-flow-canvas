// Globals and Secrets Management
// Stored in localStorage under "agent_flow.globals" and "agent_flow.secrets"
// Values are stored client-side only.

export interface GlobalVar {
  id: string;
  key: string;
  value: string;
}

export interface SecretVar {
  id: string;
  key: string;
  value: string;
}

const GLOBALS_KEY = "agent_flow.globals";
const SECRETS_KEY = "agent_flow.secrets";

export function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "var_" + Math.random().toString(36).slice(2, 10);
}

export function loadGlobals(): GlobalVar[] {
  try {
    const raw = localStorage.getItem(GLOBALS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveGlobals(items: GlobalVar[]) {
  try {
    localStorage.setItem(GLOBALS_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function loadSecrets(): SecretVar[] {
  try {
    const raw = localStorage.getItem(SECRETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveSecrets(items: SecretVar[]) {
  try {
    localStorage.setItem(SECRETS_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}
