import type { Gateway } from "../gateways";
import type { ChatRequest, ChatResponse } from "./index";

export async function callOllama(gw: Gateway, req: ChatRequest): Promise<ChatResponse> {
  const url = `${gw.baseUrl.replace(/\/$/, "")}/api/chat`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(gw.extraHeaders ?? {}),
  };
  const body = {
    model: req.model,
    messages: req.messages,
    stream: false,
    options: {
      temperature: req.temperature,
      num_predict: req.maxTokens,
    },
  };
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Ollama ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  const text = data?.message?.content ?? data?.response ?? "";
  return { text: String(text), raw: data };
}
