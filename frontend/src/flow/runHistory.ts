import type { RunLog } from "./runFlow";

export interface RunRecord {
  id: string;
  workflowId: string;
  timestamp: number;
  status: "pass" | "error";
  durationMs: number;
  stepCount: number;
  initialState?: Record<string, unknown>;
  logs: RunLog[];
  finalOutput?: unknown;
}

const RUN_HISTORY_PREFIX = "agent_flow.run_history.v1";
const MAX_RUN_HISTORY = 20;

/**
 * Loads the list of past workflow execution runs from localStorage for a given workflow ID.
 * Defaults to "default" if workflowId is null or empty.
 *
 * @param workflowId The active workflow ID.
 * @returns Array of RunRecord items sorted newest first.
 */
export function loadRunHistory(workflowId: string | null): RunRecord[] {
  const id = workflowId || "default";
  try {
    const raw = localStorage.getItem(`${RUN_HISTORY_PREFIX}.${id}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load run history:", e);
  }
  return [];
}

/**
 * Persists a new execution run record to localStorage for a given workflow ID.
 * Enforces a maximum capacity limit of 20 runs per workflow.
 *
 * @param workflowId The active workflow ID.
 * @param record The run record object to save.
 * @returns The saved RunRecord with guaranteed ID.
 */
export function saveRunRecord(
  workflowId: string | null,
  record: Omit<RunRecord, "id"> & { id?: string }
): RunRecord {
  const idKey = workflowId || "default";
  const existing = loadRunHistory(workflowId);

  const fullRecord: RunRecord = {
    ...record,
    id: record.id || `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };

  // Prepend newest run to front
  const updated = [fullRecord, ...existing.filter((r) => r.id !== fullRecord.id)].slice(0, MAX_RUN_HISTORY);

  try {
    localStorage.setItem(`${RUN_HISTORY_PREFIX}.${idKey}`, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save run record:", e);
  }

  return fullRecord;
}

/**
 * Deletes a single execution run record by ID for a given workflow ID.
 *
 * @param workflowId The active workflow ID.
 * @param recordId The unique ID of the run record to delete.
 */
export function deleteRunRecord(workflowId: string | null, recordId: string): void {
  const idKey = workflowId || "default";
  const existing = loadRunHistory(workflowId);
  const updated = existing.filter((r) => r.id !== recordId);

  try {
    localStorage.setItem(`${RUN_HISTORY_PREFIX}.${idKey}`, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to delete run record:", e);
  }
}

/**
 * Clears all execution run records for a given workflow ID.
 *
 * @param workflowId The active workflow ID.
 */
export function clearRunHistory(workflowId: string | null): void {
  const idKey = workflowId || "default";
  try {
    localStorage.removeItem(`${RUN_HISTORY_PREFIX}.${idKey}`);
  } catch (e) {
    console.error("Failed to clear run history:", e);
  }
}
