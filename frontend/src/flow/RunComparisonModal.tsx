import { useMemo, useState } from "react";
import { ExecutionRunRecord } from "./runHistory";

interface RunComparisonModalProps {
  runs: ExecutionRunRecord[];
  initialRunAId?: string | null;
  initialRunBId?: string | null;
  onClose: () => void;
}

export function RunComparisonModal({
  runs,
  initialRunAId,
  initialRunBId,
  onClose,
}: RunComparisonModalProps) {
  const [runAId, setRunAId] = useState<string>(
    initialRunAId || (runs.length > 0 ? runs[0].id : "")
  );
  const [runBId, setRunBId] = useState<string>(
    initialRunBId || (runs.length > 1 ? runs[1].id : runs.length > 0 ? runs[0].id : "")
  );

  const runA = useMemo(() => runs.find((r) => r.id === runAId) || null, [runs, runAId]);
  const runB = useMemo(() => runs.find((r) => r.id === runBId) || null, [runs, runBId]);

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="border-2 border-[hsl(var(--ink))] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl font-mono text-[11px] bg-background text-foreground"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              Execution Analysis
            </div>
            <h2 className="text-sm font-bold text-[hsl(var(--ink))]">
              Side-by-Side Run Comparison
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors font-semibold"
          >
            ✕ Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {runs.length === 0 ? (
            <div className="p-8 text-center text-[hsl(var(--ink-faint))] border border-dashed border-[hsl(var(--grid-line))]">
              No historical execution runs recorded yet. Execute the workflow to generate runs to compare.
            </div>
          ) : (
            <>
              {/* Selectors Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[hsl(var(--ink)/0.02)] p-3 border border-dashed border-[hsl(var(--grid-line))]">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] font-bold block">
                    Run A (Baseline):
                  </label>
                  <select
                    value={runAId}
                    onChange={(e) => setRunAId(e.target.value)}
                    className="w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1 px-2 font-mono text-[11px] text-[hsl(var(--ink))]"
                  >
                    {runs.map((r, idx) => (
                      <option key={r.id} value={r.id}>
                        Run #{runs.length - idx} ({r.status.toUpperCase()}) - {formatTime(r.timestamp)} ({r.totalMs}ms, {r.stepCount} steps)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] font-bold block">
                    Run B (Comparison):
                  </label>
                  <select
                    value={runBId}
                    onChange={(e) => setRunBId(e.target.value)}
                    className="w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1 px-2 font-mono text-[11px] text-[hsl(var(--ink))]"
                  >
                    {runs.map((r, idx) => (
                      <option key={r.id} value={r.id}>
                        Run #{runs.length - idx} ({r.status.toUpperCase()}) - {formatTime(r.timestamp)} ({r.totalMs}ms, {r.stepCount} steps)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Comparison Matrix Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Run A Card */}
                {runA ? (
                  <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-3 bg-[hsl(var(--paper))]">
                    <div className="flex items-center justify-between border-b border-dotted border-[hsl(var(--grid-line))] pb-1.5">
                      <span className="font-bold text-[12px] text-[hsl(var(--ink))]">
                        Run A
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 border text-[10px] ${
                          runA.status === "error"
                            ? "text-[hsl(var(--issue))] border-[hsl(var(--issue))]"
                            : "text-emerald-700 dark:text-emerald-400 border-emerald-600"
                        }`}
                      >
                        {runA.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-1.5 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.01)]">
                        <div className="text-[8px] uppercase text-[hsl(var(--ink-faint))]">Duration</div>
                        <div className="font-bold text-[hsl(var(--ink))]">{runA.totalMs}ms</div>
                      </div>
                      <div className="p-1.5 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.01)]">
                        <div className="text-[8px] uppercase text-[hsl(var(--ink-faint))]">Steps</div>
                        <div className="font-bold text-[hsl(var(--ink))]">{runA.stepCount}</div>
                      </div>
                      <div className="p-1.5 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.01)]">
                        <div className="text-[8px] uppercase text-[hsl(var(--ink-faint))]">Time</div>
                        <div className="font-bold text-[9px] text-[hsl(var(--ink))] truncate">
                          {formatTime(runA.timestamp)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))] font-bold block">
                        Initial State:
                      </span>
                      <pre className="p-2 bg-[hsl(var(--ink)/0.02)] border border-dashed border-[hsl(var(--grid-line))] overflow-auto max-h-28 text-[9px]">
                        {runA.initialState ? JSON.stringify(runA.initialState, null, 2) : "N/A"}
                      </pre>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))] font-bold block">
                        Final Output:
                      </span>
                      <pre className="p-2 bg-[hsl(var(--ink)/0.02)] border border-dashed border-[hsl(var(--grid-line))] overflow-auto max-h-28 text-[9px]">
                        {typeof runA.finalOutput === "string"
                          ? runA.finalOutput
                          : JSON.stringify(runA.finalOutput, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border border-dashed border-[hsl(var(--grid-line))] text-[hsl(var(--ink-faint))]">
                    Select Run A
                  </div>
                )}

                {/* Run B Card */}
                {runB ? (
                  <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-3 bg-[hsl(var(--paper))]">
                    <div className="flex items-center justify-between border-b border-dotted border-[hsl(var(--grid-line))] pb-1.5">
                      <span className="font-bold text-[12px] text-[hsl(var(--ink))]">
                        Run B
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 border text-[10px] ${
                          runB.status === "error"
                            ? "text-[hsl(var(--issue))] border-[hsl(var(--issue))]"
                            : "text-emerald-700 dark:text-emerald-400 border-emerald-600"
                        }`}
                      >
                        {runB.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-1.5 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.01)]">
                        <div className="text-[8px] uppercase text-[hsl(var(--ink-faint))]">Duration</div>
                        <div
                          className={`font-bold ${
                            runA && runB.totalMs !== runA.totalMs
                              ? runB.totalMs < runA.totalMs
                                ? "text-emerald-600"
                                : "text-[hsl(var(--issue))]"
                              : "text-[hsl(var(--ink))]"
                          }`}
                        >
                          {runB.totalMs}ms
                          {runA && runB.totalMs !== runA.totalMs && (
                            <span className="text-[8px] ml-1">
                              ({runB.totalMs < runA.totalMs ? "-" : "+"}{Math.abs(runB.totalMs - runA.totalMs)}ms)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-1.5 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.01)]">
                        <div className="text-[8px] uppercase text-[hsl(var(--ink-faint))]">Steps</div>
                        <div className="font-bold text-[hsl(var(--ink))]">{runB.stepCount}</div>
                      </div>
                      <div className="p-1.5 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.01)]">
                        <div className="text-[8px] uppercase text-[hsl(var(--ink-faint))]">Time</div>
                        <div className="font-bold text-[9px] text-[hsl(var(--ink))] truncate">
                          {formatTime(runB.timestamp)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))] font-bold block">
                        Initial State:
                      </span>
                      <pre className="p-2 bg-[hsl(var(--ink)/0.02)] border border-dashed border-[hsl(var(--grid-line))] overflow-auto max-h-28 text-[9px]">
                        {runB.initialState ? JSON.stringify(runB.initialState, null, 2) : "N/A"}
                      </pre>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))] font-bold block">
                        Final Output:
                      </span>
                      <pre className="p-2 bg-[hsl(var(--ink)/0.02)] border border-dashed border-[hsl(var(--grid-line))] overflow-auto max-h-28 text-[9px]">
                        {typeof runB.finalOutput === "string"
                          ? runB.finalOutput
                          : JSON.stringify(runB.finalOutput, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border border-dashed border-[hsl(var(--grid-line))] text-[hsl(var(--ink-faint))]">
                    Select Run B
                  </div>
                )}
              </div>

              {/* Step Logs Diff Table */}
              {runA && runB && (
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-2 bg-[hsl(var(--paper))]">
                  <div className="font-bold text-[11px] uppercase tracking-wider text-[hsl(var(--ink))] border-b border-dotted border-[hsl(var(--grid-line))] pb-1">
                    Step-by-Step Execution Comparison
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Run A Logs */}
                    <div className="space-y-2">
                      <div className="text-[9px] font-bold uppercase text-[hsl(var(--ink-soft))]">Run A Logs ({runA.logs.length} steps)</div>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {runA.logs.map((log) => (
                          <div
                            key={`a-${log.step}-${log.nodeId}`}
                            className="p-1.5 border border-dashed border-[hsl(var(--grid-line))] text-[9px] space-y-0.5 bg-[hsl(var(--ink)/0.01)]"
                          >
                            <div className="flex justify-between font-bold">
                              <span>#{log.step} {log.name} ({log.kind})</span>
                              <span>{log.ms}ms</span>
                            </div>
                            {log.error ? (
                              <div className="text-[hsl(var(--issue))]">{log.error}</div>
                            ) : (
                              <pre className="truncate text-[hsl(var(--ink-soft))]">
                                {typeof log.output === "string" ? log.output : JSON.stringify(log.output)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Run B Logs */}
                    <div className="space-y-2">
                      <div className="text-[9px] font-bold uppercase text-[hsl(var(--ink-soft))]">Run B Logs ({runB.logs.length} steps)</div>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {runB.logs.map((log) => (
                          <div
                            key={`b-${log.step}-${log.nodeId}`}
                            className="p-1.5 border border-dashed border-[hsl(var(--grid-line))] text-[9px] space-y-0.5 bg-[hsl(var(--ink)/0.01)]"
                          >
                            <div className="flex justify-between font-bold">
                              <span>#{log.step} {log.name} ({log.kind})</span>
                              <span>{log.ms}ms</span>
                            </div>
                            {log.error ? (
                              <div className="text-[hsl(var(--issue))]">{log.error}</div>
                            ) : (
                              <pre className="truncate text-[hsl(var(--ink-soft))]">
                                {typeof log.output === "string" ? log.output : JSON.stringify(log.output)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
