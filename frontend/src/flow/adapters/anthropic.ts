import type { Gateway } from "../gateways";
import type { ChatRequest, ChatResponse } from "./index";

export async function callAnthropic(gw: Gateway, req: ChatRequest): Promise<ChatResponse> {
  const url = `${gw.baseUrl.replace(/\/$/, "")}/v1/messages`;
  // separate system message from user/assistant turns
  const system = req.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const messages = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
    ...(gw.extraHeaders ?? {}),
  };
  if (gw.apiKey) headers["x-api-key"] = gw.apiKey;

  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    messages: messages.length > 0 ? messages : [{ role: "user", content: "hello" }],
  };
  if (system) body.system = system;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  const text =
    Array.isArray(data?.content)
      ? data.content
          .filter((c: { type: string }) => c.type === "text")
          .map((c: { text: string }) => c.text)
          .join("")
      : "";
  return { text, raw: data };
}
