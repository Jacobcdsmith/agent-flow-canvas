import { describe, it, expect } from "vitest";
import { computeWorkflowAnalytics, generateAnalyticsCsv } from "../flow/WorkflowAnalyticsModal";
import type { RunLog } from "../flow/runFlow";

describe("Workflow Analytics & Profiler Tests", () => {
  const sampleLogs: RunLog[] = [
    {
      step: 1,
      nodeId: "n1",
      name: "trigger",
      kind: "trigger",
      label: "next",
      output: { query: "search prompt" },
      ms: 10,
    },
    {
      step: 2,
      nodeId: "n2",
      name: "reason",
      kind: "llm",
      label: "on_success",
      output: "Here is a detailed text response from the model that spans multiple words for token analysis.",
      ms: 800,
    },
    {
      step: 3,
      nodeId: "n3",
      name: "return_result",
      kind: "sink",
      label: "next",
      output: { done: true },
      ms: 15,
    },
  ];

  it("should correctly compute total duration, steps, token estimates, and bottleneck recommendations", () => {
    const analytics = computeWorkflowAnalytics(sampleLogs);

    expect(analytics.totalSteps).toBe(3);
    expect(analytics.totalMs).toBe(825);
    expect(analytics.errorCount).toBe(0);

    expect(analytics.slowestNode).not.toBeNull();
    expect(analytics.slowestNode?.name).toBe("reason");
    expect(analytics.slowestNode?.pctTotal).toBeGreaterThanOrEqual(95);

    expect(analytics.totalEstimatedTokens).toBeGreaterThan(0);
    expect(analytics.totalEstimatedCostUsd).toBeGreaterThan(0);

    expect(analytics.recommendations.length).toBeGreaterThan(0);
    expect(analytics.recommendations[0]).toContain("reason");
  });

  it("should generate valid CSV analytics reports", () => {
    const csv = generateAnalyticsCsv(sampleLogs);

    expect(csv).toContain("Workflow Performance & Profiling Report");
    expect(csv).toContain("Total Steps,3");
    expect(csv).toContain("Total Duration (ms),825");
    expect(csv).toContain('"n2","reason","llm"');
  });
});
