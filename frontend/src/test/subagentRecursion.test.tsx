import { describe, it, expect } from "vitest";
import { runFlow } from "../flow/runFlow";
import { generatePython, generateJavaScript } from "../flow/codegen";
import { Inspector } from "../flow/Inspector";
import { render } from "@testing-library/react";
import { Node, Edge, ReactFlowProvider } from "reactflow";
import { AgentNodeData } from "../flow/types";
import { Workflow } from "../flow/workflows";

describe("Subagent Recursion & UI & Codegen Features", () => {
  const childNodes: Node<AgentNodeData>[] = [
    {
      id: "c1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "trigger",
        name: "sub_start",
        config: {},
        isEntry: true,
      },
    },
    {
      id: "c2",
      type: "agent",
      position: { x: 100, y: 100 },
      data: {
        kind: "script",
        name: "sub_process",
        config: {
          code: "state.query = state.query + '_processed'; return { done: true };",
        },
      },
    },
    {
      id: "c3",
      type: "agent",
      position: { x: 200, y: 200 },
      data: {
        kind: "sink",
        name: "sub_finish",
        config: { target: "response" },
        isTerminal: true,
      },
    },
  ];

  const childEdges: Edge[] = [
    { id: "ce1", source: "c1", target: "c2", label: "next" },
    { id: "ce2", source: "c2", target: "c3", label: "next" },
  ];

  const subWf: Workflow = {
    id: "child-researcher",
    name: "Child Researcher",
    description: "Takes input and appends processed.",
    nodes: childNodes,
    edges: childEdges,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const parentNodes: Node<AgentNodeData>[] = [
    {
      id: "p1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "trigger",
        name: "parent_start",
        config: {},
        isEntry: true,
      },
    },
    {
      id: "p2",
      type: "agent",
      position: { x: 100, y: 100 },
      data: {
        kind: "subagent",
        name: "call_child",
        config: {
          graph: "child-researcher",
          input: "state.query",
        },
      },
    },
    {
      id: "p3",
      type: "agent",
      position: { x: 200, y: 200 },
      data: {
        kind: "sink",
        name: "parent_finish",
        config: { target: "response" },
        isTerminal: true,
      },
    },
  ];

  const parentEdges: Edge[] = [
    { id: "pe1", source: "p1", target: "p2", label: "next" },
    { id: "pe2", source: "p2", target: "p3", label: "on_success" },
  ];

  it("should execute subagent recursive runFlow run with input/output propagation", async () => {
    const parentLogs = await runFlow({
      nodes: parentNodes,
      edges: parentEdges,
      gateways: [],
      initialState: { query: "hello" },
      workflows: [subWf],
    });

    // Parent run should have 3 steps: trigger, subagent, sink
    expect(parentLogs.length).toBe(3);

    const subagentStep = parentLogs.find((l) => l.nodeId === "p2");
    expect(subagentStep).toBeDefined();
    expect(subagentStep?.error).toBeUndefined();

    // Verify subagent output format has nested subLogs and correct final result
    const output = subagentStep?.output as any;
    expect(output).toBeDefined();
    expect(output.workflowId).toBe("child-researcher");
    expect(output.workflowName).toBe("Child Researcher");
    expect(output.subLogs).toBeDefined();
    expect(output.subLogs.length).toBe(3);

    // Verify subLogs steps were executed properly on subagent
    const subScriptStep = output.subLogs.find((l: any) => l.nodeId === "c2");
    expect(subScriptStep).toBeDefined();
    expect(subScriptStep.stateSnapshot.query).toBe("hello_processed");

    // Parent terminal/sink node should have propagated output in parent stateSnapshot/result
    const parentSinkStep = parentLogs.find((l) => l.nodeId === "p3");
    expect(parentSinkStep).toBeDefined();
    expect(parentSinkStep?.stateSnapshot?.last_output).toBeDefined();
    expect((parentSinkStep?.stateSnapshot?.last_output as any).result.result).toEqual({
      result: { done: true },
      target: "response"
    });
  });

  it("should generate self-documenting comments with node/edge counts in Python & JavaScript", () => {
    const pyRes = generatePython(parentNodes, parentEdges, [], [], [subWf]);
    expect(pyRes.code).toContain("# Nested Subagent Workflow Details:");
    expect(pyRes.code).toContain("# Name: Child Researcher");
    expect(pyRes.code).toContain("# Nodes: 3");
    expect(pyRes.code).toContain("# Edges: 2");

    const jsRes = generateJavaScript(parentNodes, parentEdges, [], [], [subWf]);
    expect(jsRes.code).toContain("// Nested Subagent Workflow Details:");
    expect(jsRes.code).toContain("// Name: Child Researcher");
    expect(jsRes.code).toContain("// Nodes: 3");
    expect(jsRes.code).toContain("// Edges: 2");
  });

  it("should render dropdown menu with other workflows in Inspector UI, excluding active", () => {
    const activeWorkflowId = "parent-wf-id";
    const changeMock = () => {};
    const deleteMock = () => {};

    const nodeUnderTest: Node<AgentNodeData> = parentNodes.find((n) => n.id === "p2")!;

    const { container } = render(
      <ReactFlowProvider>
        <Inspector
          node={nodeUnderTest}
          edges={parentEdges}
          nodes={parentNodes}
          activeWorkflowId={activeWorkflowId}
          workflows={[subWf]}
          onChange={changeMock}
          onDelete={deleteMock}
        />
      </ReactFlowProvider>
    );

    // Verify dropdown is rendered for graph selection
    const selectElem = container.querySelector("select");
    expect(selectElem).not.toBeNull();

    // It should have options: child-researcher, and exclude the parent active graph
    const options = container.querySelectorAll("option");
    const optionValues = Array.from(options).map((o) => o.value);
    expect(optionValues).toContain("child-researcher");
    expect(optionValues).not.toContain("parent-wf-id");
  });
});
