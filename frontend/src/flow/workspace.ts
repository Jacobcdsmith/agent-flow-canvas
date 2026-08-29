import { Workflow, loadWorkflows, saveWorkflows, loadActiveWorkflowId, saveActiveWorkflowId } from "./workflows";
import { Gateway, loadGateways, saveGateways } from "./gateways";
import { GlobalVar, SecretVar, loadGlobals, loadSecrets, saveGlobals, saveSecrets } from "./globals";
import { StatePreset, loadPresets, savePresets } from "./statePresets";

export interface WorkspaceBundle {
  version: "agent_flow.workspace.v1";
  exportedAt: number;
  activeWorkflowId: string | null;
  workflows: Workflow[];
  gateways: Gateway[];
  globals: GlobalVar[];
  secrets: SecretVar[];
  presets: Record<string, StatePreset[]>;
}

export function exportWorkspaceBundle(): WorkspaceBundle {
  const activeWorkflowId = loadActiveWorkflowId();
  const workflows = loadWorkflows();
  const gateways = loadGateways();
  const globals = loadGlobals();
  const secrets = loadSecrets();

  const presets: Record<string, StatePreset[]> = {};
  // Collect presets for default/unassigned workspace
  presets["default"] = loadPresets(null);
  // Collect presets for each workflow
  workflows.forEach((w) => {
    presets[w.id] = loadPresets(w.id);
  });

  return {
    version: "agent_flow.workspace.v1",
    exportedAt: Date.now(),
    activeWorkflowId,
    workflows,
    gateways,
    globals,
    secrets,
    presets,
  };
}

export function validateWorkspaceBundle(data: unknown): { valid: boolean; error?: string } {
  if (typeof data !== "object" || data === null) {
    return { valid: false, error: "Workspace bundle must be a JSON object" };
  }
  const bundle = data as Record<string, unknown>;
  if (bundle.version !== "agent_flow.workspace.v1") {
    return { valid: false, error: 'Invalid or unsupported version (expected "agent_flow.workspace.v1")' };
  }
  if (!Array.isArray(bundle.workflows)) {
    return { valid: false, error: "Workspace bundle missing valid workflows array" };
  }
  if (!Array.isArray(bundle.gateways)) {
    return { valid: false, error: "Workspace bundle missing valid gateways array" };
  }
  if (!Array.isArray(bundle.globals) || !Array.isArray(bundle.secrets)) {
    return { valid: false, error: "Workspace bundle missing valid globals/secrets arrays" };
  }
  return { valid: true };
}

export function importWorkspaceBundle(
  bundle: WorkspaceBundle,
  mode: "merge" | "replace"
): { success: boolean; message: string } {
  try {
    if (mode === "replace") {
      saveWorkflows(bundle.workflows);
      saveActiveWorkflowId(bundle.activeWorkflowId);
      saveGateways(bundle.gateways);
      saveGlobals(bundle.globals);
      saveSecrets(bundle.secrets);

      if (bundle.presets && typeof bundle.presets === "object") {
        Object.entries(bundle.presets).forEach(([wfId, list]) => {
          savePresets(wfId === "default" ? null : wfId, list);
        });
      }
      return { success: true, message: "Workspace completely replaced from bundle" };
    } else {
      // Merge mode
      const existingWorkflows = loadWorkflows();
      const workflowMap = new Map<string, Workflow>(existingWorkflows.map((w) => [w.id, w]));
      bundle.workflows.forEach((w) => {
        if (!workflowMap.has(w.id) || (w.updatedAt && w.updatedAt > (workflowMap.get(w.id)?.updatedAt || 0))) {
          workflowMap.set(w.id, w);
        }
      });
      saveWorkflows(Array.from(workflowMap.values()));

      const existingGateways = loadGateways();
      const gatewayMap = new Map<string, Gateway>(existingGateways.map((g) => [g.id, g]));
      bundle.gateways.forEach((g) => {
        if (!gatewayMap.has(g.id)) gatewayMap.set(g.id, g);
      });
      saveGateways(Array.from(gatewayMap.values()));

      const existingGlobals = loadGlobals();
      const globalMap = new Map<string, GlobalVar>(existingGlobals.map((g) => [g.key, g]));
      bundle.globals.forEach((g) => globalMap.set(g.key, g));
      saveGlobals(Array.from(globalMap.values()));

      const existingSecrets = loadSecrets();
      const secretMap = new Map<string, SecretVar>(existingSecrets.map((s) => [s.key, s]));
      bundle.secrets.forEach((s) => secretMap.set(s.key, s));
      saveSecrets(Array.from(secretMap.values()));

      if (bundle.presets && typeof bundle.presets === "object") {
        Object.entries(bundle.presets).forEach(([wfId, list]) => {
          const keyId = wfId === "default" ? null : wfId;
          const current = loadPresets(keyId);
          const pMap = new Map<string, StatePreset>(current.map((p) => [p.id, p]));
          list.forEach((p) => pMap.set(p.id, p));
          savePresets(keyId, Array.from(pMap.values()));
        });
      }

      return { success: true, message: "Workspace merged with imported bundle" };
    }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Import failed" };
  }
}
