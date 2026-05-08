import type { Gateway } from "../gateways";
import { callOpenAI } from "./openai";
import { callAnthropic } from "./anthropic";
import { callGemini } from "./gemini";
import { callOllama } from "./ollama";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  temperature: number;
  maxTokens: number;
  messages: ChatMessage[];
}

export interface ChatResponse {
  text: string;
  raw?: unknown;
}

export async function callLLM(gateway: Gateway, req: ChatRequest): Promise<ChatResponse> {
  switch (gateway.provider) {
    case "openai":
    case "openai-compatible":
      return callOpenAI(gateway, req);
    case "anthropic":
      return callAnthropic(gateway, req);
    case "gemini":
      return callGemini(gateway, req);
    case "ollama":
      return callOllama(gateway, req);
    default:
      throw new Error(`Unsupported provider: ${gateway.provider}`);
  }
}
