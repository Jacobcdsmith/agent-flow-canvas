import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Node, Edge } from "reactflow";
import type { AgentNodeData } from "@/flow/types";
import { runFlow, runNode } from "@/flow/runFlow";
import { generateCode } from "@/flow/codegen";
import { validateGraph } from "@/flow/validate";
import { WorkflowAnalyticsModal } from "@/flow/WorkflowAnalyticsModal";

if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe("Data Transform & Loop Nodes & Analytics Modal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("Transform Node Execution", () => {
    it("executes pick_fields operation correctly", async () => {
      const node: Node<AgentNodeData> = {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "transform",
          name: "pick_user_info",
          config: {
            operation: "pick_fields",
            source_path: "state.user",
            target_key: "picked_user",
            param: "name, email",
          },
        },
      };

      const state: Record<string, unknown> = {
        user: { name: "Alice", email: "alice@example.com", age: 30, secretKey: "12345" },
      };

      const res = await runNode(node, state, [], { nodes: [node], edges: [], gateways: [] }, [], []);
      expect(res).toEqual({ name: "Alice", email: "alice@example.com" });
      expect(state.picked_user).toEqual({ name: "Alice", email: "alice@example.com" });
    });

    it("executes template_string operation correctly", async () => {
      const node: Node<AgentNodeData> = {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "transform",
          name: "format_greeting",
          config: {
            operation: "template_string",
            source_path: "state",
            target_key: "greeting",
            param: "Hello, {{state.username}}!",
          },
        },
      };

      const state: Record<string, unknown> = { username: "Bob" };
      const res = await runNode(node, state, [], { nodes: [node], edges: [], gateways: [] }, [], []);
      expect(res).toBe("Hello, Bob!");
      expect(state.greeting).toBe("Hello, Bob!");
    });

    it("executes flatten_object operation correctly", async () => {
      const node: Node<AgentNodeData> = {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "transform",
          name: "flatten_meta",
          config: {
            operation: "flatten_object",
            source_path: "state.meta",
            target_key: "flat_meta",
            param: "",
          },
        },
      };

      const state: Record<string, unknown> = {
        meta: {
          app: "agent_flow",
          config: { theme: "dark", level: 2 },
        },
      };

      const res = await runNode(node, state, [], { nodes: [node], edges: [], gateways: [] }, [], []);
      expect(res).toEqual({
        "app": "agent_flow",
        "config.theme": "dark",
        "config.level": 2,
      });
      expect(state.flat_meta).toEqual({
        "app": "agent_flow",
        "config.theme": "dark",
        "config.level": 2,
      });
    });

    it("executes json_map operation correctly", async () => {
      const node: Node<AgentNodeData> = {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "transform",
          name: "map_fields",
          config: {
            operation: "json_map",
            source_path: "state.input",
            target_key: "mapped_output",
            param: JSON.stringify({ fullName: "state.input.first", role: "state.input.title" }),
          },
        },
      };

      const state: Record<string, unknown> = {
        input: { first: "Charlie", title: "Engineer" },
      };

      const res = await runNode(node, state, [], { nodes: [node], edges: [], gateways: [] }, [], []);
      expect(res).toEqual({ fullName: "Charlie", role: "Engineer" });
      expect(state.mapped_output).toEqual({ fullName: "Charlie", role: "Engineer" });
    });
  });

  describe("Loop Node Execution", () => {
    it("iterates array items and applies template transformation", async () => {
      const node: Node<AgentNodeData> = {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "loop",
          name: "process_users",
          config: {
            items_path: "state.users",
            item_var: "u",
            output_key: "processed_users",
            transform_template: "{{u.name}} ({{u.role}})",
            max_iterations: "10",
          },
        },
      };

      const state: Record<string, unknown> = {
        users: [
          { name: "Alice", role: "Dev" },
          { name: "Bob", role: "Design" },
        ],
      };

      const res = (await runNode(node, state, [], { nodes: [node], edges: [], gateways: [] }, [], [])) as any;
      expect(res.count).toBe(2);
      expect(res.items).toEqual(["Alice (Dev)", "Bob (Design)"]);
      expect(state.processed_users).toEqual(["Alice (Dev)", "Bob (Design)"]);
    });

    it("respects max_iterations limit in loop", async () => {
      const node: Node<AgentNodeData> = {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "loop",
          name: "limit_loop",
          config: {
            items_path: "state.numbers",
            item_var: "num",
            output_key: "capped_numbers",
            transform_template: "{{num}}",
            max_iterations: "2",
          },
        },
      };

      const state: Record<string, unknown> = { numbers: [10, 20, 30, 40, 50] };
      const res = (await runNode(node, state, [], { nodes: [node], edges: [], gateways: [] }, [], [])) as any;
      expect(res.count).toBe(2);
      expect(res.items).toEqual(["10", "20"]);
    });
  });

  describe("Codegen & Graph Validation", () => {
    it("generates Python and JS code for transform and loop nodes", () => {
      const nodes: Node<AgentNodeData>[] = [
        {
          id: "n1",
          type: "agent",
          position: { x: 0, y: 0 },
          data: { kind: "trigger", name: "start", config: {}, isEntry: true },
        },
        {
          id: "n2",
          type: "agent",
          position: { x: 100, y: 0 },
          data: {
            kind: "transform",
            name: "transform_data",
            config: { operation: "pick_fields", source_path: "state.data", target_key: "picked", param: "id,name" },
          },
        },
        {
          id: "n3",
          type: "agent",
          position: { x: 200, y: 0 },
          data: {
            kind: "loop",
            name: "loop_data",
            config: { items_path: "state.items", item_var: "x", output_key: "res", transform_template: "{{x}}" },
          },
        },
      ];

      const edges: Edge[] = [
        { id: "e1", source: "n1", target: "n2", label: "next" },
        { id: "e2", source: "n2", target: "n3", label: "next" },
      ];

      const pyRes = generateCode("python", nodes, edges);
      expect(pyRes.code).toContain("Data Transform op=pick_fields");
      expect(pyRes.code).toContain("Loop Iterator items=");

      const jsRes = generateCode("javascript", nodes, edges);
      expect(jsRes.code).toContain("const sourceVal = state.get");
      expect(jsRes.code).toContain("const itemsList = Array.isArray");
    });

    it("validates transform and loop node configuration in validateGraph", () => {
      const nodes: Node<AgentNodeData>[] = [
        {
          id: "n1",
          type: "agent",
          position: { x: 0, y: 0 },
          data: { kind: "trigger", name: "start", config: {}, isEntry: true },
        },
        {
          id: "n2",
          type: "agent",
          position: { x: 100, y: 0 },
          data: {
            kind: "transform",
            name: "bad_transform",
            config: { target_key: "" },
          },
        },
        {
          id: "n3",
          type: "agent",
          position: { x: 200, y: 0 },
          data: {
            kind: "loop",
            name: "bad_loop",
            config: { items_path: "" },
          },
        },
      ];

      const edges: Edge[] = [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
      ];

      const issues = validateGraph(nodes, edges);
      expect(issues.some((i) => i.message.includes("missing target_key"))).toBe(true);
      expect(issues.some((i) => i.message.includes("missing items_path"))).toBe(true);
    });
  });

  describe("Workflow Analytics Modal", () => {
    it("renders analytics modal and calculates metrics correctly", () => {
      const sampleLogs = [
        {
          step: 1,
          nodeId: "n1",
          name: "Trigger Node",
          kind: "trigger",
          label: "start",
          output: { triggered: true },
          ms: 5,
        },
        {
          step: 2,
          nodeId: "n2",
          name: "Reason Step",
          kind: "llm",
          label: "next",
          output: "AI completion output text",
          ms: 120,
          stateSnapshot: { query: "User input query" },
        },
      ];

      render(
        <WorkflowAnalyticsModal
          isOpen={true}
          runLogs={sampleLogs}
          nodes={[]}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("📊 Workflow Performance Profiler")).toBeInTheDocument();
      expect(screen.getByText("125 ms")).toBeInTheDocument();
      expect(screen.getByText("2 steps")).toBeInTheDocument();
      expect(screen.getByText("PASS ✓")).toBeInTheDocument();
      expect(screen.getAllByText("Reason Step")[0]).toBeInTheDocument();
    });
  });
});
