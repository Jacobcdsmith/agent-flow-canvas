import { describe, it, expect } from "vitest";
import { generatePython, generateJavaScript, lintPython } from "../flow/codegen";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";

describe("Code Generation for HTTP and Script Nodes", () => {
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
        name: "get_user",
        config: {
          url: "https://api.github.com/users/{{state.username}}",
          method: "GET",
          headers: '{"Content-Type": "application/json"}',
        },
      },
    },
    {
      id: "n3",
      type: "agent",
      position: { x: 200, y: 200 },
      data: {
        kind: "script",
        name: "format_response",
        config: {
          code: "state.username = state.last_output.data.login.toUpperCase();\nreturn state;",
        },
      },
    },
    {
      id: "n4",
      type: "agent",
      position: { x: 300, y: 300 },
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
    { id: "e3", source: "n3", target: "n4", label: "next" },
  ];

  it("should generate syntactically valid Python code with urllib.request", () => {
    const pyResult = generatePython(nodes, edges);

    // Check that we have no errors during code generation
    expect(pyResult.errors).toEqual([]);

    // Check key requirements in generated code
    expect(pyResult.code).toContain("urllib.request");
    expect(pyResult.code).toContain("call_http");
    expect(pyResult.code).toContain("run_js_script");
    expect(pyResult.code).toContain("url.replace");

    // Run syntax/bracket linter
    const lintIssues = lintPython(pyResult.code);
    expect(lintIssues).toEqual([]);
  });

  it("should generate valid JavaScript code with fetch", () => {
    const jsResult = generateJavaScript(nodes, edges);

    // Check no errors
    expect(jsResult.errors).toEqual([]);

    // Check key requirements in JS code
    expect(jsResult.code).toContain("callHttp");
    expect(jsResult.code).toContain("runJsScript");
    expect(jsResult.code).toContain("fetch(url");
    expect(jsResult.code).toContain("JSON.parse");
  });
});
