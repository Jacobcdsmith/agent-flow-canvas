import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  RunRecord,
  loadRunHistory,
  saveRunRecord,
  clearRunHistory,
  deleteRunRecord,
} from "../flow/runHistory";
import { RunComparisonModal } from "../flow/RunComparisonModal";

describe("runHistory module", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads run records correctly", () => {
    const record1: RunRecord = {
      id: "run-1",
      workflowId: "wf-1",
      workflowName: "Workflow One",
      timestamp: Date.now(),
      durationMs: 150,
      stepCount: 2,
      hasError: false,
      initialState: { query: "test 1" },
      logs: [],
    };

    saveRunRecord("wf-1", record1);
    const loaded = loadRunHistory("wf-1");

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("run-1");
    expect(loaded[0].workflowName).toBe("Workflow One");
  });

  it("deletes individual run records and clears history", () => {
    const r1: RunRecord = {
      id: "run-1",
      workflowId: "wf-1",
      workflowName: "W1",
      timestamp: 1000,
      durationMs: 10,
      stepCount: 1,
      hasError: false,
      initialState: {},
      logs: [],
    };
    const r2: RunRecord = {
      id: "run-2",
      workflowId: "wf-1",
      workflowName: "W1",
      timestamp: 2000,
      durationMs: 20,
      stepCount: 2,
      hasError: false,
      initialState: {},
      logs: [],
    };

    saveRunRecord("wf-1", r1);
    saveRunRecord("wf-1", r2);

    expect(loadRunHistory("wf-1")).toHaveLength(2);

    deleteRunRecord("wf-1", "run-1");
    const afterDelete = loadRunHistory("wf-1");
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].id).toBe("run-2");

    clearRunHistory("wf-1");
    expect(loadRunHistory("wf-1")).toHaveLength(0);
  });
});

describe("RunComparisonModal component", () => {
  const sampleRuns: RunRecord[] = [
    {
      id: "run-1",
      workflowId: "wf-1",
      workflowName: "Test WF",
      timestamp: Date.now() - 5000,
      durationMs: 120,
      stepCount: 2,
      hasError: false,
      initialState: { query: "alpha" },
      logs: [
        {
          step: 1,
          nodeId: "n1",
          name: "Trigger",
          kind: "trigger",
          label: "start",
          output: { ok: true },
          ms: 10,
        },
      ],
    },
    {
      id: "run-2",
      workflowId: "wf-1",
      workflowName: "Test WF",
      timestamp: Date.now(),
      durationMs: 250,
      stepCount: 2,
      hasError: true,
      initialState: { query: "beta" },
      logs: [
        {
          step: 1,
          nodeId: "n1",
          name: "Trigger",
          kind: "trigger",
          label: "start",
          output: { ok: true },
          ms: 10,
        },
        {
          step: 2,
          nodeId: "n2",
          name: "Reason",
          kind: "llm",
          label: "next",
          error: "API timeout",
          ms: 240,
        },
      ],
    },
  ];

  it("renders side-by-side run comparison metrics and triggers callbacks", () => {
    let appliedState: string | null = null;

    render(
      <RunComparisonModal
        runs={sampleRuns}
        initialRunAId="run-1"
        initialRunBId="run-2"
        onClose={() => {}}
        onApplyInitialState={(s) => {
          appliedState = s;
        }}
      />
    );

    expect(screen.getByText("Side-by-Side Run Comparison")).toBeInTheDocument();
    expect(screen.getByText("PASSED ✓")).toBeInTheDocument();
    expect(screen.getByText("FAILED ✗")).toBeInTheDocument();

    const loadButtons = screen.getAllByText("Load State");
    expect(loadButtons.length).toBeGreaterThan(0);

    fireEvent.click(loadButtons[0]);
    expect(appliedState).not.toBeNull();
    expect(JSON.parse(appliedState!)).toEqual({ query: "alpha" });
  });
});
