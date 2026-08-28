import { describe, it, expect, beforeEach } from "vitest";
import {
  WorkspaceBundle,
  exportWorkspaceBundle,
  importWorkspaceBundle,
} from "../flow/workspace";
import { saveWorkflows, loadWorkflows } from "../flow/workflows";
import { saveGlobals, loadGlobals } from "../flow/globals";

describe("Workspace Export/Import Bundle module", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exports a valid workspace bundle with version metadata", () => {
    saveWorkflows([
      {
        id: "wf-custom",
        name: "Custom Workflow",
        nodes: [],
        edges: [],
        updatedAt: Date.now(),
      },
    ]);
    saveGlobals([{ key: "BASE_URL", value: "https://api.example.com" }]);

    const bundle = exportWorkspaceBundle();

    expect(bundle.version).toBe("agent_flow.workspace.v1");
    expect(bundle.workflows).toHaveLength(1);
    expect(bundle.workflows[0].name).toBe("Custom Workflow");
    expect(bundle.globals).toHaveLength(1);
    expect(bundle.globals[0].key).toBe("BASE_URL");
  });

  it("imports workspace bundle in merge mode without overwriting existing workflows", () => {
    saveWorkflows([
      {
        id: "wf-1",
        name: "Existing WF",
        nodes: [],
        edges: [],
        updatedAt: Date.now(),
      },
    ]);

    const bundleToImport: WorkspaceBundle = {
      version: "agent_flow.workspace.v1",
      timestamp: Date.now(),
      workflows: [
        {
          id: "wf-1",
          name: "Duplicate ID WF",
          nodes: [],
          edges: [],
          updatedAt: Date.now(),
        },
        {
          id: "wf-2",
          name: "New WF",
          nodes: [],
          edges: [],
          updatedAt: Date.now(),
        },
      ],
      activeWorkflowId: "wf-2",
      presets: {},
      globals: [{ key: "ENV", value: "production" }],
      secrets: [],
      gateways: [],
    };

    const stats = importWorkspaceBundle(bundleToImport, { mode: "merge" });

    expect(stats.workflowsCount).toBe(1); // only wf-2 imported
    const loadedWfs = loadWorkflows();
    expect(loadedWfs).toHaveLength(2);
    expect(loadedWfs.find((w) => w.id === "wf-1")?.name).toBe("Existing WF");
    expect(loadedWfs.find((w) => w.id === "wf-2")?.name).toBe("New WF");

    const loadedGlobals = loadGlobals();
    expect(loadedGlobals.some((g) => g.key === "ENV")).toBe(true);
  });

  it("imports workspace bundle in replace mode replacing existing items", () => {
    saveWorkflows([
      {
        id: "wf-old",
        name: "Old WF",
        nodes: [],
        edges: [],
        updatedAt: Date.now(),
      },
    ]);

    const bundleToImport: WorkspaceBundle = {
      version: "agent_flow.workspace.v1",
      timestamp: Date.now(),
      workflows: [
        {
          id: "wf-new",
          name: "New Replacement WF",
          nodes: [],
          edges: [],
          updatedAt: Date.now(),
        },
      ],
      activeWorkflowId: "wf-new",
      presets: {},
      globals: [],
      secrets: [],
      gateways: [],
    };

    const stats = importWorkspaceBundle(bundleToImport, { mode: "replace" });

    expect(stats.workflowsCount).toBe(1);
    const loadedWfs = loadWorkflows();
    expect(loadedWfs).toHaveLength(1);
    expect(loadedWfs[0].id).toBe("wf-new");
  });
});
