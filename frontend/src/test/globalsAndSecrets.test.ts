// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { runFlow } from "../flow/runFlow";
import { generatePython, generateJavaScript } from "../flow/codegen";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { useState } from "react";
import { GlobalsManager } from "../flow/GlobalsManager";

describe("Globals and Secrets Features", () => {
  const nodes: Node<AgentNodeData>[] = [
    {
      id: "n1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        kind: "trigger",
        name: "start",
        config: {},
        isEntry: true,
      },
    },
    {
      id: "n2",
      type: "agent",
      position: { x: 100, y: 100 },
      data: {
        kind: "http",
        name: "api_call",
        config: {
          url: "https://api.example.com/v1/{{global.API_VERSION}}/data",
          method: "POST",
          headers: '{"Authorization": "Bearer {{secret.API_KEY}}", "Content-Type": "application/json"}',
          body: '{"query": "{{query}}", "env": "{{global.ENV_NAME}}"}',
        },
      },
    },
    {
      id: "n3",
      type: "agent",
      position: { x: 200, y: 200 },
      data: {
        kind: "sink",
        name: "finish",
        config: {},
        isTerminal: true,
      },
    },
  ];

  const edges: Edge[] = [
    { id: "e1", source: "n1", target: "n2", label: "next" },
    { id: "e2", source: "n2", target: "n3", label: "next" },
  ];

  const sampleGlobals = [
    { id: "g1", key: "API_VERSION", value: "v2" },
    { id: "g2", key: "ENV_NAME", value: "production" },
  ];

  const sampleSecrets = [
    { id: "s1", key: "API_KEY", value: "sk-test123456" },
  ];

  it("should interpolate global variables and secrets in runFlow runtime execution", async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
        } as any,
        json: () => Promise.resolve({ success: true }),
      } as any)
    );
    globalThis.fetch = mockFetch;

    await runFlow({
      nodes,
      edges,
      gateways: [],
      initialState: { query: "search-query" },
      globals: sampleGlobals,
      secrets: sampleSecrets,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0];

    // Verify correct URL interpolation
    expect(calledUrl).toBe("https://api.example.com/v1/v2/data");

    // Verify correct headers interpolation
    expect(calledOptions.method).toBe("POST");
    expect(calledOptions.headers).toEqual({
      Authorization: "Bearer sk-test123456",
      "Content-Type": "application/json",
    });

    // Verify correct body interpolation
    expect(calledOptions.body).toBe('{"query": "search-query", "env": "production"}');

    globalThis.fetch = originalFetch;
  });

  it("should generate Python code containing GLOBALS and SECRETS declarations", () => {
    const pyResult = generatePython(nodes, edges, sampleGlobals, sampleSecrets);

    expect(pyResult.errors).toEqual([]);
    expect(pyResult.code).toContain('GLOBALS = {\n    "API_VERSION": "v2",\n    "ENV_NAME": "production"\n}');
    expect(pyResult.code).toContain('SECRETS = {\n    "API_KEY": "sk-test123456"\n}');
    expect(pyResult.code).toContain("interpolate(");
  });

  it("should generate JavaScript code containing GLOBALS and SECRETS declarations", () => {
    const jsResult = generateJavaScript(nodes, edges, sampleGlobals, sampleSecrets);

    expect(jsResult.errors).toEqual([]);
    expect(jsResult.code).toContain('const GLOBALS = {\n  "API_VERSION": "v2",\n  "ENV_NAME": "production"\n};');
    expect(jsResult.code).toContain('const SECRETS = {\n  "API_KEY": "sk-test123456"\n};');
    expect(jsResult.code).toContain("interpolate(");
  });

  describe("GlobalsManager Advanced Features", () => {
    const TestGlobalsWrapper = ({
      initialGlobals = [
        { id: "g1", key: "VAR_ONE", value: "hello" },
        { id: "g2", key: "VAR_TWO", value: "world" },
      ],
      initialSecrets = [
        { id: "s1", key: "SECRET_ONE", value: "supersecret" },
      ],
    }: any) => {
      const [globals, setGlobals] = useState(initialGlobals);
      const [secrets, setSecrets] = useState(initialSecrets);

      return React.createElement(GlobalsManager, {
        globals,
        secrets,
        onGlobalsChange: setGlobals,
        onSecretsChange: setSecrets,
        onClose: vi.fn(),
      });
    };

    it("should filter globals and secrets in the sidebar based on search query", () => {
      render(React.createElement(TestGlobalsWrapper));

      // Initially, we should see VAR_ONE, VAR_TWO, and SECRET_ONE
      expect(screen.getByText("VAR_ONE")).toBeInTheDocument();
      expect(screen.getByText("VAR_TWO")).toBeInTheDocument();
      expect(screen.getByText("SECRET_ONE")).toBeInTheDocument();

      // Type "ONE" in the search box
      const searchInput = screen.getByPlaceholderText("search variables…");
      fireEvent.change(searchInput, { target: { value: "ONE" } });

      // Now we should see VAR_ONE and SECRET_ONE, but NOT VAR_TWO
      expect(screen.getByText("VAR_ONE")).toBeInTheDocument();
      expect(screen.getByText("SECRET_ONE")).toBeInTheDocument();
      expect(screen.queryByText("VAR_TWO")).not.toBeInTheDocument();
    });

    it("should support bulk clearing globals and secrets", () => {
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      const confirmSpy = vi.spyOn(window, "confirm").mockImplementation(() => true);

      render(React.createElement(TestGlobalsWrapper));

      // Initially we have globals
      expect(screen.getByText("VAR_ONE")).toBeInTheDocument();

      // Click clear all globals
      const clearGlobalsBtn = screen.getByText("Clear All Globals");
      fireEvent.click(clearGlobalsBtn);

      expect(confirmSpy).toHaveBeenCalled();
      // VAR_ONE and VAR_TWO should be removed
      expect(screen.queryByText("VAR_ONE")).not.toBeInTheDocument();
      expect(screen.queryByText("VAR_TWO")).not.toBeInTheDocument();
      // SECRET_ONE should still exist
      expect(screen.getByText("SECRET_ONE")).toBeInTheDocument();

      confirmSpy.mockRestore();
      alertSpy.mockRestore();
    });

    it("should support environment export to clipboard", () => {
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      const writeTextMock = vi.fn().mockImplementation(() => Promise.resolve());
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
      });

      render(React.createElement(TestGlobalsWrapper, { initialGlobals: [], initialSecrets: [] }));

      // When items are empty, the main area shows "Export Environment"
      const exportBtn = screen.getByText("Export Environment (Copy JSON)");
      fireEvent.click(exportBtn);

      expect(writeTextMock).toHaveBeenCalled();
      const exportedData = JSON.parse(writeTextMock.mock.calls[0][0]);
      expect(exportedData).toHaveProperty("globals");
      expect(exportedData).toHaveProperty("secrets");

      alertSpy.mockRestore();
    });

    it("should support environment import (merge and replace) with full validation", () => {
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      const confirmSpy = vi.spyOn(window, "confirm").mockImplementation(() => true);

      render(React.createElement(TestGlobalsWrapper, { initialGlobals: [], initialSecrets: [] }));

      const importTextarea = screen.getByPlaceholderText(/Paste environment JSON here/);
      const mergeBtn = screen.getByText("Merge Import");

      // 1. Invalid JSON validation
      fireEvent.change(importTextarea, { target: { value: "{ invalid json" } });
      fireEvent.click(mergeBtn);
      expect(screen.getByText(/Expected property name/)).toBeInTheDocument();

      // 2. Successful merge import
      const validJSON = JSON.stringify({
        globals: [{ key: "IMPORTED_GLOBAL", value: "123" }],
        secrets: [{ key: "IMPORTED_SECRET", value: "abc" }],
      });
      fireEvent.change(importTextarea, { target: { value: validJSON } });
      fireEvent.click(mergeBtn);

      expect(alertSpy).toHaveBeenCalledWith("Environment successfully imported!");
      expect(screen.getByText("IMPORTED_GLOBAL")).toBeInTheDocument();
      expect(screen.getByText("IMPORTED_SECRET")).toBeInTheDocument();

      confirmSpy.mockRestore();
      alertSpy.mockRestore();
    });
  });
});
