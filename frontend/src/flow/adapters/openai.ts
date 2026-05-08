import type { Gateway } from "../gateways";
import type { ChatRequest, ChatResponse } from "./index";

export async function callOpenAI(gw: Gateway, req: ChatRequest): Promise<ChatResponse> {
  const url = `${gw.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(gw.extraHeaders ?? {}),
  };
  if (gw.apiKey) headers["authorization"] = `Bearer ${gw.apiKey}`;
  const body = {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature,
    max_tokens: req.maxTokens,
  };
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  const text =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    "";
  return { text: String(text), raw: data };
}
