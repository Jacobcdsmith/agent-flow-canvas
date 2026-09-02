import type { RunLog } from "./runFlow";

export interface RunRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  timestamp: number;
  status: "pass" | "error";
  totalMs: number;
  stepCount: number;
  finalOutput: unknown;
  logs: RunLog[];
}

const STORAGE_PREFIX = "agent_flow.run_history.v1.";

export function getHistoryKey(workflowId?: string | null): string {
  return `${STORAGE_PREFIX}${workflowId || "default"}`;
}

export function loadRunHistory(workflowId?: string | null): RunRecord[] {
  try {
    const raw = localStorage.getItem(getHistoryKey(workflowId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRunHistory(workflowId: string | null, history: RunRecord[]): void {
  try {
    // Keep max 30 runs per workflow to manage localStorage footprint
    const trimmed = history.slice(0, 30);
    localStorage.setItem(getHistoryKey(workflowId), JSON.stringify(trimmed));
  } catch {}
}

export function recordRun(
  workflowId: string | null,
  workflowName: string,
  logs: RunLog[]
): RunRecord {
  const existing = loadRunHistory(workflowId);
  const totalMs = logs.reduce((acc, l) => acc + l.ms, 0);
  const hasError = logs.some((l) => !!l.error);
  const lastLog = logs[logs.length - 1];
  const finalOutput = lastLog ? (lastLog.output ?? lastLog.stateSnapshot?.last_output ?? null) : null;

  const newRecord: RunRecord = {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    workflowId: workflowId || "default",
    workflowName: workflowName || "Default Flow",
    timestamp: Date.now(),
    status: hasError ? "error" : "pass",
    totalMs,
    stepCount: logs.length,
    finalOutput,
    logs,
  };

  const updated = [newRecord, ...existing];
  saveRunHistory(workflowId, updated);
  return newRecord;
}

export function clearRunHistory(workflowId?: string | null): void {
  try {
    localStorage.removeItem(getHistoryKey(workflowId));
  } catch {}
}

export interface StateDiffItem {
  key: string;
  valA: unknown;
  valB: unknown;
  changed: boolean;
}

export function diffStateSnapshots(
  stateA?: Record<string, unknown>,
  stateB?: Record<string, unknown>
): StateDiffItem[] {
  const keys = new Set([
    ...Object.keys(stateA || {}),
    ...Object.keys(stateB || {}),
  ]);

  const result: StateDiffItem[] = [];
  keys.forEach((key) => {
    // Ignore internal keys
    if (key.startsWith("__")) return;
    const valA = stateA ? stateA[key] : undefined;
    const valB = stateB ? stateB[key] : undefined;
    const strA = JSON.stringify(valA);
    const strB = JSON.stringify(valB);
    result.push({
      key,
      valA,
      valB,
      changed: strA !== strB,
    });
  });

  return result.sort((a, b) => (b.changed ? 1 : 0) - (a.changed ? 1 : 0));
}
