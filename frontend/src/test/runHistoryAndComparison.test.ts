import { describe, it, expect, vi } from "vitest";
import {
  loadRunHistory,
  saveRunHistory,
  recordRun,
  clearRunHistory,
  diffStateSnapshots,
} from "../flow/runHistory";
import type { RunLog } from "../flow/runFlow";

describe("Run History & Comparison Tests", () => {
  it("should record, persist, load, and clear run history", () => {
    const mockStorage: Record<string, string> = {};

    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: any, key: string, val: string) {
        mockStorage[key] = val;
      });

    const getItemSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(function (this: any, key: string) {
        return mockStorage[key] || null;
      });

    const removeItemSpy = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(function (this: any, key: string) {
        delete mockStorage[key];
      });

    const sampleLogs: RunLog[] = [
      {
        step: 1,
        nodeId: "n1",
        name: "trigger",
        kind: "trigger",
        label: "next",
        output: { ok: true },
        ms: 12,
        stateSnapshot: { query: "hello", count: 1 },
      },
      {
        step: 2,
        nodeId: "n2",
        name: "reason",
        kind: "llm",
        label: "on_success",
        output: { text: "response" },
        ms: 150,
        stateSnapshot: { query: "hello", count: 2, result: "response" },
      },
    ];

    // Record run
    const rec = recordRun("wf-test-1", "Test Workflow", sampleLogs);
    expect(rec).toBeDefined();
    expect(rec.stepCount).toBe(2);
    expect(rec.totalMs).toBe(162);
    expect(rec.status).toBe("pass");

    // Load history
    const history = loadRunHistory("wf-test-1");
    expect(history.length).toBe(1);
    expect(history[0].workflowName).toBe("Test Workflow");

    // Clear history
    clearRunHistory("wf-test-1");
    const cleared = loadRunHistory("wf-test-1");
    expect(cleared.length).toBe(0);

    setItemSpy.mockRestore();
    getItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });

  it("should correctly compute diffs between two state snapshots", () => {
    const stateA = { query: "hello", count: 1, same: "identical" };
    const stateB = { query: "hello world", count: 2, same: "identical", newKey: true };

    const diffs = diffStateSnapshots(stateA, stateB);

    const queryDiff = diffs.find((d) => d.key === "query");
    expect(queryDiff).toBeDefined();
    expect(queryDiff?.changed).toBe(true);
    expect(queryDiff?.valA).toBe("hello");
    expect(queryDiff?.valB).toBe("hello world");

    const countDiff = diffs.find((d) => d.key === "count");
    expect(countDiff).toBeDefined();
    expect(countDiff?.changed).toBe(true);

    const sameDiff = diffs.find((d) => d.key === "same");
    expect(sameDiff).toBeDefined();
    expect(sameDiff?.changed).toBe(false);
  });
});
