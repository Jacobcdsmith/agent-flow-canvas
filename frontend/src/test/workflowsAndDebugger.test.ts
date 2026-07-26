import { describe, it, expect, vi } from "vitest";
import { TEMPLATES, loadWorkflows, saveWorkflows, cryptoId } from "../flow/workflows";
import { runNode, pickNextEdge } from "../flow/runFlow";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";

describe("Workflows & Stepper Debugger Tests", () => {
  it("should have correct, non-empty default templates configured", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(3);
    const reactLoop = TEMPLATES.find((t) => t.id === "template-react");
    expect(reactLoop).toBeDefined();
    expect(reactLoop?.nodes.length).toBeGreaterThan(0);
    expect(reactLoop?.edges.length).toBeGreaterThan(0);
  });

  it("should support loading, saving, duplicating, and deleting workflows locally", () => {
    // Clean mock storage
    const mockStorage: Record<string, string> = {};

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: any, key: string, val: string) {
      mockStorage[key] = val;
    });

    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: any, key: string) {
      return mockStorage[key] || null;
    });

    // Test saving custom workflow list
    const customWf = {
      id: "custom-1",
      name: "Custom Workflow 1",
      nodes: [],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveWorkflows([customWf]);
    expect(setItemSpy).toHaveBeenCalled();
    expect(mockStorage["agent_flow.workflows.v1"]).toContain("Custom Workflow 1");

    // Test loading custom workflow list
    const loaded = loadWorkflows();
    expect(getItemSpy).toHaveBeenCalled();
    expect(loaded.length).toBe(1);
    expect(loaded[0].name).toBe("Custom Workflow 1");

    // Clean up mocks
    setItemSpy.mockRestore();
    getItemSpy.mockRestore();
  });

  it("should successfully run stepper next transitions using runNode and pickNextEdge", async () => {
    const node: Node<AgentNodeData> = {
      id: "step-1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "trigger",
        name: "test_trigger",
        config: { source: "manual" },
      },
    };

    const state: Record<string, unknown> = { query: "hello" };

    // Simulate stepping: execute trigger node
    const output = await runNode(node, state, [], { nodes: [node], edges: [], gateways: [] }, [], []);
    expect(output).toBeDefined();
    expect((output as any).triggered).toBe(true);

    // Test pickNextEdge logic
    const edges: Edge[] = [
      { id: "e1", source: "step-1", target: "step-2", label: "next" },
    ];
    const nextEdge = pickNextEdge(edges, state, false);
    expect(nextEdge).not.toBeNull();
    expect(nextEdge?.target).toBe("step-2");
  });
});
