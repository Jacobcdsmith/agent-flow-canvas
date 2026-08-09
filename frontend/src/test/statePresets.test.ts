import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadPresets, savePresets, cryptoId, StatePreset } from "../flow/statePresets";

describe("State Presets Library", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should return an empty array if no presets are saved for a workflow", () => {
    const presets = loadPresets("test-workflow-id");
    expect(presets).toEqual([]);
  });

  it("should correctly save and load presets for a workflow ID", () => {
    const mockPresets: StatePreset[] = [
      {
        id: "preset-1",
        name: "Test Preset 1",
        stateStr: '{"query": "hello 1"}',
        createdAt: 123456789,
      },
      {
        id: "preset-2",
        name: "Test Preset 2",
        stateStr: '{"query": "hello 2"}',
        createdAt: 123456790,
      },
    ];

    savePresets("wf-abc", mockPresets);
    const loaded = loadPresets("wf-abc");

    expect(loaded).toHaveLength(2);
    expect(loaded[0]).toEqual(mockPresets[0]);
    expect(loaded[1]).toEqual(mockPresets[1]);
  });

  it("should fallback to 'default' when workflow ID is null", () => {
    const mockPresets: StatePreset[] = [
      {
        id: "preset-def",
        name: "Default Preset",
        stateStr: '{"query": "default query"}',
        createdAt: 123456789,
      },
    ];

    savePresets(null, mockPresets);

    // Verify it saved to localStorage under default
    const stored = localStorage.getItem("agent_flow.state_presets.v1.default");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toHaveLength(1);

    // Verify loadPresets(null) loads it
    const loaded = loadPresets(null);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe("Default Preset");
  });

  it("should generate a random id when cryptoId is called", () => {
    const id1 = cryptoId();
    const id2 = cryptoId();
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(3);
  });
});
