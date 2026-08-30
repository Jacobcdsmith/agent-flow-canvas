import { RunLog } from "./runFlow";

export interface RunRecord {
  id: string;
  workflowId: string | null;
  timestamp: number;
  logs: RunLog[];
  durationMs: number;
  stepCount: number;
  hasError: boolean;
  finalOutput: unknown;
}

const RUN_HISTORY_PREFIX = "agent_flow.run_history.v1.";

export function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "run_" + Math.random().toString(36).slice(2, 10);
}

function getStorageKey(workflowId: string | null): string {
  const targetId = workflowId || "default";
  return `${RUN_HISTORY_PREFIX}${targetId}`;
}

/**
 * Loads the execution run history for a given workflow ID.
 */
export function loadRunHistory(workflowId: string | null): RunRecord[] {
  try {
    const storageKey = getStorageKey(workflowId);
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Failed to load run history:", e);
  }
  return [];
}

/**
 * Saves a new execution run record to localStorage. Keeps up to 20 recent runs per workflow.
 */
export function saveRunRecord(workflowId: string | null, logs: RunLog[]): RunRecord {
  const durationMs = logs.reduce((acc, l) => acc + l.ms, 0);
  const stepCount = logs.length;
  const hasError = logs.some((l) => !!l.error);
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const finalOutput = lastLog ? (lastLog.error ? lastLog.error : lastLog.output) : null;

  const record: RunRecord = {
    id: cryptoId(),
    workflowId,
    timestamp: Date.now(),
    logs,
    durationMs,
    stepCount,
    hasError,
    finalOutput,
  };

  try {
    const existing = loadRunHistory(workflowId);
    const updated = [record, ...existing].slice(0, 20); // Keep top 20 latest
    const storageKey = getStorageKey(workflowId);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save run record:", e);
  }

  return record;
}

/**
 * Deletes a single execution run record by id.
 */
export function deleteRunRecord(workflowId: string | null, runId: string): void {
  try {
    const existing = loadRunHistory(workflowId);
    const updated = existing.filter((r) => r.id !== runId);
    const storageKey = getStorageKey(workflowId);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to delete run record:", e);
  }
}

/**
 * Clears all execution run history for a workflow.
 */
export function clearRunHistory(workflowId: string | null): void {
  try {
    const storageKey = getStorageKey(workflowId);
    localStorage.removeItem(storageKey);
  } catch (e) {
    console.error("Failed to clear run history:", e);
  }
}
