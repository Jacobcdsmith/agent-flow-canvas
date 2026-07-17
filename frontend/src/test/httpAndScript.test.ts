import { describe, it, expect, vi } from "vitest";
import { runFlow } from "../flow/runFlow";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";

describe("runFlow with script and http nodes", () => {
  it("should execute JS Script nodes and modify state and outputs", async () => {
    const nodes: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "trigger",
          name: "on_request",
          config: { source: "manual", schema: "" },
          isEntry: true,
        },
      },
      {
        id: "n2",
        type: "agent",
        position: { x: 100, y: 100 },
        data: {
          kind: "script",
          name: "uppercase_query",
          config: {
            code: "state.query = state.query.toUpperCase();\nstate.customVal = 123;\nreturn { done: true, uppercase: state.query };",
          },
        },
      },
      {
        id: "n3",
        type: "agent",
        position: { x: 200, y: 200 },
        data: {
          kind: "sink",
          name: "return_result",
          config: { target: "response" },
          isTerminal: true,
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", label: "next" },
      { id: "e2", source: "n2", target: "n3", label: "next" },
    ];

    const logs: any[] = [];
    const result = await runFlow({
      nodes,
      edges,
      gateways: [],
      initialState: { query: "hello script world" },
      onLog: (log) => logs.push(log),
    });

    expect(logs.length).toBe(3);

    // Check JS Script execution output
    const scriptLog = logs.find((l) => l.nodeId === "n2");
    expect(scriptLog).toBeDefined();
    expect(scriptLog.output).toEqual({ done: true, uppercase: "HELLO SCRIPT WORLD" });

    // Check terminal sink output (which returns last_output, which should be the script output)
    const sinkLog = logs.find((l) => l.nodeId === "n3");
    expect(sinkLog).toBeDefined();
    expect(sinkLog.output).toEqual({
      target: "response",
      result: { done: true, uppercase: "HELLO SCRIPT WORLD" },
    });

    // Verify stateSnapshot has been captured for each node
    expect(logs[0].stateSnapshot).toBeDefined();
    expect(logs[1].stateSnapshot).toBeDefined();
    expect(logs[2].stateSnapshot).toBeDefined();

    // The script should have modified the state at n2 and n3
    expect(logs[0].stateSnapshot.query).toBe("hello script world"); // trigger didn't modify query
    expect(logs[1].stateSnapshot.query).toBe("HELLO SCRIPT WORLD"); // script modified state.query
    expect(logs[1].stateSnapshot.customVal).toBe(123); // script set customVal
    expect(logs[2].stateSnapshot.query).toBe("HELLO SCRIPT WORLD"); // sink retains state
  });

  it("should execute HTTP Request nodes with mocked fetch", async () => {
    // Mock global fetch manually to support older Vitest environments
    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
        } as any,
        json: () => Promise.resolve({ success: true, message: "Hello from mock API!" }),
      } as any)
    );
    globalThis.fetch = mockFetch;

    const nodes: Node<AgentNodeData>[] = [
      {
        id: "n1",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          kind: "trigger",
          name: "on_request",
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
            url: "https://api.example.com/data/{{state.userId}}",
            method: "POST",
            headers: '{"Authorization": "Bearer token123"}',
            body: '{"query": "{{query}}"}',
          },
        },
      },
      {
        id: "n3",
        type: "agent",
        position: { x: 200, y: 200 },
        data: {
          kind: "sink",
          name: "return_result",
          config: { target: "response" },
          isTerminal: true,
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", label: "next" },
      { id: "e2", source: "n2", target: "n3", label: "next" },
    ];

    const logs: any[] = [];
    await runFlow({
      nodes,
      edges,
      gateways: [],
      initialState: { query: "search-query", userId: "user-456" },
      onLog: (log) => logs.push(log),
    });

    // Check fetch mock calls
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0];

    // Check interpolation in URL
    expect(calledUrl).toBe("https://api.example.com/data/user-456");

    // Check method and headers
    expect(calledOptions.method).toBe("POST");
    expect(calledOptions.headers).toEqual({ Authorization: "Bearer token123" });

    // Check interpolation in body
    expect(calledOptions.body).toBe('{"query": "search-query"}');

    // Check HTTP output
    const httpLog = logs.find((l) => l.nodeId === "n2");
    expect(httpLog).toBeDefined();
    expect(httpLog.output).toEqual({
      status: 200,
      statusText: "OK",
      data: { success: true, message: "Hello from mock API!" },
    });

    // Verify stateSnapshot captured
    expect(logs[1].stateSnapshot).toBeDefined();
    expect(logs[1].stateSnapshot.query).toBe("search-query");
    expect(logs[1].stateSnapshot.userId).toBe("user-456");

    // Restore global fetch
    globalThis.fetch = originalFetch;
  });
});
