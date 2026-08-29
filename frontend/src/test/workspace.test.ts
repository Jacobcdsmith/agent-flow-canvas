import { beforeEach, describe, expect, it } from "vitest";
import {
  exportWorkspaceBundle,
  importWorkspaceBundle,
  validateWorkspaceBundle,
  WorkspaceBundle,
} from "../flow/workspace";
import { saveWorkflows, loadWorkflows } from "../flow/workflows";
import { saveGateways, loadGateways } from "../flow/gateways";
import { saveGlobals, loadGlobals, saveSecrets, loadSecrets } from "../flow/globals";

describe("Workspace Backup & Restore Manager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exports current workspace into bundle structure", () => {
    saveWorkflows([
      {
        id: "custom_wf_1",
        name: "Custom Agent 1",
        description: "Test description",
        nodes: [],
        edges: [],
        createdAt: 1000,
        updatedAt: 1000,
      },
    ]);
    saveGateways([
      {
        id: "gw_1",
        name: "OpenAI Gateway",
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
      },
    ]);
    saveGlobals([{ id: "g1", key: "API_HOST", value: "localhost" }]);
    saveSecrets([{ id: "s1", key: "SECRET_KEY", value: "supersecret" }]);

    const bundle = exportWorkspaceBundle();
    expect(bundle.version).toBe("agent_flow.workspace.v1");
    expect(bundle.workflows.length).toBe(1);
    expect(bundle.workflows[0].name).toBe("Custom Agent 1");
    expect(bundle.gateways.length).toBe(1);
    expect(bundle.globals.length).toBe(1);
    expect(bundle.secrets.length).toBe(1);
  });

  it("validates workspace bundles correctly", () => {
    expect(validateWorkspaceBundle(null).valid).toBe(false);
    expect(validateWorkspaceBundle({ version: "bad_version" }).valid).toBe(false);

    const validBundle: WorkspaceBundle = {
      version: "agent_flow.workspace.v1",
      exportedAt: Date.now(),
      activeWorkflowId: null,
      workflows: [],
      gateways: [],
      globals: [],
      secrets: [],
      presets: {},
    };
    expect(validateWorkspaceBundle(validBundle).valid).toBe(true);
  });

  it("performs replace mode import cleanly", () => {
    // Seed initial state
    saveGlobals([{ id: "g_old", key: "OLD_VAR", value: "old" }]);

    const newBundle: WorkspaceBundle = {
      version: "agent_flow.workspace.v1",
      exportedAt: Date.now(),
      activeWorkflowId: "new_wf",
      workflows: [
        {
          id: "new_wf",
          name: "Imported Workflow",
          description: "",
          nodes: [],
          edges: [],
          createdAt: 2000,
          updatedAt: 2000,
        },
      ],
      gateways: [],
      globals: [{ id: "g_new", key: "NEW_VAR", value: "new" }],
      secrets: [],
      presets: {},
    };

    const res = importWorkspaceBundle(newBundle, "replace");
    expect(res.success).toBe(true);

    expect(loadWorkflows().length).toBe(1);
    expect(loadWorkflows()[0].id).toBe("new_wf");
    expect(loadGlobals().length).toBe(1);
    expect(loadGlobals()[0].key).toBe("NEW_VAR");
  });

  it("performs merge mode import cleanly", () => {
    saveWorkflows([
      {
        id: "wf_existing",
        name: "Existing WF",
        description: "",
        nodes: [],
        edges: [],
        createdAt: 1000,
        updatedAt: 1000,
      },
    ]);

    const incomingBundle: WorkspaceBundle = {
      version: "agent_flow.workspace.v1",
      exportedAt: Date.now(),
      activeWorkflowId: null,
      workflows: [
        {
          id: "wf_incoming",
          name: "Incoming WF",
          description: "",
          nodes: [],
          edges: [],
          createdAt: 2000,
          updatedAt: 2000,
        },
      ],
      gateways: [],
      globals: [],
      secrets: [],
      presets: {},
    };

    const res = importWorkspaceBundle(incomingBundle, "merge");
    expect(res.success).toBe(true);

    const merged = loadWorkflows();
    expect(merged.length).toBe(2);
    expect(merged.some((w) => w.id === "wf_existing")).toBe(true);
    expect(merged.some((w) => w.id === "wf_incoming")).toBe(true);
  });
});
