import { RunLog } from "./runFlow";

export interface ExecutionRunRecord {
  id: string;
  workflowId: string | null;
  timestamp: number;
  durationMs: number;
  status: "pass" | "error";
  stepCount: number;
  initialState: Record<string, unknown>;
  finalOutput: unknown;
  logs: RunLog[];
}

const STORAGE_PREFIX = "agent_flow.run_history.v1.";

export function getStorageKey(workflowId: string | null): string {
  return `${STORAGE_PREFIX}${workflowId || "default"}`;
}

export function loadRunHistory(workflowId: string | null): ExecutionRunRecord[] {
  try {
    const raw = localStorage.getItem(getStorageKey(workflowId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRunHistory(
  workflowId: string | null,
  history: ExecutionRunRecord[]
): void {
  try {
    localStorage.setItem(getStorageKey(workflowId), JSON.stringify(history));
  } catch {
    // Ignore localStorage storage overflow or error
  }
}

export function addRunToHistory(
  workflowId: string | null,
  run: ExecutionRunRecord,
  maxRecords = 15
): ExecutionRunRecord[] {
  const current = loadRunHistory(workflowId);
  const updated = [run, ...current].slice(0, maxRecords);
  saveRunHistory(workflowId, updated);
  return updated;
}

export function clearRunHistory(workflowId: string | null): void {
  try {
    localStorage.removeItem(getStorageKey(workflowId));
  } catch {
    // Ignore
  }
}

export function cryptoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "run-" + Math.random().toString(36).substring(2, 10);
}
