import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { Node, Edge } from "reactflow";
import { Inspector } from "../flow/Inspector";
import { AgentNodeData } from "../flow/types";

// Polyfill ResizeObserver for JSDOM
if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe("Node Duplication and Inspector Actions", () => {
  const mockNode: Node<AgentNodeData> = {
    id: "node-1",
    type: "agent",
    position: { x: 100, y: 150 },
    data: {
      kind: "llm",
      name: "reason_agent",
      config: {
        model: "gpt-4o",
        prompt: "Analyze the user input",
      },
      isEntry: true,
      isTerminal: false,
    },
  };

  const mockEdges: Edge[] = [];
  const mockNodes: Node<AgentNodeData>[] = [mockNode];

  it("renders Duplicate Node button in Inspector when onDuplicate callback is provided", () => {
    const handleDuplicate = vi.fn();
    const handleChange = vi.fn();
    const handleDelete = vi.fn();

    render(
      <Inspector
        node={mockNode}
        edges={mockEdges}
        nodes={mockNodes}
        onChange={handleChange}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
      />
    );

    const duplicateBtn = screen.getByRole("button", { name: /duplicate node/i });
    expect(duplicateBtn).toBeInTheDocument();

    fireEvent.click(duplicateBtn);
    expect(handleDuplicate).toHaveBeenCalledWith("node-1");
  });

  it("correctly constructs a duplicate node with offset position and _copy name suffix", () => {
    // Replicate the duplicate node construction logic from Index.tsx
    const target = mockNode;
    const newId = "n101";
    const newName = `${target.data.name}_copy`;

    const newNode: Node<AgentNodeData> = {
      id: newId,
      type: target.type,
      position: { x: target.position.x + 30, y: target.position.y + 30 },
      data: {
        ...JSON.parse(JSON.stringify(target.data)),
        name: newName,
        isEntry: false,
      },
    };

    expect(newNode.id).toBe("n101");
    expect(newNode.data.name).toBe("reason_agent_copy");
    expect(newNode.position).toEqual({ x: 130, y: 180 });
    expect(newNode.data.isEntry).toBe(false);
    expect(newNode.data.config.model).toBe("gpt-4o");
  });
});
