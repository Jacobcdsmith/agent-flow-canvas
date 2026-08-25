import { describe, expect, it, beforeEach, vi } from "vitest";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";
import {
  ExecutionRunRecord,
  addRunToHistory,
  clearRunHistory,
  cryptoId,
  getStorageKey,
  loadRunHistory,
  saveRunHistory,
} from "../flow/runHistory";
import {
  fixNoTrigger,
  fixRouterBranches,
  validateGraph,
} from "../flow/validate";

describe("runHistory utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("generates cryptoId correctly", () => {
    const id1 = cryptoId();
    const id2 = cryptoId();
    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThan(0);
    expect(id1).not.toBe(id2);
  });

  it("handles storage key resolution and empty loads", () => {
    expect(getStorageKey("wf-1")).toBe("agent_flow.run_history.v1.wf-1");
    expect(getStorageKey(null)).toBe("agent_flow.run_history.v1.default");

    const history = loadRunHistory("wf-1");
    expect(history).toEqual([]);
  });

  it("saves, loads, prepends, and clears run history records in localStorage", () => {
    const run1: ExecutionRunRecord = {
      id: "run-1",
      workflowId: "test-wf",
      timestamp: 1000,
      durationMs: 120,
      status: "pass",
      stepCount: 2,
      initialState: { query: "hello" },
      finalOutput: { text: "world" },
      logs: [],
    };

    const run2: ExecutionRunRecord = {
      id: "run-2",
      workflowId: "test-wf",
      timestamp: 2000,
      durationMs: 250,
      status: "pass",
      stepCount: 3,
      initialState: { query: "foo" },
      finalOutput: { text: "bar" },
      logs: [],
    };

    saveRunHistory("test-wf", [run1]);
    expect(loadRunHistory("test-wf")).toEqual([run1]);

    const updated = addRunToHistory("test-wf", run2);
    expect(updated).toHaveLength(2);
    expect(updated[0]).toEqual(run2); // prepended
    expect(updated[1]).toEqual(run1);

    clearRunHistory("test-wf");
    expect(loadRunHistory("test-wf")).toEqual([]);
  });

  it("trims run history to maxRecords limit", () => {
    for (let i = 1; i <= 20; i++) {
      addRunToHistory("limit-wf", {
        id: `run-${i}`,
        workflowId: "limit-wf",
        timestamp: Date.now(),
        durationMs: i * 10,
        status: "pass",
        stepCount: i,
        initialState: {},
        finalOutput: null,
        logs: [],
      }, 5); // limit to 5
    }

    const loaded = loadRunHistory("limit-wf");
    expect(loaded).toHaveLength(5);
    expect(loaded[0].id).toBe("run-20"); // newest first
  });
});

describe("validate.ts quick-fix functions", () => {
  it("fixNoTrigger creates a trigger node and wires it to existing node", () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 200, y: 200 },
        data: { kind: "llm", name: "reason", config: {} },
      },
    ];
    const edges: Edge[] = [];

    // Validation confirms no trigger
    const initialIssues = validateGraph(nodes, edges);
    expect(initialIssues.some((i) => i.kind === "no-trigger")).toBe(true);

    // Apply fix
    const fixed = fixNoTrigger(nodes, edges);
    expect(fixed.nodes).toHaveLength(2);
    expect(fixed.nodes[0].data.kind).toBe("trigger");
    expect(fixed.edges).toHaveLength(1);
    expect(fixed.edges[0].source).toBe(fixed.nodes[0].id);
    expect(fixed.edges[0].target).toBe("n1");

    // Post-fix validation confirms trigger issue resolved
    const fixedIssues = validateGraph(fixed.nodes, fixed.edges);
    expect(fixedIssues.some((i) => i.kind === "no-trigger")).toBe(false);
  });

  it("fixRouterBranches wires missing true and false edges for router node", () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "trig",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "start", config: {}, isEntry: true },
      },
      {
        id: "r1",
        type: "agent",
        position: { x: 200, y: 0 },
        data: { kind: "router", name: "decide", config: { predicate: "state.query" } },
      },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "trig", target: "r1", label: "next" },
    ];

    // Validation confirms missing branches
    const initialIssues = validateGraph(nodes, edges);
    expect(initialIssues.some((i) => i.kind === "router-missing-branch")).toBe(true);

    // Apply quick fix
    const fixed = fixRouterBranches("r1", nodes, edges);
    expect(fixed.nodes.some((n) => n.data.kind === "sink")).toBe(true);

    const routerEdges = fixed.edges.filter((e) => e.source === "r1");
    const labels = routerEdges.map((e) => e.label);
    expect(labels).toContain("true");
    expect(labels).toContain("false");

    // Post-fix validation confirms router branch issue resolved
    const fixedIssues = validateGraph(fixed.nodes, fixed.edges);
    expect(fixedIssues.some((i) => i.kind === "router-missing-branch")).toBe(false);
  });
});
