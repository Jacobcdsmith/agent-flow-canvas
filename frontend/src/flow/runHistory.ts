import { RunLog } from "./runFlow";

export interface ExecutionRunRecord {
  id: string;
  workflowId: string;
  timestamp: number;
  status: "pass" | "error";
  totalMs: number;
  stepCount: number;
  initialState?: Record<string, unknown>;
  finalOutput?: unknown;
  logs: RunLog[];
}

const RUN_HISTORY_PREFIX = "agent_flow.run_history.v1.";

export function getRunHistoryStorageKey(workflowId: string | null): string {
  return `${RUN_HISTORY_PREFIX}${workflowId || "default"}`;
}

/**
 * Load execution run history for a specified workflow ID from localStorage.
 */
export function loadRunHistory(workflowId: string | null): ExecutionRunRecord[] {
  try {
    const key = getRunHistoryStorageKey(workflowId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to load run history from localStorage:", err);
    return [];
  }
}

/**
 * Save a new execution run record to the workflow's run history.
 * Keeps up to maxRecords (default 25) most recent runs.
 */
export function saveRunRecord(
  workflowId: string | null,
  record: Omit<ExecutionRunRecord, "id" | "workflowId">,
  maxRecords = 25
): ExecutionRunRecord {
  const existing = loadRunHistory(workflowId);
  const newRecord: ExecutionRunRecord = {
    ...record,
    id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    workflowId: workflowId || "default",
  };

  const updated = [newRecord, ...existing].slice(0, maxRecords);

  try {
    const key = getRunHistoryStorageKey(workflowId);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save run record to localStorage:", err);
  }

  return newRecord;
}

/**
 * Delete a specific run record by ID.
 */
export function deleteRunRecord(workflowId: string | null, runId: string): ExecutionRunRecord[] {
  const existing = loadRunHistory(workflowId);
  const updated = existing.filter((r) => r.id !== runId);

  try {
    const key = getRunHistoryStorageKey(workflowId);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to delete run record from localStorage:", err);
  }

  return updated;
}

/**
 * Clear all run history for a specified workflow ID.
 */
export function clearRunHistory(workflowId: string | null): void {
  try {
    const key = getRunHistoryStorageKey(workflowId);
    localStorage.removeItem(key);
  } catch (err) {
    console.error("Failed to clear run history from localStorage:", err);
  }
}
