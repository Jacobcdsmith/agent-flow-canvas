import { RunLog } from "./runFlow";

export interface RunRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  timestamp: number;
  durationMs: number;
  stepCount: number;
  hasError: boolean;
  initialState: Record<string, unknown>;
  finalState?: Record<string, unknown>;
  logs: RunLog[];
}

const STORAGE_PREFIX = "agent_flow.run_history.v1.";

export function getStorageKey(workflowId: string | null): string {
  return `${STORAGE_PREFIX}${workflowId || "default"}`;
}

export function loadRunHistory(workflowId: string | null): RunRecord[] {
  try {
    const raw = localStorage.getItem(getStorageKey(workflowId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRunRecord(
  workflowId: string | null,
  record: RunRecord
): RunRecord[] {
  try {
    const existing = loadRunHistory(workflowId);
    // Prepend new record, avoid duplicates
    const filtered = existing.filter((r) => r.id !== record.id);
    const updated = [record, ...filtered].slice(0, 25); // retain last 25 runs
    localStorage.setItem(getStorageKey(workflowId), JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error("Failed to save run record", e);
    return [];
  }
}

export function clearRunHistory(workflowId: string | null): void {
  try {
    localStorage.removeItem(getStorageKey(workflowId));
  } catch (e) {
    console.error("Failed to clear run history", e);
  }
}

export function deleteRunRecord(
  workflowId: string | null,
  recordId: string
): RunRecord[] {
  try {
    const existing = loadRunHistory(workflowId);
    const updated = existing.filter((r) => r.id !== recordId);
    localStorage.setItem(getStorageKey(workflowId), JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error("Failed to delete run record", e);
    return [];
  }
}
