import { describe, it, expect } from "vitest";
import { runFlow } from "../flow/runFlow";
import { generateCode } from "../flow/codegen";
import { validateGraph } from "../flow/validate";
import type { Node, Edge } from "reactflow";
import type { AgentNodeData } from "../flow/types";

describe("Data Transform and Array Loop nodes", () => {
  it("should execute transform nodes for json_map, pick_fields, template_string, set_keys, flatten_object", async () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "trigger",
          name: "on_request",
          config: { source: "manual" },
          isEntry: true,
        },
      },
      {
        id: "n2",
        type: "agent",
        position: { x: 100, y: 100 },
        data: {
          kind: "transform",
          name: "pick_user_fields",
          config: {
            operation: "pick_fields",
            input_key: "state.user",
            target_key: "picked_user",
            expression: "id, name",
          },
        },
      },
      {
        id: "n3",
        type: "agent",
        position: { x: 200, y: 200 },
        data: {
          kind: "transform",
          name: "template_string_op",
          config: {
            operation: "template_string",
            target_key: "greeting",
            expression: "Hello {{state.user.name}}, your id is {{state.user.id}}",
          },
        },
      },
      {
        id: "n4",
        type: "agent",
        position: { x: 300, y: 300 },
        data: {
          kind: "transform",
          name: "flatten_nested",
          config: {
            operation: "flatten_object",
            input_key: "state.nested",
            target_key: "flat",
            expression: "",
          },
        },
      },
      {
        id: "n5",
        type: "agent",
        position: { x: 400, y: 400 },
        data: {
          kind: "sink",
          name: "sink_out",
          config: { target: "response" },
          isTerminal: true,
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", label: "next" },
      { id: "e2", source: "n2", target: "n3", label: "next" },
      { id: "e3", source: "n3", target: "n4", label: "next" },
      { id: "e4", source: "n4", target: "n5", label: "next" },
    ];

    const logs = await runFlow({
      nodes,
      edges,
      gateways: [],
      initialState: {
        user: { id: "u123", name: "Alice", email: "alice@example.com" },
        nested: { a: { b: { c: 42 } }, d: "hello" },
      },
    });

    expect(logs.length).toBe(5);

    const pickLog = logs.find((l) => l.nodeId === "n2");
    expect(pickLog?.output).toEqual({
      operation: "pick_fields",
      targetKey: "picked_user",
      result: { id: "u123", name: "Alice" },
    });

    const tmplLog = logs.find((l) => l.nodeId === "n3");
    expect(tmplLog?.output).toEqual({
      operation: "template_string",
      targetKey: "greeting",
      result: "Hello Alice, your id is u123",
    });

    const flatLog = logs.find((l) => l.nodeId === "n4");
    expect(flatLog?.output).toEqual({
      operation: "flatten_object",
      targetKey: "flat",
      result: { "a.b.c": 42, d: "hello" },
    });
  });

  it("should execute loop nodes to iterate over state arrays and bind item context", async () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "trigger",
          name: "on_request",
          config: {},
          isEntry: true,
        },
      },
      {
        id: "n2",
        type: "agent",
        position: { x: 100, y: 100 },
        data: {
          kind: "loop",
          name: "process_items",
          config: {
            array_key: "state.raw_items",
            item_var: "elem",
            target_key: "processed_items",
            transform_template: '{"name": "{{elem.title}}", "status": "processed"}',
            max_iterations: "50",
          },
        },
      },
      {
        id: "n3",
        type: "agent",
        position: { x: 200, y: 200 },
        data: {
          kind: "sink",
          name: "sink_out",
          config: { target: "response" },
          isTerminal: true,
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", label: "next" },
      { id: "e2", source: "n2", target: "n3", label: "next" },
    ];

    const logs = await runFlow({
      nodes,
      edges,
      gateways: [],
      initialState: {
        raw_items: [
          { title: "Task A" },
          { title: "Task B" },
          { title: "Task C" },
        ],
      },
    });

    expect(logs.length).toBe(3);

    const loopLog = logs.find((l) => l.nodeId === "n2");
    expect(loopLog?.output).toEqual({
      total: 3,
      items: [
        { name: "Task A", status: "processed" },
        { name: "Task B", status: "processed" },
        { name: "Task C", status: "processed" },
      ],
      target_key: "processed_items",
    });

    const sinkLog = logs.find((l) => l.nodeId === "n3");
    expect(sinkLog?.stateSnapshot?.processed_items).toEqual([
      { name: "Task A", status: "processed" },
      { name: "Task B", status: "processed" },
      { name: "Task C", status: "processed" },
    ]);
  });

  it("should generate valid Python and JavaScript code for transform and loop nodes", () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "trigger",
          name: "on_request",
          config: {},
          isEntry: true,
        },
      },
      {
        id: "n2",
        type: "agent",
        position: { x: 100, y: 100 },
        data: {
          kind: "transform",
          name: "transform_data",
          config: {
            operation: "pick_fields",
            input_key: "user",
            target_key: "picked",
            expression: "name, email",
          },
        },
      },
      {
        id: "n3",
        type: "agent",
        position: { x: 200, y: 200 },
        data: {
          kind: "loop",
          name: "loop_items",
          config: {
            array_key: "items",
            item_var: "item",
            target_key: "mapped",
            transform_template: "{{item}}",
            max_iterations: "10",
          },
        },
      },
      {
        id: "n4",
        type: "agent",
        position: { x: 300, y: 300 },
        data: {
          kind: "sink",
          name: "finish",
          config: {},
          isTerminal: true,
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", label: "next" },
      { id: "e2", source: "n2", target: "n3", label: "next" },
      { id: "e3", source: "n3", target: "n4", label: "next" },
    ];

    const pyRes = generateCode("python", nodes, edges);
    expect(pyRes.code).toContain('async def transform_data(state: State) -> str:');
    expect(pyRes.code).toContain('async def loop_items(state: State) -> str:');
    expect(pyRes.code).toContain('Data Transform op="pick_fields"');
    expect(pyRes.code).toContain('Array Loop over state.items');

    const jsRes = generateCode("javascript", nodes, edges);
    expect(jsRes.code).toContain('graph.node("transform_data"');
    expect(jsRes.code).toContain('graph.node("loop_items"');
  });

  it("should validate missing target_key or array_key in transform and loop nodes", () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "on_request", config: {}, isEntry: true },
      },
      {
        id: "n2",
        type: "agent",
        position: { x: 100, y: 100 },
        data: { kind: "transform", name: "bad_transform", config: { target_key: "" } },
      },
      {
        id: "n3",
        type: "agent",
        position: { x: 200, y: 200 },
        data: { kind: "loop", name: "bad_loop", config: { array_key: "", target_key: "" } },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", label: "next" },
      { id: "e2", source: "n2", target: "n3", label: "next" },
    ];

    const issues = validateGraph(nodes, edges);
    expect(issues.some((i) => i.kind === "transform-missing-key")).toBe(true);
    expect(issues.some((i) => i.kind === "loop-missing-key")).toBe(true);
  });
});
