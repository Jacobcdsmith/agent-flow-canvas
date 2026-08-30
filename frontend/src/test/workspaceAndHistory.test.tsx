import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  exportWorkspaceBundle,
  validateWorkspaceBundle,
  importWorkspaceBundle,
  WORKSPACE_SCHEMA_VERSION,
} from "../flow/workspace";
import {
  loadRunHistory,
  saveRunRecord,
  deleteRunRecord,
  clearRunHistory,
} from "../flow/runHistory";
import { RunLog } from "../flow/runFlow";

describe("Workspace Backup & Restore Manager", () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {});
  });

  it("should generate a valid WorkspaceBundle with correct schema version", () => {
    const bundle = exportWorkspaceBundle();
    expect(bundle.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
    expect(Array.isArray(bundle.workflows)).toBe(true);
    expect(Array.isArray(bundle.globals)).toBe(true);
    expect(Array.isArray(bundle.secrets)).toBe(true);
    expect(Array.isArray(bundle.gateways)).toBe(true);
    expect(typeof bundle.presets).toBe("object");
  });

  it("should validate workspace bundle JSON accurately", () => {
    const validStr = JSON.stringify(exportWorkspaceBundle());
    const validRes = validateWorkspaceBundle(validStr);
    expect(validRes.valid).toBe(true);
    expect(validRes.bundle).toBeDefined();

    const invalidStr = JSON.stringify({ schemaVersion: "invalid.v9", workflows: [] });
    const invalidRes = validateWorkspaceBundle(invalidStr);
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.error).toContain("Invalid schemaVersion");
  });

  it("should support importing bundle in merge and replace modes", () => {
    const dummyBundle = {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      exportedAt: Date.now(),
      workflows: [
        {
          id: "wf-test-1",
          name: "Imported Test Workflow",
          nodes: [],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      presets: {},
      globals: [{ id: "g1", key: "API_URL", value: "https://api.example.com" }],
      secrets: [{ id: "s1", key: "TOKEN", value: "secret123" }],
      gateways: [
        {
          id: "gw1",
          name: "Test Gateway",
          provider: "openai" as const,
          apiKey: "sk-test",
          baseUrl: "https://api.openai.com/v1",
          defaultModel: "gpt-4o-mini",
        },
      ],
    };

    const merged = importWorkspaceBundle(dummyBundle, "merge");
    expect(merged.workflows.length).toBeGreaterThanOrEqual(1);
    expect(merged.globals.some((g) => g.key === "API_URL")).toBe(true);
    expect(merged.secrets.some((s) => s.key === "TOKEN")).toBe(true);
    expect(merged.gateways.some((gw) => gw.id === "gw1")).toBe(true);

    const replaced = importWorkspaceBundle(dummyBundle, "replace");
    expect(replaced.workflows.length).toBe(1);
    expect(replaced.globals.length).toBe(1);
  });
});

describe("Workflow Run History Persistence", () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => mockStore[key] || null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, val: string) => {
      mockStore[key] = val;
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key: string) => {
      delete mockStore[key];
    });
  });

  it("should save and retrieve execution run records per workflow ID", () => {
    const wfId = "wf-demo-123";
    const logs: RunLog[] = [
      { step: 1, nodeId: "n1", name: "trigger", kind: "trigger", label: "start", ms: 5, output: { ok: true } },
      { step: 2, nodeId: "n2", name: "sink", kind: "sink", label: "next", ms: 12, output: "done" },
    ];

    const saved = saveRunRecord(wfId, logs);
    expect(saved.workflowId).toBe(wfId);
    expect(saved.stepCount).toBe(2);
    expect(saved.durationMs).toBe(17);
    expect(saved.hasError).toBe(false);

    const history = loadRunHistory(wfId);
    expect(history.length).toBe(1);
    expect(history[0].id).toBe(saved.id);
  });

  it("should handle run record deletion and history clearing", () => {
    const wfId = "wf-demo-456";
    const logs: RunLog[] = [
      { step: 1, nodeId: "n1", name: "llm", kind: "llm", label: "start", ms: 25, output: "text" },
    ];

    const record1 = saveRunRecord(wfId, logs);
    const record2 = saveRunRecord(wfId, logs);
    expect(loadRunHistory(wfId).length).toBe(2);

    deleteRunRecord(wfId, record1.id);
    const historyAfterDelete = loadRunHistory(wfId);
    expect(historyAfterDelete.length).toBe(1);
    expect(historyAfterDelete[0].id).toBe(record2.id);

    clearRunHistory(wfId);
    expect(loadRunHistory(wfId).length).toBe(0);
  });
});
