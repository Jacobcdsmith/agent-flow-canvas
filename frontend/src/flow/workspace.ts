import { Workflow, loadWorkflows, saveWorkflows } from "./workflows";
import { StatePreset } from "./statePresets";
import { GlobalVar, SecretVar, loadGlobals, saveGlobals, loadSecrets, saveSecrets } from "./globals";
import { Gateway, loadGateways, saveGateways } from "./gateways";

export const WORKSPACE_SCHEMA_VERSION = "agent_flow.workspace.v1";

export interface WorkspaceBundle {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  exportedAt: number;
  workflows: Workflow[];
  presets: Record<string, StatePreset[]>;
  globals: GlobalVar[];
  secrets: SecretVar[];
  gateways: Gateway[];
}

/**
 * Reads all state presets from localStorage for all custom and template workflows.
 */
export function loadAllPresets(): Record<string, StatePreset[]> {
  const result: Record<string, StatePreset[]> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("agent_flow.state_presets.v1.")) {
        const wfId = key.replace("agent_flow.state_presets.v1.", "");
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              result[wfId] = parsed;
            }
          } catch {}
        }
      }
    }
  } catch {}
  return result;
}

/**
 * Saves state presets map to localStorage.
 */
export function saveAllPresets(presetsMap: Record<string, StatePreset[]>, replaceMode = false): void {
  try {
    if (replaceMode) {
      // Clear existing preset keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("agent_flow.state_presets.v1.")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }

    Object.entries(presetsMap).forEach(([wfId, presetsList]) => {
      const storageKey = `agent_flow.state_presets.v1.${wfId}`;
      if (replaceMode) {
        localStorage.setItem(storageKey, JSON.stringify(presetsList));
      } else {
        // Merge mode: combine existing and new presets by id
        let existing: StatePreset[] = [];
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) existing = JSON.parse(raw);
        } catch {}
        const mergedMap = new Map<string, StatePreset>();
        existing.forEach((p) => mergedMap.set(p.id, p));
        presetsList.forEach((p) => mergedMap.set(p.id, p));
        localStorage.setItem(storageKey, JSON.stringify(Array.from(mergedMap.values())));
      }
    });
  } catch {}
}

/**
 * Builds a complete WorkspaceBundle containing all custom workflows, presets, globals, secrets, and gateway profiles.
 */
export function exportWorkspaceBundle(): WorkspaceBundle {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt: Date.now(),
    workflows: loadWorkflows(),
    presets: loadAllPresets(),
    globals: loadGlobals(),
    secrets: loadSecrets(),
    gateways: loadGateways(),
  };
}

/**
 * Downloads a workspace bundle as a formatted JSON file.
 */
export function downloadWorkspaceBundleFile(): void {
  const bundle = exportWorkspaceBundle();
  const jsonStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `agent_flow_workspace_${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Validates whether a JSON string is a valid WorkspaceBundle.
 */
export function validateWorkspaceBundle(jsonStr: string): { valid: boolean; error?: string; bundle?: WorkspaceBundle } {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== "object") {
      return { valid: false, error: "Parsed content is not a JSON object" };
    }
    if (parsed.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
      return { valid: false, error: `Invalid schemaVersion (expected "${WORKSPACE_SCHEMA_VERSION}")` };
    }
    if (!Array.isArray(parsed.workflows)) {
      return { valid: false, error: "Missing or invalid 'workflows' array" };
    }
    if (!Array.isArray(parsed.globals)) {
      return { valid: false, error: "Missing or invalid 'globals' array" };
    }
    if (!Array.isArray(parsed.secrets)) {
      return { valid: false, error: "Missing or invalid 'secrets' array" };
    }
    if (!Array.isArray(parsed.gateways)) {
      return { valid: false, error: "Missing or invalid 'gateways' array" };
    }
    return { valid: true, bundle: parsed as WorkspaceBundle };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "Invalid JSON string" };
  }
}

/**
 * Imports a WorkspaceBundle into browser localStorage in either 'merge' or 'replace' mode.
 */
export function importWorkspaceBundle(
  bundle: WorkspaceBundle,
  mode: "merge" | "replace"
): { workflows: Workflow[]; globals: GlobalVar[]; secrets: SecretVar[]; gateways: Gateway[] } {
  const replaceMode = mode === "replace";

  // 1. Workflows
  let finalWorkflows: Workflow[];
  if (replaceMode) {
    finalWorkflows = bundle.workflows;
  } else {
    const existing = loadWorkflows();
    const wfMap = new Map<string, Workflow>();
    existing.forEach((w) => wfMap.set(w.id, w));
    bundle.workflows.forEach((w) => wfMap.set(w.id, w));
    finalWorkflows = Array.from(wfMap.values());
  }
  saveWorkflows(finalWorkflows);

  // 2. State Presets
  saveAllPresets(bundle.presets || {}, replaceMode);

  // 3. Globals
  let finalGlobals: GlobalVar[];
  if (replaceMode) {
    finalGlobals = bundle.globals;
  } else {
    const existing = loadGlobals();
    const gMap = new Map<string, GlobalVar>();
    existing.forEach((g) => gMap.set(g.key, g));
    bundle.globals.forEach((g) => gMap.set(g.key, g));
    finalGlobals = Array.from(gMap.values());
  }
  saveGlobals(finalGlobals);

  // 4. Secrets
  let finalSecrets: SecretVar[];
  if (replaceMode) {
    finalSecrets = bundle.secrets;
  } else {
    const existing = loadSecrets();
    const sMap = new Map<string, SecretVar>();
    existing.forEach((s) => sMap.set(s.key, s));
    bundle.secrets.forEach((s) => sMap.set(s.key, s));
    finalSecrets = Array.from(sMap.values());
  }
  saveSecrets(finalSecrets);

  // 5. Gateways
  let finalGateways: Gateway[];
  if (replaceMode) {
    finalGateways = bundle.gateways;
  } else {
    const existing = loadGateways();
    const gwMap = new Map<string, Gateway>();
    existing.forEach((gw) => gwMap.set(gw.id, gw));
    bundle.gateways.forEach((gw) => gwMap.set(gw.id, gw));
    finalGateways = Array.from(gwMap.values());
  }
  saveGateways(finalGateways);

  return {
    workflows: finalWorkflows,
    globals: finalGlobals,
    secrets: finalSecrets,
    gateways: finalGateways,
  };
}
