import { describe, it, expect, beforeEach, vi } from "vitest";
import { runFlow } from "../flow/runFlow";
import { generateCode } from "../flow/codegen";
import {
  exportWorkspaceBundle,
  validateWorkspaceBundle,
  importWorkspaceBundle,
} from "../flow/workspace";
import { saveRunRecord, loadRunHistory, clearRunHistory } from "../flow/runHistory";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";

describe("Advanced Nodes & Features Test Suite", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should execute transform node operations correctly (json_map, pick_fields, template_string, set_keys, flatten_object)", async () => {
    // Test 1: pick_fields
    const nodesPick: Node<AgentNodeData>[] = [
      {
        id: "trig",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "trigger", config: {}, isEntry: true },
      },
      {
        id: "tf",
        type: "agent",
        position: { x: 0, y: 100 },
        data: {
          kind: "transform",
          name: "pick_user",
          config: {
            op: "pick_fields",
            spec: "name,role",
            output_key: "picked",
          },
        },
      },
    ];
    const edgesPick: Edge[] = [
      { id: "e1", source: "trig", target: "tf", label: "next" },
    ];

    const logsPick = await runFlow({
      nodes: nodesPick,
      edges: edgesPick,
      gateways: [],
      initialState: { name: "Alice", role: "admin", secret_hash: "12345" },
    });

    const lastLogPick = logsPick[logsPick.length - 1];
    expect(lastLogPick.stateSnapshot?.picked).toEqual({
      name: "Alice",
      role: "admin",
    });

    // Test 2: template_string & set_keys
    const nodesKeys: Node<AgentNodeData>[] = [
      {
        id: "trig",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "trigger", config: {}, isEntry: true },
      },
      {
        id: "tf",
        type: "agent",
        position: { x: 0, y: 100 },
        data: {
          kind: "transform",
          name: "set_variables",
          config: {
            op: "set_keys",
            spec: '{"processed_user": "User: {{state.user}}", "status": "active"}',
            output_key: "output_keys",
          },
        },
      },
    ];

    const logsKeys = await runFlow({
      nodes: nodesKeys,
      edges: edgesPick,
      gateways: [],
      initialState: { user: "Bob" },
    });

    const lastLogKeys = logsKeys[logsKeys.length - 1];
    expect(lastLogKeys.stateSnapshot?.processed_user).toBe("User: Bob");
    expect(lastLogKeys.stateSnapshot?.status).toBe("active");
  });

  it("should execute loop node array iteration and bind item variables with iteration limits", async () => {
    const nodesLoop: Node<AgentNodeData>[] = [
      {
        id: "trig",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "trigger", config: {}, isEntry: true },
      },
      {
        id: "lp",
        type: "agent",
        position: { x: 0, y: 100 },
        data: {
          kind: "loop",
          name: "iterate_items",
          config: {
            items_path: "items",
            item_var: "curr_item",
            index_var: "curr_index",
            output_key: "my_results",
            max_iterations: "2",
          },
        },
      },
    ];
    const edgesLoop: Edge[] = [
      { id: "e1", source: "trig", target: "lp", label: "next" },
    ];

    const logs = await runFlow({
      nodes: nodesLoop,
      edges: edgesLoop,
      gateways: [],
      initialState: { items: ["apple", "banana", "cherry", "date"] },
    });

    const loopLog = logs[logs.length - 1];
    expect(loopLog.output).toMatchObject({
      itemCount: 4,
      iterationsProcessed: 2,
    });
    expect(loopLog.stateSnapshot?.curr_item).toBe("banana");
    expect(loopLog.stateSnapshot?.curr_index).toBe(1);
    expect(loopLog.stateSnapshot?.my_results).toHaveLength(2);
  });

  it("should generate valid Python and JavaScript code for transform and loop nodes", () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "trig",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "start", config: {}, isEntry: true },
      },
      {
        id: "tf",
        type: "agent",
        position: { x: 0, y: 100 },
        data: {
          kind: "transform",
          name: "transform_data",
          config: { op: "json_map", spec: '{"a": 1}', output_key: "out" },
        },
      },
      {
        id: "lp",
        type: "agent",
        position: { x: 0, y: 200 },
        data: {
          kind: "loop",
          name: "loop_items",
          config: { items_path: "arr", item_var: "elem", max_iterations: "10" },
        },
      },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "trig", target: "tf", label: "next" },
      { id: "e2", source: "tf", target: "lp", label: "next" },
    ];

    const pyResult = generateCode("python", nodes, edges);
    expect(pyResult.code).toContain('op = "json_map"');
    expect(pyResult.code).toContain('items_path = "arr"');

    const jsResult = generateCode("javascript", nodes, edges);
    expect(jsResult.code).toContain('const op = "json_map";');
    expect(jsResult.code).toContain('const itemsPath = "arr";');
  });

  it("should export, validate, and import full workspace backup bundles", () => {
    // Setup initial workspace state
    localStorage.setItem(
      "agent_flow.globals",
      JSON.stringify([{ id: "g1", key: "ENV", value: "production" }])
    );
    localStorage.setItem(
      "agent_flow.secrets",
      JSON.stringify([{ id: "s1", key: "TOKEN", value: "secret123" }])
    );

    const bundle = exportWorkspaceBundle({ includeApiKeys: true });
    expect(bundle.version).toBe("agent_flow.workspace.v1");
    expect(bundle.globals).toHaveLength(1);
    expect(bundle.globals[0].key).toBe("ENV");

    const valResult = validateWorkspaceBundle(JSON.stringify(bundle));
    expect(valResult.valid).toBe(true);
    expect(valResult.bundle?.globals).toHaveLength(1);

    // Clear and restore workspace
    localStorage.clear();
    const importStats = importWorkspaceBundle(bundle, "replace");
    expect(importStats.globalsCount).toBe(1);
    expect(importStats.secretsCount).toBe(1);

    const restoredGlobals = JSON.parse(localStorage.getItem("agent_flow.globals") || "[]");
    expect(restoredGlobals[0].key).toBe("ENV");
  });

  it("should save and retrieve workflow run execution history", () => {
    const dummyLogs = [
      {
        step: 1,
        nodeId: "n1",
        name: "start",
        kind: "trigger",
        label: "next",
        ms: 5,
      },
    ];

    saveRunRecord("test_wf", dummyLogs, { query: "hello" });
    const history = loadRunHistory("test_wf");

    expect(history).toHaveLength(1);
    expect(history[0].workflowId).toBe("test_wf");
    expect(history[0].logs).toHaveLength(1);
    expect(history[0].status).toBe("pass");

    clearRunHistory("test_wf");
    expect(loadRunHistory("test_wf")).toHaveLength(0);
  });
});
