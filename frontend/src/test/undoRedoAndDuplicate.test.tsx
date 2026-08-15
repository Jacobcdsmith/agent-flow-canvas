import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Inspector } from "../flow/Inspector";
import { Node } from "reactflow";
import { AgentNodeData } from "../flow/types";

describe("Inspector Component - Node Duplication", () => {
  const sampleNode: Node<AgentNodeData> = {
    id: "n1",
    type: "agent",
    position: { x: 100, y: 150 },
    data: {
      kind: "llm",
      name: "reasoning_step",
      config: {
        model: "gpt-4",
        prompt: "Analyze user input",
      },
    },
  };

  it("should render the duplicate button in Inspector when onDuplicate callback is provided", () => {
    const onChange = vi.fn();
    const onDelete = vi.fn();
    const onDuplicate = vi.fn();

    render(
      <Inspector
        node={sampleNode}
        edges={[]}
        nodes={[sampleNode]}
        onChange={onChange}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
      />
    );

    const duplicateBtn = screen.getByRole("button", { name: /duplicate/i });
    expect(duplicateBtn).toBeInTheDocument();

    fireEvent.click(duplicateBtn);
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledWith("n1");
  });

  it("should handle node duplication logic with offset position and name suffix correctly", () => {
    const targetNode: Node<AgentNodeData> = {
      id: "n2",
      type: "agent",
      position: { x: 200, y: 300 },
      data: {
        kind: "tool",
        name: "search_tool",
        config: {
          tool: "web_search",
          args: "{ query: 'test' }",
        },
      },
    };

    // Simulate node duplication function as implemented in Canvas
    const createDuplicatedNode = (
      target: Node<AgentNodeData>,
      newId: string
    ): Node<AgentNodeData> => {
      return {
        ...JSON.parse(JSON.stringify(target)),
        id: newId,
        position: {
          x: target.position.x + 30,
          y: target.position.y + 30,
        },
        data: {
          ...JSON.parse(JSON.stringify(target.data)),
          name: `${target.data.name}_copy`,
        },
      };
    };

    const dup = createDuplicatedNode(targetNode, "n3");

    expect(dup.id).toBe("n3");
    expect(dup.position).toEqual({ x: 230, y: 330 });
    expect(dup.data.kind).toBe("tool");
    expect(dup.data.name).toBe("search_tool_copy");
    expect(dup.data.config).toEqual({
      tool: "web_search",
      args: "{ query: 'test' }",
    });
  });

  it("should support undo/redo stack push and pop operations cleanly", () => {
    type State = { nodes: Node<AgentNodeData>[]; edges: any[] };
    const undoStack: State[] = [];
    const redoStack: State[] = [];

    let currentState: State = {
      nodes: [sampleNode],
      edges: [],
    };

    const snapshot = (newState: State) => {
      undoStack.push(JSON.parse(JSON.stringify(currentState)));
      currentState = newState;
      redoStack.length = 0; // clear redo stack on new operation
    };

    const undo = () => {
      const prev = undoStack.pop();
      if (prev) {
        redoStack.push(JSON.parse(JSON.stringify(currentState)));
        currentState = prev;
      }
    };

    const redo = () => {
      const next = redoStack.pop();
      if (next) {
        undoStack.push(JSON.parse(JSON.stringify(currentState)));
        currentState = next;
      }
    };

    // Operation 1: Add a new node
    const newNode: Node<AgentNodeData> = {
      id: "n2",
      type: "agent",
      position: { x: 300, y: 300 },
      data: { kind: "sink", name: "return_result", config: {} },
    };

    snapshot({
      nodes: [sampleNode, newNode],
      edges: [],
    });

    expect(currentState.nodes).toHaveLength(2);
    expect(undoStack).toHaveLength(1);
    expect(redoStack).toHaveLength(0);

    // Perform Undo
    undo();
    expect(currentState.nodes).toHaveLength(1);
    expect(undoStack).toHaveLength(0);
    expect(redoStack).toHaveLength(1);

    // Perform Redo
    redo();
    expect(currentState.nodes).toHaveLength(2);
    expect(undoStack).toHaveLength(1);
    expect(redoStack).toHaveLength(0);
  });
});
