import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadStatePresets,
  saveStatePresets,
  DEFAULT_PRESETS,
  StatePreset,
} from "../flow/statePresets";

describe("State Presets Library Tests", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.restoreAllMocks();

    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, val: string) => {
      mockStorage[key] = val;
    });

    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => {
      return mockStorage[key] || null;
    });

    vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key: string) => {
      delete mockStorage[key];
    });
  });

  it("should load general defaults when workflowId is null or general", () => {
    const generalPresets = loadStatePresets(null);
    expect(generalPresets).toBeDefined();
    expect(generalPresets.length).toBe(DEFAULT_PRESETS["general"].length);
    expect(generalPresets[0].id).toBe("general-hello");

    const templatePresets = loadStatePresets("template-react");
    expect(templatePresets.length).toBe(DEFAULT_PRESETS["template-react"].length);
    expect(templatePresets[0].id).toBe("react-default");
  });

  it("should load general presets for unknown custom workflows with no saved presets", () => {
    const presets = loadStatePresets("some-random-custom-workflow-id");
    expect(presets).toEqual(DEFAULT_PRESETS["general"]);
  });

  it("should successfully save and load custom state presets partitioned by workflowId", () => {
    const workflowId = "my-custom-flow-123";

    // Load initial presets for this workflow (should be general defaults)
    const initial = loadStatePresets(workflowId);
    expect(initial).toEqual(DEFAULT_PRESETS["general"]);

    const customPreset: StatePreset = {
      id: "preset-custom-abc",
      name: "Custom Test Preset",
      stateJson: JSON.stringify({ customKey: "customValue" }, null, 2),
    };

    // Save custom preset
    saveStatePresets(workflowId, [...initial, customPreset]);

    // Load presets back
    const loaded = loadStatePresets(workflowId);
    expect(loaded.length).toBe(initial.length + 1);

    const foundCustom = loaded.find(p => p.id === "preset-custom-abc");
    expect(foundCustom).toBeDefined();
    expect(foundCustom?.name).toBe("Custom Test Preset");
    expect(foundCustom?.stateJson).toContain("customKey");
  });

  it("should not persist default presets to localStorage, only custom presets", () => {
    const workflowId = "my-custom-flow-abc";
    const initial = loadStatePresets(workflowId);

    const customPreset: StatePreset = {
      id: "preset-custom-def",
      name: "Another Custom Preset",
      stateJson: JSON.stringify({ a: 1 }),
    };

    saveStatePresets(workflowId, [...initial, customPreset]);

    // Verify localStorage contains only the custom preset, not the defaults
    const rawSaved = mockStorage[`agent_flow.state_presets.v1.${workflowId}`];
    expect(rawSaved).toBeDefined();

    const parsed = JSON.parse(rawSaved);
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe("preset-custom-def");
  });

  it("should support deleting custom state presets", () => {
    const workflowId = "del-flow";
    const initial = loadStatePresets(workflowId);

    const customPreset1: StatePreset = {
      id: "preset-1",
      name: "Custom 1",
      stateJson: "{}",
    };
    const customPreset2: StatePreset = {
      id: "preset-2",
      name: "Custom 2",
      stateJson: "{}",
    };

    // Save two custom presets
    saveStatePresets(workflowId, [...initial, customPreset1, customPreset2]);

    // Verify loaded has both
    let loaded = loadStatePresets(workflowId);
    expect(loaded.length).toBe(initial.length + 2);

    // Delete preset-1
    const nextPresets = loaded.filter(p => p.id !== "preset-1");
    saveStatePresets(workflowId, nextPresets);

    // Verify re-loaded list
    loaded = loadStatePresets(workflowId);
    expect(loaded.length).toBe(initial.length + 1);
    expect(loaded.find(p => p.id === "preset-1")).toBeUndefined();
    expect(loaded.find(p => p.id === "preset-2")).toBeDefined();
  });
});
