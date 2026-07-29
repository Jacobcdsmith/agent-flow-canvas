import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WorkflowsManager } from "../flow/WorkflowsManager";
import { TEMPLATES, loadWorkflows, saveWorkflows, getActiveWorkflowId, setActiveWorkflowId } from "../flow/workflows";
import React from "react";

// Mocking localStorage for isolation
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("Workflows Module Persistence & Helpers", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("should return empty array when no workflows exist", () => {
    const list = loadWorkflows();
    expect(list).toEqual([]);
  });

  it("should save and load custom workflows successfully", () => {
    const mockWorkflow = {
      id: "wf-1",
      name: "Custom Agent Flow",
      description: "Test description",
      nodes: [],
      edges: [],
      updatedAt: new Date().toISOString(),
    };

    saveWorkflows([mockWorkflow]);
    const list = loadWorkflows();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Custom Agent Flow");
  });

  it("should get and set active workflow ID", () => {
    expect(getActiveWorkflowId()).toBeNull();
    setActiveWorkflowId("template-react-loop");
    expect(getActiveWorkflowId()).toBe("template-react-loop");
    setActiveWorkflowId(null);
    expect(getActiveWorkflowId()).toBeNull();
  });
});

describe("WorkflowsManager Component UI & User Actions", () => {
  const mockWorkflows = [
    {
      id: "custom-1",
      name: "Special Deep Researcher",
      description: "Custom deep research assistant",
      nodes: [],
      edges: [],
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockGetGraph = () => ({
    nodes: [{ id: "n1", type: "agent", position: { x: 0, y: 0 }, data: { kind: "trigger", name: "start", config: {} } }],
    edges: [],
  });

  it("renders correctly and lists both templates and custom workflows", () => {
    const selectSpy = vi.fn();
    const changeSpy = vi.fn();
    const closeSpy = vi.fn();

    render(
      <WorkflowsManager
        workflows={mockWorkflows}
        activeWorkflowId="template-react-loop"
        onWorkflowsChange={changeSpy}
        onSelectWorkflow={selectSpy}
        onClose={closeSpy}
        getCurrentGraph={mockGetGraph}
      />
    );

    // Assert headers
    expect(screen.getByText("Workflows & Templates Library")).toBeInTheDocument();

    // Custom and Templates listed
    expect(screen.getByText("Special Deep Researcher")).toBeInTheDocument();
    expect(screen.getAllByText("ReAct Loop").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("HTTP Router")).toBeInTheDocument();
    expect(screen.getByText("Translation HITL")).toBeInTheDocument();
  });

  it("filters search results correctly", () => {
    render(
      <WorkflowsManager
        workflows={mockWorkflows}
        activeWorkflowId="template-react-loop"
        onWorkflowsChange={vi.fn()}
        onSelectWorkflow={vi.fn()}
        onClose={vi.fn()}
        getCurrentGraph={mockGetGraph}
      />
    );

    const searchInput = screen.getByPlaceholderText("Search workflows...");
    fireEvent.change(searchInput, { target: { value: "Translation" } });

    // Translation should remain, others excluded
    expect(screen.getByText("Translation HITL")).toBeInTheDocument();
    expect(screen.queryByText("Special Deep Researcher")).not.toBeInTheDocument();
    expect(screen.queryByText("HTTP Router")).not.toBeInTheDocument();
  });

  it("loads selected template into workspace", () => {
    const selectSpy = vi.fn();
    const closeSpy = vi.fn();

    render(
      <WorkflowsManager
        workflows={mockWorkflows}
        activeWorkflowId="custom-1"
        onWorkflowsChange={vi.fn()}
        onSelectWorkflow={selectSpy}
        onClose={closeSpy}
        getCurrentGraph={mockGetGraph}
      />
    );

    // Select the "HTTP Router" template
    const routerBtn = screen.getByText("HTTP Router");
    fireEvent.click(routerBtn);

    // Load into workspace
    const loadBtn = screen.getByText("Load into Workspace");
    fireEvent.click(loadBtn);

    expect(selectSpy).toHaveBeenCalledWith("template-http-router", expect.any(Array), expect.any(Array));
    expect(closeSpy).toHaveBeenCalled();
  });

  it("allows duplicating selected workflow", () => {
    const changeSpy = vi.fn();

    render(
      <WorkflowsManager
        workflows={mockWorkflows}
        activeWorkflowId="custom-1"
        onWorkflowsChange={changeSpy}
        onSelectWorkflow={vi.fn()}
        onClose={vi.fn()}
        getCurrentGraph={mockGetGraph}
      />
    );

    const dupBtn = screen.getByText("Duplicate");
    fireEvent.click(dupBtn);

    expect(changeSpy).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: "Copy of Special Deep Researcher" })
    ]));
  });

  it("allows creating a new custom workflow from the current workspace layout", () => {
    const changeSpy = vi.fn();
    const selectSpy = vi.fn();

    render(
      <WorkflowsManager
        workflows={mockWorkflows}
        activeWorkflowId="custom-1"
        onWorkflowsChange={changeSpy}
        onSelectWorkflow={selectSpy}
        onClose={vi.fn()}
        getCurrentGraph={mockGetGraph}
      />
    );

    const newBtn = screen.getByText("+ New Workflow");
    fireEvent.click(newBtn);

    // Ensure it triggers workflows creation with layout state and selects it
    expect(changeSpy).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: "Custom Workflow 1", nodes: mockGetGraph().nodes })
    ]));
    expect(selectSpy).toHaveBeenCalledWith(expect.any(String), mockGetGraph().nodes, []);
  });
});
