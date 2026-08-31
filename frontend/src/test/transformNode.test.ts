import { describe, it, expect } from "vitest";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";
import { runFlow } from "../flow/runFlow";
import { generatePython, generateJavaScript } from "../flow/codegen";

describe("Data Transform Node", () => {
  it("should execute json_map transform operation correctly", async () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "trigger",
          name: "Start",
          config: { source: "manual" },
          isEntry: true,
        },
      },
      {
        id: "2",
        type: "agent",
        position: { x: 0, y: 100 },
        data: {
          kind: "transform",
          name: "Format Output",
          config: {
            operation: "json_map",
            expression: '{"status": "ok", "query": "{{state.query}}"}',
            target_key: "state.formatted",
          },
        },
      },
      {
        id: "3",
        type: "agent",
        position: { x: 0, y: 200 },
        data: {
          kind: "sink",
          name: "End",
          config: { target: "response" },
          isTerminal: true,
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1-2", source: "1", target: "2", label: "next" },
      { id: "e2-3", source: "2", target: "3", label: "next" },
    ];

    const logs = await runFlow({
      nodes,
      edges,
      gateways: [],
      initialState: { query: "test transform" },
    });

    expect(logs.length).toBe(3);
    const transformLog = logs.find((l) => l.kind === "transform");
    expect(transformLog).toBeDefined();
    expect(transformLog?.output).toEqual({ status: "ok", query: "test transform" });
    expect(transformLog?.stateSnapshot?.formatted).toEqual({ status: "ok", query: "test transform" });
  });

  it("should execute pick_fields and template_string operations", async () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "trigger",
          name: "Start",
          config: {},
          isEntry: true,
        },
      },
      {
        id: "2",
        type: "agent",
        position: { x: 0, y: 100 },
        data: {
          kind: "transform",
          name: "Pick Fields",
          config: {
            operation: "pick_fields",
            expression: "user, role",
            target_key: "state.user_info",
          },
        },
      },
      {
        id: "3",
        type: "agent",
        position: { x: 0, y: 200 },
        data: {
          kind: "transform",
          name: "Template String",
          config: {
            operation: "template_string",
            expression: "User {{state.user_info.user}} has role {{state.user_info.role}}",
            target_key: "state.greeting",
          },
        },
      },
      {
        id: "4",
        type: "agent",
        position: { x: 0, y: 300 },
        data: {
          kind: "sink",
          name: "End",
          config: {},
          isTerminal: true,
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1-2", source: "1", target: "2", label: "next" },
      { id: "e2-3", source: "2", target: "3", label: "next" },
      { id: "e3-4", source: "3", target: "4", label: "next" },
    ];

    const logs = await runFlow({
      nodes,
      edges,
      gateways: [],
      initialState: { user: "Alice", role: "admin", extra: "ignored" },
    });

    const step3Log = logs.find((l) => l.name === "Template String");
    expect(step3Log).toBeDefined();
    expect(step3Log?.output).toBe("User Alice has role admin");
    expect(step3Log?.stateSnapshot?.greeting).toBe("User Alice has role admin");
  });

  it("should generate valid Python and JavaScript code for transform nodes", () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "Start", config: {}, isEntry: true },
      },
      {
        id: "2",
        type: "agent",
        position: { x: 0, y: 100 },
        data: {
          kind: "transform",
          name: "Reshape",
          config: { operation: "json_map", expression: '{"key": "val"}' },
        },
      },
    ];
    const edges: Edge[] = [{ id: "e1-2", source: "1", target: "2", label: "next" }];

    const pyResult = generatePython(nodes, edges);
    expect(pyResult.code).toContain("# Data Transform:");
    expect(pyResult.errors.length).toBe(0);

    const jsResult = generateJavaScript(nodes, edges);
    expect(jsResult.code).toContain("// Data Transform:");
    expect(jsResult.errors.length).toBe(0);
  });
});
