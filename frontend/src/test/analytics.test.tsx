import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowAnalyticsModal } from "../flow/WorkflowAnalyticsModal";
import type { RunLog } from "../flow/runFlow";
import type { Node, Edge } from "reactflow";
import type { AgentNodeData } from "../flow/types";

describe("WorkflowAnalyticsModal component", () => {
  const dummyNodes: Node<AgentNodeData>[] = [
    {
      id: "n1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: { kind: "trigger", name: "on_request", config: {} },
    },
    {
      id: "n2",
      type: "agent",
      position: { x: 100, y: 100 },
      data: { kind: "llm", name: "reason_agent", config: {} },
    },
  ];

  const dummyEdges: Edge[] = [
    { id: "e1", source: "n1", target: "n2", label: "next" },
  ];

  const mockLogs: RunLog[] = [
    {
      step: 1,
      nodeId: "n1",
      name: "on_request",
      kind: "trigger",
      label: "start",
      ms: 15,
      output: { triggered: true },
    },
    {
      step: 2,
      nodeId: "n2",
      name: "reason_agent",
      kind: "llm",
      label: "next",
      ms: 1250,
      output: "Analysis result from LLM model with generated text...",
    },
  ];

  it("should render modal with calculated analytics metrics and bottleneck recommendations", () => {
    render(
      <WorkflowAnalyticsModal
        isOpen={true}
        onClose={() => {}}
        runLogs={mockLogs}
        nodes={dummyNodes}
        edges={dummyEdges}
      />
    );

    expect(screen.getByText("Workflow Performance Profiler & Analytics")).toBeInTheDocument();
    expect(screen.getByText("1265 ms")).toBeInTheDocument(); // 15 + 1250 = 1265
    expect(screen.getByText("on_request")).toBeInTheDocument();
    expect(screen.getByText("reason_agent")).toBeInTheDocument();
    expect(screen.getByText(/Bottleneck & Slow Node Recommendations/i)).toBeInTheDocument();
  });

  it("should handle empty run logs gracefully", () => {
    render(
      <WorkflowAnalyticsModal
        isOpen={true}
        onClose={() => {}}
        runLogs={[]}
        nodes={dummyNodes}
        edges={dummyEdges}
      />
    );

    expect(screen.getByText("No Execution Run Logs Available")).toBeInTheDocument();
  });
});
