import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  loadRunHistory,
  saveRunRecord,
  deleteRunRecord,
  clearRunHistory,
  RunRecord,
} from "../flow/runHistory";
import { RunComparisonModal } from "../flow/RunComparisonModal";

describe("runHistory manager unit tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should save and load run records per workflow", () => {
    const wfId = "test-wf-1";
    const sampleRecord: Omit<RunRecord, "id"> = {
      workflowId: wfId,
      timestamp: Date.now(),
      status: "pass",
      durationMs: 250,
      stepCount: 3,
      initialState: { query: "test input" },
      logs: [
        {
          step: 1,
          nodeId: "n1",
          name: "Trigger",
          kind: "trigger",
          label: "start",
          output: { triggered: true },
          ms: 10,
        },
      ],
      finalOutput: { triggered: true },
    };

    const saved = saveRunRecord(wfId, sampleRecord);
    expect(saved.id).toBeDefined();
    expect(saved.id.startsWith("run_")).toBe(true);

    const history = loadRunHistory(wfId);
    expect(history.length).toBe(1);
    expect(history[0].id).toBe(saved.id);
    expect(history[0].durationMs).toBe(250);
  });

  it("should delete a single run record and clear all run history", () => {
    const wfId = "test-wf-2";
    const rec1 = saveRunRecord(wfId, {
      workflowId: wfId,
      timestamp: Date.now(),
      status: "pass",
      durationMs: 100,
      stepCount: 1,
      logs: [],
    });
    const rec2 = saveRunRecord(wfId, {
      workflowId: wfId,
      timestamp: Date.now() + 10,
      status: "error",
      durationMs: 50,
      stepCount: 1,
      logs: [],
    });

    let history = loadRunHistory(wfId);
    expect(history.length).toBe(2);

    deleteRunRecord(wfId, rec1.id);
    history = loadRunHistory(wfId);
    expect(history.length).toBe(1);
    expect(history[0].id).toBe(rec2.id);

    clearRunHistory(wfId);
    history = loadRunHistory(wfId);
    expect(history.length).toBe(0);
  });

  it("should truncate history to a maximum of 20 runs", () => {
    const wfId = "test-truncation";
    for (let i = 0; i < 25; i++) {
      saveRunRecord(wfId, {
        workflowId: wfId,
        timestamp: Date.now() + i,
        status: "pass",
        durationMs: i * 10,
        stepCount: 2,
        logs: [],
      });
    }

    const history = loadRunHistory(wfId);
    expect(history.length).toBe(20);
  });
});

describe("RunComparisonModal component unit tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders comparison modal when open and handles run selection and delta displays", () => {
    const wfId = "modal-wf";
    saveRunRecord(wfId, {
      id: "run-a",
      workflowId: wfId,
      timestamp: 1000000,
      status: "pass",
      durationMs: 200,
      stepCount: 2,
      logs: [
        {
          step: 1,
          nodeId: "n1",
          name: "Reason",
          kind: "llm",
          label: "start",
          output: "Response A",
          ms: 200,
        },
      ],
      finalOutput: "Response A",
    });

    saveRunRecord(wfId, {
      id: "run-b",
      workflowId: wfId,
      timestamp: 2000000,
      status: "pass",
      durationMs: 350,
      stepCount: 2,
      logs: [
        {
          step: 1,
          nodeId: "n1",
          name: "Reason",
          kind: "llm",
          label: "start",
          output: "Response B",
          ms: 350,
        },
      ],
      finalOutput: "Response B",
    });

    const handleClose = vi.fn();

    render(
      <RunComparisonModal
        isOpen={true}
        workflowId={wfId}
        onClose={handleClose}
      />
    );

    expect(screen.getByText("Run Comparison & Analytics")).toBeInTheDocument();
    expect(screen.getByText("Executive Metric Comparison")).toBeInTheDocument();

    // Explicitly set Run A to "run-a" and Run B to "run-b" via the select elements
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(2);
    fireEvent.change(selects[0], { target: { value: "run-a" } });
    fireEvent.change(selects[1], { target: { value: "run-b" } });

    // Check duration display and delta calculation (+150 ms)
    const matches200 = screen.getAllByText(/200\s*ms/);
    expect(matches200.length).toBeGreaterThan(0);

    const matches350 = screen.getAllByText(/350\s*ms/);
    expect(matches350.length).toBeGreaterThan(0);

    const matchesDelta = screen.getAllByText(/\+150\s*ms/);
    expect(matchesDelta.length).toBeGreaterThan(0);

    // Check step comparison table
    expect(screen.getByText("Step-by-Step Execution Comparison (1 Steps)")).toBeInTheDocument();
    expect(screen.getAllByText("Response A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Response B").length).toBeGreaterThan(0);

    // Close button triggers onClose
    const closeBtn = screen.getByText("✕ Close");
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
