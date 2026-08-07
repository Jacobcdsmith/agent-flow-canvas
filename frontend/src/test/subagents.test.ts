import { describe, it, expect } from "vitest";
import { runFlow } from "../flow/runFlow";
import { generatePython, generateJavaScript } from "../flow/codegen";
import { TEMPLATES } from "../flow/workflows";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";

describe("Recursive Subagents & Codegen Comments", () => {
  it("should generate self-documenting comments for subagents in python and javascript", () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "subagent",
          name: "nested_subtask",
          config: {
            graph: "template-react",
            input: '{"query": "nested subagent research"}',
          },
        },
      },
    ];

    const edges: Edge[] = [];

    const pyResult = generatePython(nodes, edges);
    expect(pyResult.errors).toEqual([]);
    expect(pyResult.code).toContain("# Nested Subagent details:");
    expect(pyResult.code).toContain("#   Name: ReAct Agent Loop");
    expect(pyResult.code).toContain("#   Node Count: 7");
    expect(pyResult.code).toContain("#   Edge Count: 7");

    const jsResult = generateJavaScript(nodes, edges);
    expect(jsResult.errors).toEqual([]);
    expect(jsResult.code).toContain("// Nested Subagent details:");
    expect(jsResult.code).toContain("//   Name: ReAct Agent Loop");
    expect(jsResult.code).toContain("//   Node Count: 7");
    expect(jsResult.code).toContain("//   Edge Count: 7");
  });

  it("should execute nested subagent workflows recursively and gather nested subLogs", async () => {
    // We will execute a small workflow with a subagent node pointing to "template-react"
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "parent-trigger",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "trigger",
          name: "start_workflow",
          isEntry: true,
          config: {},
        },
      },
      {
        id: "parent-subagent",
        type: "agent",
        position: { x: 100, y: 100 },
        data: {
          kind: "subagent",
          name: "research_agent",
          config: {
            graph: "template-react",
            input: "state.query",
          },
        },
      },
      {
        id: "parent-sink",
        type: "agent",
        position: { x: 200, y: 200 },
        data: {
          kind: "sink",
          name: "finish_parent",
          isTerminal: true,
          config: {},
        },
      },
    ];

    const edges: Edge[] = [
      { id: "pe1", source: "parent-trigger", target: "parent-subagent", label: "next" },
      { id: "pe2", source: "parent-subagent", target: "parent-sink", label: "next" },
    ];

    const logs = await runFlow({
      nodes,
      edges,
      gateways: [],
      initialState: { query: "parent task" },
    });

    // Parent flow should run 3 steps: trigger, subagent, sink
    expect(logs.length).toBe(3);

    const subagentLog = logs[1];
    expect(subagentLog.kind).toBe("subagent");
    expect(subagentLog.name).toBe("research_agent");

    // The subagent's output should have subLogs and details
    const output = subagentLog.output as any;
    expect(output).toBeDefined();
    expect(output.subagent).toBe("ReAct Agent Loop");
    expect(output.input).toEqual({ query: "parent task" });
    expect(output.subLogs).toBeDefined();
    expect(output.subLogs.length).toBeGreaterThan(0);

    // Let's verify that the subLogs steps executed correctly
    const firstSubLog = output.subLogs[0];
    expect(firstSubLog.name).toBe("on_user_query");
    expect(firstSubLog.kind).toBe("trigger");
  });
});
