import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRunHistory,
  getHistoryStorageKey,
  loadRunHistory,
  RunHistoryRecord,
  saveRunRecord,
} from "../flow/runHistory";

describe("Execution Run History Storage & Manager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("generates workflow-specific storage keys correctly", () => {
    expect(getHistoryStorageKey(null)).toBe("agent_flow.run_history.v1.default");
    expect(getHistoryStorageKey("wf_123")).toBe("agent_flow.run_history.v1.wf_123");
  });

  it("loads empty array when no history exists", () => {
    const history = loadRunHistory("test_wf");
    expect(history).toEqual([]);
  });

  it("saves and retrieves execution run records", () => {
    const record: RunHistoryRecord = {
      id: "run_1",
      workflowId: "test_wf",
      workflowName: "Test Workflow",
      timestamp: 1600000000000,
      durationMs: 150,
      stepCount: 2,
      status: "success",
      logs: [
        { step: 1, nodeId: "n1", name: "Trigger", kind: "trigger", ms: 10, label: "start" },
        { step: 2, nodeId: "n2", name: "LLM", kind: "llm", ms: 140, label: "next" },
      ],
      initialState: { query: "hello" },
    };

    const saved = saveRunRecord(record);
    expect(saved.length).toBe(1);
    expect(saved[0].id).toBe("run_1");

    const loaded = loadRunHistory("test_wf");
    expect(loaded.length).toBe(1);
    expect(loaded[0].workflowName).toBe("Test Workflow");
    expect(loaded[0].durationMs).toBe(150);
  });

  it("clears run history for a given workflow", () => {
    const record: RunHistoryRecord = {
      id: "run_clear",
      workflowId: "wf_clear",
      workflowName: "To Clear",
      timestamp: Date.now(),
      durationMs: 50,
      stepCount: 1,
      status: "success",
      logs: [],
      initialState: {},
    };

    saveRunRecord(record);
    expect(loadRunHistory("wf_clear").length).toBe(1);

    clearRunHistory("wf_clear");
    expect(loadRunHistory("wf_clear")).toEqual([]);
  });
});
