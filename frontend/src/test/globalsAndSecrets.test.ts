import { describe, it, expect, vi } from "vitest";
import { runFlow } from "../flow/runFlow";
import { generatePython, generateJavaScript } from "../flow/codegen";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";

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
});
