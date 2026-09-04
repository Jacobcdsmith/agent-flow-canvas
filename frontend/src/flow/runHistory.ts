import { RunLog } from "./runFlow";

export interface WorkflowRun {
  id: string;
  workflowId: string;
  runAt: number;
  durationMs: number;
  stepCount: number;
  status: "pass" | "error";
  logs: RunLog[];
  initialState?: Record<string, unknown>;
}

const STORAGE_KEY_PREFIX = "agent_flow.run_history.v1.";

/**
 * Persists an execution run record into local storage for the specified workflow.
 * Maintains up to 15 most recent execution runs.
 */
export function saveRunRecord(
  workflowId: string | null,
  runLogs: RunLog[],
  initialState?: Record<string, unknown>
): WorkflowRun {
  const key = `${STORAGE_KEY_PREFIX}${workflowId || "default"}`;
  const totalMs = runLogs.reduce((acc, l) => acc + l.ms, 0);
  const hasError = runLogs.some((l) => l.error);

  const newRun: WorkflowRun = {
    id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    workflowId: workflowId || "default",
    runAt: Date.now(),
    durationMs: totalMs,
    stepCount: runLogs.length,
    status: hasError ? "error" : "pass",
    logs: runLogs,
    initialState,
  };

  const existing = loadRunHistory(workflowId);
  const updated = [newRun, ...existing].slice(0, 15);

  try {
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to persist run history to localStorage:", e);
  }

  return newRun;
}

/**
 * Loads the stored execution history for a given workflow ID.
 */
export function loadRunHistory(workflowId: string | null): WorkflowRun[] {
  const key = `${STORAGE_KEY_PREFIX}${workflowId || "default"}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Clears execution history for a given workflow ID.
 */
export function clearRunHistory(workflowId: string | null): void {
  const key = `${STORAGE_KEY_PREFIX}${workflowId || "default"}`;
  try {
    localStorage.removeItem(key);
  } catch {}
}
