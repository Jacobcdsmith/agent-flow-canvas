import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { runFlow } from "../flow/runFlow";
import { generateCode } from "../flow/codegen";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";

// Setup global mock for fetch to simulate HTTP Node requests
const originalFetch = global.fetch;

beforeAll(() => {
  global.fetch = vi.fn().mockImplementation((url, options) => {
    if (url.includes("success-endpoint")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ status: "ok", data: "success response payload" })),
        headers: new Headers({ "content-type": "application/json" }),
      });
    }
    if (url.includes("error-endpoint")) {
      return Promise.resolve({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request"),
        headers: new Headers(),
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve("raw text fallback"),
      headers: new Headers(),
    });
  });
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("runFlow with HTTP Request node execution", () => {
  it("should successfully call the mocked HTTP endpoint and update state with output", async () => {
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
          name: "web_request",
          config: {
            method: "POST",
            url: "https://api.test.com/success-endpoint",
            headers: '{"Authorization": "Bearer abc"}',
            body: '{"query": "{{state.query}}"}',
          },
        },
      },
      {
        id: "n3",
        type: "agent",
        position: { x: 200, y: 200 },
        data: {
          kind: "sink",
          name: "end",
          config: {},
          isTerminal: true,
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", label: "next" },
      { id: "e2", source: "n2", target: "n3", label: "on_success" },
    ];

    const logs: any[] = [];
    const result = await runFlow({
      nodes,
      edges,
      gateways: [],
      initialState: { query: "search keyword" },
      onLog: (log) => logs.push(log),
    });

    // Check HTTP request executed successfully
    expect(logs.length).toBe(3);
    expect(logs[1].nodeId).toBe("n2");
    expect(logs[1].error).toBeUndefined();
    expect(logs[1].output).toEqual({
      status: 200,
      headers: { "content-type": "application/json" },
      body: { status: "ok", data: "success response payload" },
    });

    // Cumulative State Snapshots check
    expect(logs[1].stateSnapshot).toBeDefined();
    expect(logs[1].stateSnapshot?.last_output).toEqual({
      status: 200,
      headers: { "content-type": "application/json" },
      body: { status: "ok", data: "success response payload" },
    });
  });

  it("should fail gracefully and execute on_error edge when HTTP endpoint fails", async () => {
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
          name: "web_request_failed",
          config: {
            method: "GET",
            url: "https://api.test.com/error-endpoint",
          },
        },
      },
      {
        id: "n3",
        type: "agent",
        position: { x: 200, y: 200 },
        data: {
          kind: "sink",
          name: "error_handler",
          config: {},
          isTerminal: true,
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", label: "next" },
      { id: "e2", source: "n2", target: "n3", label: "on_error" },
    ];

    const logs: any[] = [];
    await runFlow({
      nodes,
      edges,
      gateways: [],
      onLog: (log) => logs.push(log),
    });

    expect(logs.length).toBe(3);
    expect(logs[1].nodeId).toBe("n2");
    expect(logs[1].error).toContain("HTTP 400: Bad Request");
  });
});

describe("runFlow with JS Script node execution", () => {
  it("should execute JS Snippet and evaluate state mutation with router labels", async () => {
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
          kind: "script",
          name: "run_code",
          config: {
            code: "state.computedValue = 120;\nreturn 'custom_path';",
          },
        },
      },
      {
        id: "n3",
        type: "agent",
        position: { x: 200, y: 200 },
        data: {
          kind: "sink",
          name: "branch_chosen",
          config: {},
          isTerminal: true,
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", label: "next" },
      { id: "e2", source: "n2", target: "n3", label: "custom_path" },
    ];

    const logs: any[] = [];
    await runFlow({
      nodes,
      edges,
      gateways: [],
      initialState: { some_input: 42 },
      onLog: (log) => logs.push(log),
    });

    expect(logs.length).toBe(3);
    expect(logs[1].nodeId).toBe("n2");
    expect(logs[1].error).toBeUndefined();

    // Verify script returned the custom branch label properly
    expect(logs[1].output).toEqual({ returned: "custom_path", success: true });

    // Verify deep cloned state snapshots persisted computed value
    expect(logs[1].stateSnapshot?.computedValue).toBe(120);
    expect(logs[1].stateSnapshot?.some_input).toBe(42);
  });
});

describe("generateCode with http and script nodes", () => {
  it("should correctly serialize code block for python and javascript", () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "http",
          name: "my_req",
          config: {
            method: "POST",
            url: "https://api.com/v1/test",
            headers: '{"key": "value"}',
            body: "some body",
          },
        },
      },
      {
        id: "n2",
        type: "agent",
        position: { x: 100, y: 100 },
        data: {
          kind: "script",
          name: "my_script",
          config: {
            code: "state.val = 10;\nreturn 'ok';",
          },
        },
      },
    ];

    const pythonResult = generateCode("python", nodes, []);
    const jsResult = generateCode("javascript", nodes, []);

    expect(pythonResult.code).toContain("make_http_request");
    expect(pythonResult.code).toContain("urllib.request");
    expect(pythonResult.code).toContain("my_req");
    expect(pythonResult.code).toContain("my_script");

    expect(jsResult.code).toContain("makeHttpRequest");
    expect(jsResult.code).toContain("my_req");
    expect(jsResult.code).toContain("my_script");
    expect(jsResult.code).toContain("state.val = 10");
  });
});
