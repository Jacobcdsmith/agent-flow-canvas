import { Workflow, loadWorkflows, saveWorkflows, saveActiveWorkflowId } from "./workflows";
import { StatePreset, loadPresets, savePresets } from "./statePresets";
import { GlobalVar, SecretVar, loadGlobals, saveGlobals, loadSecrets, saveSecrets } from "./globals";
import { Gateway, loadGateways, saveGateways } from "./gateways";

export interface WorkspaceBundle {
  version: "agent_flow.workspace.v1";
  exportedAt: number;
  workflows: Workflow[];
  activeWorkflowId: string | null;
  statePresets: Record<string, StatePreset[]>;
  globals: GlobalVar[];
  secrets: SecretVar[];
  gateways: Gateway[];
}

/**
 * Creates a serialized JSON string containing all user workflows, state presets,
 * global variables, secret definitions, and gateway profiles.
 */
export function exportWorkspaceBundle(options: { includeApiKeys?: boolean } = {}): WorkspaceBundle {
  const workflows = loadWorkflows();
  const activeWorkflowId = localStorage.getItem("agent_flow.active_workflow_id.v1") || null;

  // Gather presets across all workflows and default state
  const statePresets: Record<string, StatePreset[]> = {};
  const workflowIds = [
    "template-react",
    "template-http-router",
    "template-translation-hitl",
    ...workflows.map((w) => w.id),
  ];
  workflowIds.forEach((id) => {
    const presets = loadPresets(id);
    if (presets.length > 0) {
      statePresets[id] = presets;
    }
  });

  const globals = loadGlobals();
  const secrets = loadSecrets();
  let gateways = loadGateways();

  if (!options.includeApiKeys) {
    gateways = gateways.map((g) => ({
      ...g,
      apiKey: "",
    }));
  }

  return {
    version: "agent_flow.workspace.v1",
    exportedAt: Date.now(),
    workflows,
    activeWorkflowId,
    statePresets,
    globals,
    secrets,
    gateways,
  };
}

/**
 * Validates whether an unparsed or parsed object conforms to the WorkspaceBundle schema.
 */
export function validateWorkspaceBundle(data: unknown): {
  valid: boolean;
  error?: string;
  bundle?: WorkspaceBundle;
} {
  try {
    let obj: any = data;
    if (typeof data === "string") {
      obj = JSON.parse(data);
    }
    if (!obj || typeof obj !== "object") {
      return { valid: false, error: "Invalid JSON or workspace object" };
    }
    if (obj.version !== "agent_flow.workspace.v1") {
      return { valid: false, error: `Unsupported workspace bundle version: ${obj.version ?? "unknown"}` };
    }
    if (!Array.isArray(obj.workflows)) {
      return { valid: false, error: "Workspace bundle is missing workflows array" };
    }

    return {
      valid: true,
      bundle: {
        version: "agent_flow.workspace.v1",
        exportedAt: typeof obj.exportedAt === "number" ? obj.exportedAt : Date.now(),
        workflows: Array.isArray(obj.workflows) ? obj.workflows : [],
        activeWorkflowId: typeof obj.activeWorkflowId === "string" ? obj.activeWorkflowId : null,
        statePresets: typeof obj.statePresets === "object" && obj.statePresets !== null ? obj.statePresets : {},
        globals: Array.isArray(obj.globals) ? obj.globals : [],
        secrets: Array.isArray(obj.secrets) ? obj.secrets : [],
        gateways: Array.isArray(obj.gateways) ? obj.gateways : [],
      },
    };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "Failed to parse workspace JSON" };
  }
}

/**
 * Imports a workspace bundle into local storage using either merge or replace mode.
 */
export function importWorkspaceBundle(
  bundle: WorkspaceBundle,
  mode: "merge" | "replace" = "merge"
): {
  workflowsCount: number;
  presetsCount: number;
  globalsCount: number;
  secretsCount: number;
  gatewaysCount: number;
} {
  let existingWorkflows = mode === "merge" ? loadWorkflows() : [];
  const incomingWorkflows = bundle.workflows || [];

  // Merge workflows by ID (incoming overwrites existing with same ID)
  const workflowMap = new Map<string, Workflow>();
  existingWorkflows.forEach((w) => workflowMap.set(w.id, w));
  incomingWorkflows.forEach((w) => workflowMap.set(w.id, w));
  const finalWorkflows = Array.from(workflowMap.values());
  saveWorkflows(finalWorkflows);

  if (bundle.activeWorkflowId) {
    saveActiveWorkflowId(bundle.activeWorkflowId);
  }

  // Presets import
  let presetsImportedCount = 0;
  if (bundle.statePresets) {
    Object.entries(bundle.statePresets).forEach(([wfId, incomingPresets]) => {
      let currentPresets = mode === "merge" ? loadPresets(wfId) : [];
      const presetMap = new Map<string, StatePreset>();
      currentPresets.forEach((p) => presetMap.set(p.id, p));
      incomingPresets.forEach((p) => {
        presetMap.set(p.id, p);
        presetsImportedCount++;
      });
      savePresets(wfId, Array.from(presetMap.values()));
    });
  }

  // Globals import
  let existingGlobals = mode === "merge" ? loadGlobals() : [];
  const gMap = new Map<string, GlobalVar>();
  existingGlobals.forEach((g) => gMap.set(g.key, g));
  (bundle.globals || []).forEach((g) => gMap.set(g.key, g));
  const finalGlobals = Array.from(gMap.values()).filter((g) => g.key.trim() !== "");
  saveGlobals(finalGlobals);

  // Secrets import
  let existingSecrets = mode === "merge" ? loadSecrets() : [];
  const sMap = new Map<string, SecretVar>();
  existingSecrets.forEach((s) => sMap.set(s.key, s));
  (bundle.secrets || []).forEach((s) => sMap.set(s.key, s));
  const finalSecrets = Array.from(sMap.values()).filter((s) => s.key.trim() !== "");
  saveSecrets(finalSecrets);

  // Gateways import
  let existingGateways = mode === "merge" ? loadGateways() : [];
  const gwMap = new Map<string, Gateway>();
  existingGateways.forEach((gw) => gwMap.set(gw.id, gw));
  (bundle.gateways || []).forEach((gw) => {
    const existing = gwMap.get(gw.id);
    if (existing && !gw.apiKey && existing.apiKey) {
      // Preserve existing API key if incoming bundle omitted API keys
      gwMap.set(gw.id, { ...gw, apiKey: existing.apiKey });
    } else {
      gwMap.set(gw.id, gw);
    }
  });
  const finalGateways = Array.from(gwMap.values());
  saveGateways(finalGateways);

  return {
    workflowsCount: finalWorkflows.length,
    presetsCount: presetsImportedCount,
    globalsCount: finalGlobals.length,
    secretsCount: finalSecrets.length,
    gatewaysCount: finalGateways.length,
  };
}
