import { describe, it, expect } from "vitest";
import { runNode } from "../flow/runFlow";
import { generateCode } from "../flow/codegen";
import { validateGraph } from "../flow/validate";
import type { Node, Edge } from "reactflow";
import type { AgentNodeData } from "../flow/types";

describe("Data Transform & Array Loop Iterator Node Suite", () => {
  it("should execute transform node operations correctly in runNode", async () => {
    // 1. json_map
    const jsonMapNode: Node<AgentNodeData> = {
      id: "n_transform_1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "transform",
        name: "test_json_map",
        config: {
          operation: "json_map",
          input_path: "state.user",
          output_key: "mapped_user",
          params: '{"first_name": "firstName", "last_name": "lastName"}',
        },
      },
    };
    const state1: Record<string, unknown> = {
      user: { first_name: "Alice", last_name: "Smith", age: 30 },
    };
    const res1 = (await runNode(jsonMapNode, state1, [], { nodes: [jsonMapNode], edges: [], gateways: [] }, [], [])) as any;
    expect(res1.operation).toBe("json_map");
    expect(res1.output_key).toBe("mapped_user");
    expect(state1.mapped_user).toEqual({
      firstName: "Alice",
      lastName: "Smith",
      age: 30,
    });

    // 2. pick_fields
    const pickFieldsNode: Node<AgentNodeData> = {
      id: "n_transform_2",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "transform",
        name: "test_pick_fields",
        config: {
          operation: "pick_fields",
          input_path: "state.user",
          output_key: "picked_user",
          params: "first_name, age",
        },
      },
    };
    const state2: Record<string, unknown> = {
      user: { first_name: "Bob", last_name: "Jones", age: 25, city: "NYC" },
    };
    await runNode(pickFieldsNode, state2, [], { nodes: [pickFieldsNode], edges: [], gateways: [] }, [], []);
    expect(state2.picked_user).toEqual({
      first_name: "Bob",
      age: 25,
    });

    // 3. template_string
    const templateNode: Node<AgentNodeData> = {
      id: "n_transform_3",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "transform",
        name: "test_template",
        config: {
          operation: "template_string",
          output_key: "formatted_msg",
          params: "Hello {{state.user.name}}, welcome to {{global.APP_NAME}}!",
        },
      },
    };
    const state3: Record<string, unknown> = {
      user: { name: "Charlie" },
    };
    await runNode(
      templateNode,
      state3,
      [],
      { nodes: [templateNode], edges: [], gateways: [] },
      [{ key: "APP_NAME", value: "AgentFlow" }],
      []
    );
    expect(state3.formatted_msg).toBe("Hello Charlie, welcome to AgentFlow!");

    // 4. set_keys
    const setKeysNode: Node<AgentNodeData> = {
      id: "n_transform_4",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "transform",
        name: "test_set_keys",
        config: {
          operation: "set_keys",
          output_key: "keys_set",
          params: '{"status": "completed", "score": 98}',
        },
      },
    };
    const state4: Record<string, unknown> = {};
    await runNode(setKeysNode, state4, [], { nodes: [setKeysNode], edges: [], gateways: [] }, [], []);
    expect(state4.status).toBe("completed");
    expect(state4.score).toBe(98);

    // 5. flatten_object
    const flattenNode: Node<AgentNodeData> = {
      id: "n_transform_5",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "transform",
        name: "test_flatten",
        config: {
          operation: "flatten_object",
          input_path: "state.nested",
          output_key: "flat",
        },
      },
    };
    const state5: Record<string, unknown> = {
      nested: { a: 1, b: { c: 2, d: { e: 3 } } },
    };
    await runNode(flattenNode, state5, [], { nodes: [flattenNode], edges: [], gateways: [] }, [], []);
    expect(state5.flat).toEqual({
      a: 1,
      "b.c": 2,
      "b.d.e": 3,
    });
  });

  it("should execute loop node array iterations correctly in runNode", async () => {
    const loopNode: Node<AgentNodeData> = {
      id: "n_loop_1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "loop",
        name: "test_loop",
        config: {
          array_path: "state.products",
          item_var: "prod",
          transform_template: "{{prod.title}} ($/{{prod.price}})",
          max_iterations: "3",
          output_key: "formatted_products",
        },
      },
    };

    const state: Record<string, unknown> = {
      products: [
        { title: "Laptop", price: 999 },
        { title: "Mouse", price: 25 },
        { title: "Keyboard", price: 75 },
        { title: "Monitor", price: 300 }, // Should be capped by max_iterations = 3
      ],
    };

    const res = (await runNode(loopNode, state, [], { nodes: [loopNode], edges: [], gateways: [] }, [], [])) as any;
    expect(res.count).toBe(3);
    expect(res.output_key).toBe("formatted_products");
    expect(state.formatted_products).toEqual([
      "Laptop ($/999)",
      "Mouse ($/25)",
      "Keyboard ($/75)",
    ]);
  });

  it("should generate code for transform and loop nodes", () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "trig",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "start", config: {}, isEntry: true },
      },
      {
        id: "trans",
        type: "agent",
        position: { x: 0, y: 100 },
        data: {
          kind: "transform",
          name: "format_data",
          config: {
            operation: "template_string",
            params: "Result: {{state.query}}",
            output_key: "formatted",
          },
        },
      },
      {
        id: "lp",
        type: "agent",
        position: { x: 0, y: 200 },
        data: {
          kind: "loop",
          name: "iterate_items",
          config: {
            array_path: "state.items",
            item_var: "item",
            transform_template: "Item: {{item.name}}",
            output_key: "mapped_items",
          },
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "trig", target: "trans", label: "next" },
      { id: "e2", source: "trans", target: "lp", label: "next" },
    ];

    const py = generateCode("python", nodes, edges);
    expect(py.code).toContain("def format_data");
    expect(py.code).toContain("op = \"template_string\"");
    expect(py.code).toContain("def iterate_items");
    expect(py.code).toContain("arr_path = \"state.items\"");

    const js = generateCode("javascript", nodes, edges);
    expect(js.code).toContain("graph.node(\"format_data\"");
    expect(js.code).toContain("graph.node(\"iterate_items\"");
  });

  it("should validate missing transform and loop requirements in validateGraph", () => {
    const badNodes: Node<AgentNodeData>[] = [
      {
        id: "t1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "start", config: {}, isEntry: true },
      },
      {
        id: "trans_bad",
        type: "agent",
        position: { x: 0, y: 100 },
        data: {
          kind: "transform",
          name: "bad_transform",
          config: { output_key: "" }, // empty output_key
        },
      },
      {
        id: "loop_bad",
        type: "agent",
        position: { x: 0, y: 200 },
        data: {
          kind: "loop",
          name: "bad_loop",
          config: { array_path: "", output_key: "" }, // missing array_path & output_key
        },
      },
    ];

    const issues = validateGraph(badNodes, []);
    expect(issues.some((i) => i.message.includes("requires an output_key"))).toBe(true);
    expect(issues.some((i) => i.message.includes("requires array_path and output_key"))).toBe(true);
  });
});
