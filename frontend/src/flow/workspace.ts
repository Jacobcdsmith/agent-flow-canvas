import { Workflow, loadWorkflows, saveWorkflows, loadActiveWorkflowId, saveActiveWorkflowId } from "./workflows";
import { StatePreset, loadPresets, savePresets } from "./statePresets";
import { GlobalVar, SecretVar, loadGlobals, saveGlobals, loadSecrets, saveSecrets } from "./globals";
import { Gateway, loadGateways, saveGateways } from "./gateways";

export interface WorkspaceBundle {
  version: "agent_flow.workspace.v1";
  timestamp: number;
  workflows: Workflow[];
  activeWorkflowId: string | null;
  presets: Record<string, StatePreset[]>;
  globals: GlobalVar[];
  secrets: SecretVar[];
  gateways: Gateway[];
}

export function exportWorkspaceBundle(options?: {
  includeSecretValues?: boolean;
  includeGatewayKeys?: boolean;
}): WorkspaceBundle {
  const workflows = loadWorkflows();
  const activeWorkflowId = loadActiveWorkflowId();
  const globals = loadGlobals();
  let secrets = loadSecrets();
  let gateways = loadGateways();

  if (!options?.includeSecretValues) {
    secrets = secrets.map((s) => ({ ...s, value: "" }));
  }

  if (!options?.includeGatewayKeys) {
    gateways = gateways.map((g) => ({ ...g, apiKey: "" }));
  }

  // Gather presets across all custom workflows and default
  const presets: Record<string, StatePreset[]> = {};
  presets["default"] = loadPresets(null);
  workflows.forEach((w) => {
    presets[w.id] = loadPresets(w.id);
  });

  return {
    version: "agent_flow.workspace.v1",
    timestamp: Date.now(),
    workflows,
    activeWorkflowId,
    presets,
    globals,
    secrets,
    gateways,
  };
}

export function importWorkspaceBundle(
  bundle: Partial<WorkspaceBundle>,
  options: { mode: "merge" | "replace" }
): {
  workflowsCount: number;
  globalsCount: number;
  gatewaysCount: number;
  presetsCount: number;
} {
  if (!bundle || bundle.version !== "agent_flow.workspace.v1") {
    throw new Error("Invalid workspace bundle format or missing version string");
  }

  let workflowsCount = 0;
  let globalsCount = 0;
  let gatewaysCount = 0;
  let presetsCount = 0;

  // Workflows
  if (Array.isArray(bundle.workflows)) {
    if (options.mode === "replace") {
      saveWorkflows(bundle.workflows);
      workflowsCount = bundle.workflows.length;
    } else {
      const existing = loadWorkflows();
      const existingIds = new Set(existing.map((w) => w.id));
      const newWorkflows = bundle.workflows.filter((w) => !existingIds.has(w.id));
      const merged = [...existing, ...newWorkflows];
      saveWorkflows(merged);
      workflowsCount = newWorkflows.length;
    }
  }

  if (bundle.activeWorkflowId !== undefined && options.mode === "replace") {
    saveActiveWorkflowId(bundle.activeWorkflowId);
  }

  // Globals
  if (Array.isArray(bundle.globals)) {
    if (options.mode === "replace") {
      saveGlobals(bundle.globals);
      globalsCount = bundle.globals.length;
    } else {
      const existing = loadGlobals();
      const existingKeys = new Set(existing.map((g) => g.key));
      const newGlobals = bundle.globals.filter((g) => !existingKeys.has(g.key));
      const merged = [...existing, ...newGlobals];
      saveGlobals(merged);
      globalsCount = newGlobals.length;
    }
  }

  // Secrets
  if (Array.isArray(bundle.secrets)) {
    if (options.mode === "replace") {
      saveSecrets(bundle.secrets);
    } else {
      const existing = loadSecrets();
      const existingKeys = new Set(existing.map((s) => s.key));
      const newSecrets = bundle.secrets.filter((s) => !existingKeys.has(s.key));
      saveSecrets([...existing, ...newSecrets]);
    }
  }

  // Gateways
  if (Array.isArray(bundle.gateways)) {
    if (options.mode === "replace") {
      saveGateways(bundle.gateways);
      gatewaysCount = bundle.gateways.length;
    } else {
      const existing = loadGateways();
      const existingIds = new Set(existing.map((g) => g.id));
      const newGateways = bundle.gateways.filter((g) => !existingIds.has(g.id));
      saveGateways([...existing, ...newGateways]);
      gatewaysCount = newGateways.length;
    }
  }

  // Presets
  if (bundle.presets && typeof bundle.presets === "object") {
    Object.entries(bundle.presets).forEach(([wfId, presetList]) => {
      if (Array.isArray(presetList)) {
        if (options.mode === "replace") {
          savePresets(wfId === "default" ? null : wfId, presetList);
          presetsCount += presetList.length;
        } else {
          const targetWfId = wfId === "default" ? null : wfId;
          const existing = loadPresets(targetWfId);
          const existingIds = new Set(existing.map((p) => p.id));
          const newPresets = presetList.filter((p) => !existingIds.has(p.id));
          savePresets(targetWfId, [...existing, ...newPresets]);
          presetsCount += newPresets.length;
        }
      }
    });
  }

  return {
    workflowsCount,
    globalsCount,
    gatewaysCount,
    presetsCount,
  };
}

export function downloadWorkspaceBundle(includeSecretValues = false): void {
  const bundle = exportWorkspaceBundle({
    includeSecretValues,
    includeGatewayKeys: includeSecretValues,
  });
  const data = JSON.stringify(bundle, null, 2);
  const blob = new Blob([data], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agent_flow_workspace_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
