import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Node, Edge } from "reactflow";
import { autoLayoutGraph } from "../flow/graphLayout";
import { CommandPalette } from "../flow/CommandPalette";
import type { AgentNodeData } from "../flow/types";

describe("autoLayoutGraph", () => {
  const sampleNodes: Node<AgentNodeData>[] = [
    {
      id: "n1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: { kind: "trigger", name: "on_start", config: {}, isEntry: true },
    },
    {
      id: "n2",
      type: "agent",
      position: { x: 0, y: 0 },
      data: { kind: "llm", name: "reason_agent", config: {} },
    },
    {
      id: "n3",
      type: "agent",
      position: { x: 0, y: 0 },
      data: { kind: "sink", name: "output_sink", config: {}, isTerminal: true },
    },
    {
      id: "n4",
      type: "note",
      position: { x: 50, y: 50 },
      data: { kind: "note", name: "note_1", config: { content: "Sample note" } },
    },
  ];

  const sampleEdges: Edge[] = [
    { id: "e1-2", source: "n1", target: "n2" },
    { id: "e2-3", source: "n2", target: "n3" },
  ];

  it("should calculate Top-to-Bottom (TB) hierarchical positions correctly", () => {
    const layout = autoLayoutGraph(sampleNodes, sampleEdges, "TB");
    expect(layout).toHaveLength(4);

    const n1 = layout.find((n) => n.id === "n1")!;
    const n2 = layout.find((n) => n.id === "n2")!;
    const n3 = layout.find((n) => n.id === "n3")!;

    // In TB layout, Y increases for subsequent rank levels
    expect(n1.position.y).toBeLessThan(n2.position.y);
    expect(n2.position.y).toBeLessThan(n3.position.y);
  });

  it("should calculate Left-to-Right (LR) hierarchical positions correctly", () => {
    const layout = autoLayoutGraph(sampleNodes, sampleEdges, "LR");
    expect(layout).toHaveLength(4);

    const n1 = layout.find((n) => n.id === "n1")!;
    const n2 = layout.find((n) => n.id === "n2")!;
    const n3 = layout.find((n) => n.id === "n3")!;

    // In LR layout, X increases for subsequent rank levels
    expect(n1.position.x).toBeLessThan(n2.position.x);
    expect(n2.position.x).toBeLessThan(n3.position.x);
  });

  it("should handle empty nodes array gracefully", () => {
    const layout = autoLayoutGraph([], []);
    expect(layout).toEqual([]);
  });
});

describe("CommandPalette Component", () => {
  const mockNodes: Node<AgentNodeData>[] = [
    {
      id: "n1",
      type: "agent",
      position: { x: 100, y: 100 },
      data: { kind: "trigger", name: "webhook_trigger", config: {} },
    },
    {
      id: "n2",
      type: "agent",
      position: { x: 200, y: 200 },
      data: { kind: "llm", name: "gpt_reasoner", config: {} },
    },
  ];

  it("should render and search existing nodes, node kinds, and action commands in real-time", () => {
    const onSelectNode = vi.fn();
    const onAddNodeType = vi.fn();
    const onRunCommand = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette
        isOpen={true}
        onClose={onClose}
        nodes={mockNodes}
        onSelectNode={onSelectNode}
        onAddNodeType={onAddNodeType}
        onRunCommand={onRunCommand}
      />
    );

    // Initial render checks
    expect(screen.getByPlaceholderText(/Type a command or search nodes/i)).toBeInTheDocument();
    expect(screen.getByText("webhook_trigger")).toBeInTheDocument();
    expect(screen.getByText("gpt_reasoner")).toBeInTheDocument();
    expect(screen.getByText("▶ Run Workflow")).toBeInTheDocument();

    // Filter query "gpt"
    const input = screen.getByPlaceholderText(/Type a command or search nodes/i);
    fireEvent.change(input, { target: { value: "gpt" } });

    expect(screen.getByText("gpt_reasoner")).toBeInTheDocument();
    expect(screen.queryByText("webhook_trigger")).not.toBeInTheDocument();

    // Select filtered item
    fireEvent.click(screen.getByText("gpt_reasoner"));
    expect(onSelectNode).toHaveBeenCalledWith("n2");
    expect(onClose).toHaveBeenCalled();
  });

  it("should dispatch add node type command when a node type item is clicked", () => {
    const onSelectNode = vi.fn();
    const onAddNodeType = vi.fn();
    const onRunCommand = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette
        isOpen={true}
        onClose={onClose}
        nodes={mockNodes}
        onSelectNode={onSelectNode}
        onAddNodeType={onAddNodeType}
        onRunCommand={onRunCommand}
      />
    );

    const input = screen.getByPlaceholderText(/Type a command or search nodes/i);
    fireEvent.change(input, { target: { value: "Sticky Note" } });

    const noteItem = screen.getByText("+ Add Sticky Note");
    fireEvent.click(noteItem);

    expect(onAddNodeType).toHaveBeenCalledWith("note");
    expect(onClose).toHaveBeenCalled();
  });

  it("should dispatch global commands when action items are selected", () => {
    const onSelectNode = vi.fn();
    const onAddNodeType = vi.fn();
    const onRunCommand = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette
        isOpen={true}
        onClose={onClose}
        nodes={mockNodes}
        onSelectNode={onSelectNode}
        onAddNodeType={onAddNodeType}
        onRunCommand={onRunCommand}
      />
    );

    const input = screen.getByPlaceholderText(/Type a command or search nodes/i);
    fireEvent.change(input, { target: { value: "Auto-Layout" } });

    const layoutCmd = screen.getByText("⤓ Auto-Layout Graph (Top-to-Bottom)");
    fireEvent.click(layoutCmd);

    expect(onRunCommand).toHaveBeenCalledWith("layout_tb");
    expect(onClose).toHaveBeenCalled();
  });
});
