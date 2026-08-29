import type { RunLog } from "./runFlow";

export interface RunHistoryRecord {
  id: string;
  workflowId: string | null;
  workflowName: string;
  timestamp: number;
  durationMs: number;
  stepCount: number;
  status: "success" | "error";
  logs: RunLog[];
  initialState: Record<string, unknown>;
}

export const RUN_HISTORY_PREFIX = "agent_flow.run_history.v1";

export function getHistoryStorageKey(workflowId: string | null): string {
  const safeId = workflowId ? workflowId : "default";
  return `${RUN_HISTORY_PREFIX}.${safeId}`;
}

export function loadRunHistory(workflowId: string | null): RunHistoryRecord[] {
  try {
    const key = getHistoryStorageKey(workflowId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export function saveRunRecord(record: RunHistoryRecord): RunHistoryRecord[] {
  try {
    const history = loadRunHistory(record.workflowId);
    const updated = [record, ...history].slice(0, 20);
    const key = getHistoryStorageKey(record.workflowId);
    localStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearRunHistory(workflowId: string | null): void {
  try {
    const key = getHistoryStorageKey(workflowId);
    localStorage.removeItem(key);
  } catch {}
}
