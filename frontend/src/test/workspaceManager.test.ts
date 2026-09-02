import { describe, it, expect, vi } from "vitest";
import { exportWorkspaceBundle, importWorkspaceBundle } from "../flow/workspace";

describe("Workspace Manager Tests", () => {
  it("should export workspace bundle with optional API key masking", () => {
    const mockStorage: Record<string, string> = {
      "agent_flow.workflows.v1": JSON.stringify([{ id: "wf1", name: "Custom 1", nodes: [], edges: [], createdAt: 1, updatedAt: 1 }]),
      "agent_flow.globals": JSON.stringify([{ key: "BASE_URL", value: "https://api.example.com" }]),
      "agent_flow.secrets": JSON.stringify([{ key: "SECRET_KEY", value: "supersecret" }]),
      "agent_flow.gateways.v2": JSON.stringify([{ id: "gw1", name: "OpenAI", provider: "openai", apiKey: "sk-12345678" }]),
    };

    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => mockStorage[key] || null);

    // Test unmasked export
    const bundleUnmasked = exportWorkspaceBundle(false);
    expect(bundleUnmasked.version).toBe("agent_flow.workspace.v1");
    expect(bundleUnmasked.workflows.length).toBe(1);
    expect(bundleUnmasked.globals.length).toBe(1);
    expect(bundleUnmasked.gateways[0].apiKey).toBe("sk-12345678");

    // Test masked export
    const bundleMasked = exportWorkspaceBundle(true);
    expect(bundleMasked.gateways[0].apiKey).toBe("********");

    getItemSpy.mockRestore();
  });

  it("should import workspace bundle in merge and replace modes", () => {
    const mockStorage: Record<string, string> = {};

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, val) => {
      mockStorage[key] = val;
    });

    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => mockStorage[key] || null);

    const bundle = {
      version: "agent_flow.workspace.v1" as const,
      exportedAt: Date.now(),
      activeWorkflowId: "wf-imported",
      workflows: [{ id: "wf-imported", name: "Imported Flow", nodes: [], edges: [], createdAt: 1, updatedAt: 1 }],
      globals: [{ key: "API_HOST", value: "localhost" }],
      secrets: [],
      gateways: [{ id: "gw-imp", name: "Ollama Local", provider: "ollama", defaultModel: "llama3" }],
      statePresetsMap: {},
    };

    const res = importWorkspaceBundle(bundle, "replace");
    expect(res.success).toBe(true);
    expect(mockStorage["agent_flow.workflows.v1"]).toContain("Imported Flow");
    expect(mockStorage["agent_flow.globals"]).toContain("API_HOST");

    setItemSpy.mockRestore();
    getItemSpy.mockRestore();
  });
});
