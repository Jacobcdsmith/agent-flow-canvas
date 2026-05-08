import type { Gateway } from "../gateways";
import type { ChatRequest, ChatResponse } from "./index";

export async function callGemini(gw: Gateway, req: ChatRequest): Promise<ChatResponse> {
  const base = gw.baseUrl.replace(/\/$/, "");
  const url = `${base}/v1beta/models/${encodeURIComponent(req.model)}:generateContent${
    gw.apiKey ? `?key=${encodeURIComponent(gw.apiKey)}` : ""
  }`;

  const systemText = req.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = {
    contents: contents.length > 0 ? contents : [{ role: "user", parts: [{ text: "hello" }] }],
    generationConfig: {
      temperature: req.temperature,
      maxOutputTokens: req.maxTokens,
    },
  };
  if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] };
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(gw.extraHeaders ?? {}),
  };

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p: { text?: string }) => (typeof p.text === "string" ? p.text : ""))
    .join("");
  return { text, raw: data };
}
