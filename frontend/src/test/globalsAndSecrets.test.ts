import { describe, it, expect, vi } from "vitest";
import { validateKeyName } from "../flow/globals";
import { runFlow } from "../flow/runFlow";
import { generateCode } from "../flow/codegen";
import { Node, Edge } from "reactflow";
import { AgentNodeData } from "../flow/types";

describe("Global Variables and Secrets", () => {
  describe("Key Name Validation", () => {
    it("should reject empty names", () => {
      expect(validateKeyName("", [], "1")).toBe("Key name is required");
      expect(validateKeyName("   ", [], "1")).toBe("Key name is required");
    });

    it("should reject invalid variable names", () => {
      expect(validateKeyName("my-key", [], "1")).toContain("Must be a valid variable name");
      expect(validateKeyName("my key", [], "1")).toContain("Must be a valid variable name");
      expect(validateKeyName("1key", [], "1")).toContain("Must be a valid variable name");
      expect(validateKeyName("key!", [], "1")).toContain("Must be a valid variable name");
    });

    it("should reject duplicates regardless of case", () => {
      expect(validateKeyName("API_KEY", ["api_key"], "2")).toBe("Key name must be unique");
      expect(validateKeyName("API_KEY", ["API_KEY"], "2")).toBe("Key name must be unique");
    });

    it("should accept valid unique variable names", () => {
      expect(validateKeyName("API_KEY", ["OTHER_KEY"], "2")).toBeNull();
      expect(validateKeyName("api_key_2", [], "1")).toBeNull();
      expect(validateKeyName("_my_var", [], "1")).toBeNull();
    });
  });

  describe("runFlow with interpolated globals and secrets", () => {
    it("should substitute globals and secrets in LLM prompts, tool arguments, and HTTP requests", async () => {
      // Mock global fetch manually to assert headers/url substitution
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
            name: "http_request",
            config: {
              url: "https://{{global.BASE_URL}}/v1/query?sec={{secret.SECRET_TOKEN}}",
              method: "POST",
              headers: '{"X-Global-Header": "{{global.HEADER_VAL}}"}',
              body: '{"query": "{{query}}", "auth": "{{secret.SECRET_TOKEN}}"}',
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
            config: { target: "response" },
            isTerminal: true,
          },
        },
      ];

      const edges: Edge[] = [
        { id: "e1", source: "n1", target: "n2", label: "next" },
        { id: "e2", source: "n2", target: "n3", label: "next" },
      ];

      const globals = [
        { id: "g1", key: "BASE_URL", value: "api.custom.com" },
        { id: "g2", key: "HEADER_VAL", value: "CustomGlobalValue" },
      ];

      const secrets = [
        { id: "s1", key: "SECRET_TOKEN", value: "secret-token-12345" },
      ];

      const logs: any[] = [];
      await runFlow({
        nodes,
        edges,
        gateways: [],
        initialState: { query: "my-query" },
        globals,
        secrets,
        onLog: (log) => logs.push(log),
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];

      // Verify substitutions in URL, headers, and body
      expect(calledUrl).toBe("https://api.custom.com/v1/query?sec=secret-token-12345");
      expect(calledOptions.method).toBe("POST");
      expect(calledOptions.headers).toEqual({ "X-Global-Header": "CustomGlobalValue" });
      expect(calledOptions.body).toBe('{"query": "my-query", "auth": "secret-token-12345"}');

      // Restore global fetch
      globalThis.fetch = originalFetch;
    });
  });

  describe("Code Generation output with Globals & Secrets", () => {
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
          kind: "llm",
          name: "llm_node",
          config: {
            prompt: "Using global: {{global.BASE_URL}} and secret: {{secret.SECRET_TOKEN}}",
            model: "gpt-4o-mini",
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
          config: { target: "response" },
          isTerminal: true,
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", label: "next" },
      { id: "e2", source: "n2", target: "n3", label: "next" },
    ];

    const globals = [
      { id: "g1", key: "BASE_URL", value: "api.custom.com" },
    ];

    const secrets = [
      { id: "s1", key: "SECRET_TOKEN", value: "secret-token-12345" },
    ];

    it("should generate Python code with GLOBALS and SECRETS mappings", () => {
      const res = generateCode("python", nodes, edges, globals, secrets);
      expect(res.code).toContain("GLOBALS = {");
      expect(res.code).toContain('"BASE_URL": "api.custom.com"');
      expect(res.code).toContain("SECRETS = {");
      expect(res.code).toContain('os.environ.get("SECRET_TOKEN", "secret-token-12345")');
      expect(res.code).toContain('prompt_text = prompt_text.replace(f"{{{{global.{k}}}}}"');
      expect(res.code).toContain('prompt_text = prompt_text.replace(f"{{{{secret.{k}}}}}"');
    });

    it("should generate JavaScript code with GLOBALS and SECRETS mappings", () => {
      const res = generateCode("javascript", nodes, edges, globals, secrets);
      expect(res.code).toContain("const GLOBALS = {");
      expect(res.code).toContain('"BASE_URL": "api.custom.com"');
      expect(res.code).toContain("const SECRETS = {");
      expect(res.code).toContain('process.env.SECRET_TOKEN ?? "secret-token-12345"');
      expect(res.code).toContain("promptText.replace");
    });
  });
});
