import { Workflow, loadWorkflows, saveWorkflows, loadActiveWorkflowId, saveActiveWorkflowId } from "./workflows";
import { GlobalVar, SecretVar, loadGlobals, saveGlobals, loadSecrets, saveSecrets } from "./globals";
import { Gateway, loadGateways, saveGateways } from "./gateways";
import { StatePreset, loadPresets, savePresets } from "./statePresets";

export interface AgentFlowWorkspaceBundle {
  version: "agent_flow.workspace.v1";
  exportedAt: number;
  activeWorkflowId: string | null;
  workflows: Workflow[];
  globals: GlobalVar[];
  secrets: SecretVar[];
  gateways: Gateway[];
  statePresetsMap: Record<string, StatePreset[]>;
}

export function exportWorkspaceBundle(maskSensitiveKeys = false): AgentFlowWorkspaceBundle {
  const activeWfId = loadActiveWorkflowId();
  const workflows = loadWorkflows();
  const globals = loadGlobals();
  const secrets = loadSecrets();
  let gateways = loadGateways();

  if (maskSensitiveKeys) {
    gateways = gateways.map((g) => ({
      ...g,
      apiKey: g.apiKey ? "********" : "",
    }));
  }

  const statePresetsMap: Record<string, StatePreset[]> = {};
  const allWfIds = ["default", ...workflows.map((w) => w.id)];
  allWfIds.forEach((id) => {
    const presets = loadPresets(id);
    if (presets.length > 0) {
      statePresetsMap[id] = presets;
    }
  });

  return {
    version: "agent_flow.workspace.v1",
    exportedAt: Date.now(),
    activeWorkflowId: activeWfId,
    workflows,
    globals,
    secrets,
    gateways,
    statePresetsMap,
  };
}

export function importWorkspaceBundle(
  bundle: unknown,
  mode: "merge" | "replace" = "merge"
): { success: boolean; message: string; workflowsImported: number } {
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    return { success: false, message: "Invalid workspace bundle format", workflowsImported: 0 };
  }

  const data = bundle as Partial<AgentFlowWorkspaceBundle>;

  if (data.version !== "agent_flow.workspace.v1") {
    return { success: false, message: `Unsupported version: ${data.version || "unknown"}`, workflowsImported: 0 };
  }

  const incomingWorkflows = Array.isArray(data.workflows) ? data.workflows : [];
  const incomingGlobals = Array.isArray(data.globals) ? data.globals : [];
  const incomingSecrets = Array.isArray(data.secrets) ? data.secrets : [];
  const incomingGateways = Array.isArray(data.gateways) ? data.gateways : [];
  const incomingPresetsMap = data.statePresetsMap && typeof data.statePresetsMap === "object" ? data.statePresetsMap : {};

  if (mode === "replace") {
    saveWorkflows(incomingWorkflows);
    saveGlobals(incomingGlobals);
    saveSecrets(incomingSecrets);
    saveGateways(incomingGateways);
    saveActiveWorkflowId(data.activeWorkflowId ?? null);

    Object.entries(incomingPresetsMap).forEach(([wfId, presets]) => {
      savePresets(wfId, presets);
    });

    return {
      success: true,
      message: `Full workspace replaced successfully (${incomingWorkflows.length} workflows restored)`,
      workflowsImported: incomingWorkflows.length,
    };
  }

  // Merge Mode
  const existingWorkflows = loadWorkflows();
  const wfMap = new Map(existingWorkflows.map((w) => [w.id, w]));
  incomingWorkflows.forEach((w) => wfMap.set(w.id, w));
  const mergedWorkflows = Array.from(wfMap.values());
  saveWorkflows(mergedWorkflows);

  // Merge Globals
  const existingGlobals = loadGlobals();
  const gMap = new Map(existingGlobals.map((g) => [g.key, g]));
  incomingGlobals.forEach((g) => gMap.set(g.key, g));
  saveGlobals(Array.from(gMap.values()));

  // Merge Secrets
  const existingSecrets = loadSecrets();
  const sMap = new Map(existingSecrets.map((s) => [s.key, s]));
  incomingSecrets.forEach((s) => sMap.set(s.key, s));
  saveSecrets(Array.from(sMap.values()));

  // Merge Gateways
  const existingGateways = loadGateways();
  const gwMap = new Map(existingGateways.map((gw) => [gw.id, gw]));
  incomingGateways.forEach((gw) => gwMap.set(gw.id, gw));
  saveGateways(Array.from(gwMap.values()));

  // Merge Presets
  Object.entries(incomingPresetsMap).forEach(([wfId, incomingPresets]) => {
    const existingPresets = loadPresets(wfId);
    const pMap = new Map(existingPresets.map((p) => [p.id, p]));
    incomingPresets.forEach((p) => pMap.set(p.id, p));
    savePresets(wfId, Array.from(pMap.values()));
  });

  return {
    success: true,
    message: `Merged workspace successfully (${incomingWorkflows.length} workflows processed)`,
    workflowsImported: incomingWorkflows.length,
  };
}
