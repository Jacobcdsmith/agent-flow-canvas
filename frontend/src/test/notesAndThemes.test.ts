import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateGraph } from "../flow/validate";
import { runFlow } from "../flow/runFlow";
import { generatePython, generateJavaScript } from "../flow/codegen";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";

describe("Sticky Notes and Dynamic Canvas Themes Features", () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => {
      if (key === "agent_flow.canvas_theme") return "retro";
      return null;
    });
  });

  it("should ignore note nodes during graph validation", () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "trig",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "start", isEntry: true, config: {} },
      },
      {
        id: "sink",
        type: "agent",
        position: { x: 0, y: 100 },
        data: { kind: "sink", name: "end", isTerminal: true, config: {} },
      },
      {
        id: "note1",
        type: "note",
        position: { x: 200, y: 50 },
        data: {
          kind: "note",
          name: "note",
          config: { content: "Documentation note...", color: "pink" },
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "trig", target: "sink", label: "next" },
    ];

    const issues = validateGraph(nodes, edges);
    expect(issues.length).toBe(0);
  });

  it("should execute note nodes as annotation step without breaking flow execution", async () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "trig",
        type: "agent",
        position: { x: 0, y: 0 },
        data: { kind: "trigger", name: "start", isEntry: true, config: {} },
      },
      {
        id: "note1",
        type: "note",
        position: { x: 0, y: 100 },
        data: {
          kind: "note",
          name: "my_note",
          config: { content: "Sticky note annotation text", color: "green" },
        },
      },
      {
        id: "sink",
        type: "agent",
        position: { x: 0, y: 200 },
        data: { kind: "sink", name: "end", isTerminal: true, config: {} },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "trig", target: "note1", label: "next" },
      { id: "e2", source: "note1", target: "sink", label: "next" },
    ];

    const logs = await runFlow({ nodes, edges, gateways: [] });
    expect(logs.length).toBe(3);
    expect(logs[1].kind).toBe("note");
    expect((logs[1].output as any).annotationOnly).toBe(true);
    expect((logs[1].output as any).note).toBe("Sticky note annotation text");
  });

  it("should format sticky note content as comments in Python and JavaScript code generation", () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "note1",
        type: "note",
        position: { x: 0, y: 0 },
        data: {
          kind: "note",
          name: "my_note",
          config: { content: "Important architecture note\nLine 2 info", color: "blue" },
        },
      },
    ];

    const py = generatePython(nodes, []);
    expect(py.code).toContain("# Sticky Note Annotation:");
    expect(py.code).toContain("# Important architecture note");
    expect(py.code).toContain("# Line 2 info");

    const js = generateJavaScript(nodes, []);
    expect(js.code).toContain("// Sticky Note Annotation:");
    expect(js.code).toContain("// Important architecture note");
    expect(js.code).toContain("// Line 2 info");
  });
});
