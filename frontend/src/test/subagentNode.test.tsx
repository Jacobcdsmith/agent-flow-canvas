import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { runFlow, RunLog, runNode } from "../flow/runFlow";
import { Inspector } from "../flow/Inspector";
import { generateCode } from "../flow/codegen";
import { Workflow, TEMPLATES } from "../flow/workflows";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";

describe("Subagent Node Features & Recurse Execution Tests", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, val) => {
      mockStorage[key] = val;
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => {
      return mockStorage[key] || null;
    });
    mockStorage = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should recursively execute a subagent node using target workflow nodes and edges", async () => {
    // 1. Setup a simple child workflow and save to mock library
    const childWf: Workflow = {
      id: "child-flow",
      name: "Child Translator",
      nodes: [
        {
          id: "child-trigger",
          type: "agent",
          position: { x: 0, y: 0 },
          data: {
            kind: "trigger",
            name: "on_query",
            isEntry: true,
            config: { source: "manual" },
          },
        },
        {
          id: "child-sink",
          type: "agent",
          position: { x: 100, y: 0 },
          data: {
            kind: "sink",
            name: "done",
            isTerminal: true,
            config: { target: "response" },
          },
        },
      ],
      edges: [
        { id: "ce1", source: "child-trigger", target: "child-sink", label: "next" },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Store childWf in localStorage mock so findWorkflowById can fetch it
    mockStorage["agent_flow.workflows.v1"] = JSON.stringify([childWf]);

    // 2. Create a parent workflow with a Subagent node referencing "child-flow"
    const parentNode: Node<AgentNodeData> = {
      id: "parent-subagent",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "subagent",
        name: "call_child_flow",
        config: {
          graph: "child-flow",
          input: '{"query": "custom-input"}',
        },
      },
    };

    const state: Record<string, unknown> = { query: "hello" };

    // Execute runNode directly for the subagent node
    const result = (await runNode(parentNode, state, [], { nodes: [parentNode], edges: [], gateways: [] }, [], [])) as any;

    expect(result).toBeDefined();
    expect(result.__isSubagentResult).toBe(true);
    expect(result.subLogs).toHaveLength(2); // child-trigger & child-sink steps
    expect(result.output.query).toBe("custom-input"); // verify state interpolation inside child flow
  });

  it("should render dynamic dropdown for graph selection and exclude active workflow", () => {
    const parentWfId = "parent-flow";
    mockStorage["agent_flow.active_workflow_id.v1"] = parentWfId;

    const childWf1: Workflow = {
      id: "child-1",
      name: "Child 1",
      nodes: [],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    mockStorage["agent_flow.workflows.v1"] = JSON.stringify([childWf1]);

    const activeNode: Node<AgentNodeData> = {
      id: "subagent-node",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "subagent",
        name: "nested",
        config: { graph: "", input: "" },
      },
    };

    render(
      <Inspector
        node={activeNode}
        edges={[]}
        nodes={[activeNode]}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Verify subagent dropdown select renders
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();

    // Verify template (e.g. ReAct Agent Loop) and Child 1 are present, but active parent-flow is not
    expect(screen.getByText(/ReAct Agent Loop/)).toBeInTheDocument();
    expect(screen.getByText(/Child 1/)).toBeInTheDocument();
  });

  it("should compile self-documenting comment in codegen output for subagent nodes", () => {
    const childWf: Workflow = {
      id: "child-flow-id",
      name: "Super Child Flow",
      nodes: [
        {
          id: "n1",
          type: "agent",
          position: { x: 0, y: 0 },
          data: { kind: "trigger", name: "t", config: {} },
        },
      ],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    mockStorage["agent_flow.workflows.v1"] = JSON.stringify([childWf]);

    const subNode: Node<AgentNodeData> = {
      id: "node-sub",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "subagent",
        name: "sub_executor",
        config: { graph: "child-flow-id" },
      },
    };

    // Python Codegen output test
    const pyRes = generateCode("python", [subNode], []);
    expect(pyRes.code).toContain("# Nested Subagent Workflow: Super Child Flow");
    expect(pyRes.code).toContain("# Nodes: 1 | Edges: 0");

    // JavaScript Codegen output test
    const jsRes = generateCode("javascript", [subNode], []);
    expect(jsRes.code).toContain("// Nested Subagent Workflow: Super Child Flow");
    expect(jsRes.code).toContain("// Nodes: 1 | Edges: 0");
  });
});
