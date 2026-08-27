import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  loadRunHistory,
  saveRunRecord,
  deleteRunRecord,
  clearRunHistory,
  ExecutionRunRecord,
} from "../flow/runHistory";
import { RunComparisonModal } from "../flow/RunComparisonModal";

describe("Execution Run History & Comparison Modal Features", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should handle loading, saving, deleting, and clearing run history in localStorage", () => {
    const mockWorkflowId = "wf-test-123";

    // Initial state
    expect(loadRunHistory(mockWorkflowId)).toEqual([]);

    // Save record 1
    const rec1 = saveRunRecord(mockWorkflowId, {
      timestamp: Date.now() - 5000,
      status: "pass",
      totalMs: 120,
      stepCount: 3,
      initialState: { query: "test 1" },
      finalOutput: "output 1",
      logs: [
        { step: 1, nodeId: "n1", name: "step1", kind: "trigger", label: "start", ms: 10 },
        { step: 2, nodeId: "n2", name: "step2", kind: "llm", label: "next", ms: 110 },
      ],
    });

    expect(rec1.id).toBeDefined();
    expect(rec1.workflowId).toBe(mockWorkflowId);

    let loaded = loadRunHistory(mockWorkflowId);
    expect(loaded.length).toBe(1);
    expect(loaded[0].status).toBe("pass");

    // Save record 2
    const rec2 = saveRunRecord(mockWorkflowId, {
      timestamp: Date.now(),
      status: "error",
      totalMs: 45,
      stepCount: 1,
      initialState: { query: "test 2" },
      finalOutput: "error msg",
      logs: [
        { step: 1, nodeId: "n1", name: "step1", kind: "trigger", label: "start", error: "Failed", ms: 45 },
      ],
    });

    loaded = loadRunHistory(mockWorkflowId);
    expect(loaded.length).toBe(2);
    // Most recent run should be first
    expect(loaded[0].id).toBe(rec2.id);

    // Delete rec1
    const afterDelete = deleteRunRecord(mockWorkflowId, rec1.id);
    expect(afterDelete.length).toBe(1);
    expect(afterDelete[0].id).toBe(rec2.id);

    // Clear all
    clearRunHistory(mockWorkflowId);
    expect(loadRunHistory(mockWorkflowId)).toEqual([]);
  });

  it("should render RunComparisonModal and allow selecting and comparing two runs side-by-side", () => {
    const runA: ExecutionRunRecord = {
      id: "run-a",
      workflowId: "wf-1",
      timestamp: 1700000000000,
      status: "pass",
      totalMs: 250,
      stepCount: 2,
      initialState: { input: "A" },
      finalOutput: "Result A",
      logs: [
        { step: 1, nodeId: "n1", name: "Start", kind: "trigger", label: "next", ms: 50, output: "A" },
        { step: 2, nodeId: "n2", name: "Finish", kind: "sink", label: "next", ms: 200, output: "Result A" },
      ],
    };

    const runB: ExecutionRunRecord = {
      id: "run-b",
      workflowId: "wf-1",
      timestamp: 1700000100000,
      status: "error",
      totalMs: 150,
      stepCount: 1,
      initialState: { input: "B" },
      finalOutput: "Error in node B",
      logs: [
        { step: 1, nodeId: "n1", name: "Start", kind: "trigger", label: "next", ms: 150, error: "Error in node B" },
      ],
    };

    const onClose = vi.fn();

    render(
      <RunComparisonModal
        runs={[runA, runB]}
        initialRunAId="run-a"
        initialRunBId="run-b"
        onClose={onClose}
      />
    );

    expect(screen.getByText("Side-by-Side Run Comparison")).toBeInTheDocument();
    expect(screen.getByText("Run A")).toBeInTheDocument();
    expect(screen.getByText("Run B")).toBeInTheDocument();

    expect(screen.getByText("250ms")).toBeInTheDocument();
    expect(screen.getAllByText(/150ms/).length).toBeGreaterThan(0);

    expect(screen.getAllByText("Result A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Error in node B").length).toBeGreaterThan(0);

    // Test close button
    fireEvent.click(screen.getByText("✕ Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
