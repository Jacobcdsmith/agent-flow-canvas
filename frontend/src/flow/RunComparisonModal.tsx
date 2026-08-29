import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { RunHistoryRecord } from "./runHistory";

interface RunComparisonModalProps {
  history: RunHistoryRecord[];
  onClose: () => void;
}

export function RunComparisonModal({ history, onClose }: RunComparisonModalProps) {
  const [runAId, setRunAId] = useState<string>(() => (history.length > 0 ? history[0].id : ""));
  const [runBId, setRunBId] = useState<string>(() => (history.length > 1 ? history[1].id : history.length > 0 ? history[0].id : ""));
  const [showStateDiffOnly, setShowStateDiffOnly] = useState<boolean>(false);

  const runA = useMemo(() => history.find((r) => r.id === runAId) || null, [history, runAId]);
  const runB = useMemo(() => history.find((r) => r.id === runBId) || null, [history, runBId]);

  const durationDiff = useMemo(() => {
    if (!runA || !runB) return null;
    const diff = runB.durationMs - runA.durationMs;
    const pct = runA.durationMs > 0 ? Math.round((Math.abs(diff) / runA.durationMs) * 100) : 0;
    if (diff === 0) return "Identical execution time";
    if (diff < 0) return `Run B was ${Math.abs(diff)}ms (${pct}%) faster than Run A`;
    return `Run B was ${diff}ms (${pct}%) slower than Run A`;
  }, [runA, runB]);

  const maxSteps = useMemo(() => {
    if (!runA && !runB) return 0;
    return Math.max(runA?.logs.length || 0, runB?.logs.length || 0);
  }, [runA, runB]);

  const exportComparison = () => {
    if (!runA || !runB) return;
    const summary = {
      comparisonDate: new Date().toISOString(),
      runA: {
        id: runA.id,
        timestamp: new Date(runA.timestamp).toLocaleString(),
        status: runA.status,
        durationMs: runA.durationMs,
        stepCount: runA.stepCount,
      },
      runB: {
        id: runB.id,
        timestamp: new Date(runB.timestamp).toLocaleString(),
        status: runB.status,
        durationMs: runB.durationMs,
        stepCount: runB.stepCount,
      },
      durationDiff,
    };
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "run_comparison.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Comparison report downloaded");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col font-mono text-[11px] overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">⇄</span>
            <div>
              <h2 className="font-semibold text-sm text-[hsl(var(--ink))]">Execution Run Comparison</h2>
              <p className="text-[10px] text-[hsl(var(--ink-faint))] uppercase tracking-wider">
                Side-by-side performance & output state diff
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportComparison}
              disabled={!runA || !runB}
              className="px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] disabled:opacity-40 transition-colors uppercase text-[10px]"
            >
              Export Report
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
            >
              × Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {history.length < 2 && (
            <div className="p-3 border border-dashed border-[hsl(var(--issue))] text-[hsl(var(--issue))] bg-[hsl(var(--issue)/0.05)] text-center">
              ⚠ At least 2 recorded execution runs are required to perform a comparison. Run the workflow again to generate history.
            </div>
          )}

          {/* Run Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-2 bg-[hsl(var(--ink)/0.015)]">
              <label className="font-semibold uppercase text-[10px] text-[hsl(var(--ink-soft))] block">
                Select Run A (Baseline)
              </label>
              <select
                value={runAId}
                onChange={(e) => setRunAId(e.target.value)}
                className="w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink-faint))] p-1.5 text-[11px] text-[hsl(var(--ink))] font-mono"
              >
                {history.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.status === "success" ? "✓" : "✗"} {new Date(r.timestamp).toLocaleString()} ({r.stepCount} steps, {r.durationMs}ms)
                  </option>
                ))}
              </select>
            </div>

            <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-2 bg-[hsl(var(--ink)/0.015)]">
              <label className="font-semibold uppercase text-[10px] text-[hsl(var(--ink-soft))] block">
                Select Run B (Comparison Target)
              </label>
              <select
                value={runBId}
                onChange={(e) => setRunBId(e.target.value)}
                className="w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink-faint))] p-1.5 text-[11px] text-[hsl(var(--ink))] font-mono"
              >
                {history.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.status === "success" ? "✓" : "✗"} {new Date(r.timestamp).toLocaleString()} ({r.stepCount} steps, {r.durationMs}ms)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* High Level Comparison Table */}
          {runA && runB && (
            <div className="border border-dashed border-[hsl(var(--grid-line))] overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[hsl(var(--ink)/0.04)] border-b border-dashed border-[hsl(var(--grid-line))] uppercase text-[10px] text-[hsl(var(--ink-soft))]">
                    <th className="p-2 border-r border-dashed border-[hsl(var(--grid-line))]">Metric</th>
                    <th className="p-2 border-r border-dashed border-[hsl(var(--grid-line))]">Run A (Baseline)</th>
                    <th className="p-2">Run B (Target)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-[hsl(var(--grid-line))]">
                  <tr>
                    <td className="p-2 font-semibold text-[hsl(var(--ink-soft))] border-r border-dashed border-[hsl(var(--grid-line))]">
                      Timestamp
                    </td>
                    <td className="p-2 border-r border-dashed border-[hsl(var(--grid-line))]">
                      {new Date(runA.timestamp).toLocaleString()}
                    </td>
                    <td className="p-2">{new Date(runB.timestamp).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold text-[hsl(var(--ink-soft))] border-r border-dashed border-[hsl(var(--grid-line))]">
                      Status
                    </td>
                    <td className="p-2 border-r border-dashed border-[hsl(var(--grid-line))]">
                      <span
                        className={`px-1.5 py-0.5 border ${
                          runA.status === "success"
                            ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                            : "border-[hsl(var(--issue))] text-[hsl(var(--issue))]"
                        }`}
                      >
                        {runA.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2">
                      <span
                        className={`px-1.5 py-0.5 border ${
                          runB.status === "success"
                            ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                            : "border-[hsl(var(--issue))] text-[hsl(var(--issue))]"
                        }`}
                      >
                        {runB.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold text-[hsl(var(--ink-soft))] border-r border-dashed border-[hsl(var(--grid-line))]">
                      Total Duration
                    </td>
                    <td className="p-2 border-r border-dashed border-[hsl(var(--grid-line))]">{runA.durationMs}ms</td>
                    <td className="p-2">
                      {runB.durationMs}ms
                      {durationDiff && (
                        <span className="block text-[9px] text-[hsl(var(--ink-soft))] mt-0.5 font-sans">
                          {durationDiff}
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold text-[hsl(var(--ink-soft))] border-r border-dashed border-[hsl(var(--grid-line))]">
                      Step Count
                    </td>
                    <td className="p-2 border-r border-dashed border-[hsl(var(--grid-line))]">{runA.stepCount} steps</td>
                    <td className="p-2">{runB.stepCount} steps</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Per-step side by side comparison */}
          {runA && runB && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold uppercase tracking-wider text-[11px] text-[hsl(var(--ink))]">
                  Step-by-Step State & Output Comparison ({maxSteps} steps)
                </h3>
              </div>

              <div className="border border-dashed border-[hsl(var(--grid-line))] divide-y divide-dashed divide-[hsl(var(--grid-line))]">
                {Array.from({ length: maxSteps }).map((_, idx) => {
                  const logA = runA.logs[idx];
                  const logB = runB.logs[idx];

                  const snapshotAStr = logA?.stateSnapshot ? JSON.stringify(logA.stateSnapshot, null, 2) : "";
                  const snapshotBStr = logB?.stateSnapshot ? JSON.stringify(logB.stateSnapshot, null, 2) : "";
                  const isDiff = snapshotAStr !== snapshotBStr;

                  return (
                    <div key={idx} className="p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-dotted border-[hsl(var(--grid-line))] pb-1 text-[10px]">
                        <span className="font-bold text-[hsl(var(--ink-soft))]">Step #{idx + 1}</span>
                        {isDiff && (
                          <span className="text-[9px] px-1.5 py-0.2 border border-amber-600 text-amber-600 uppercase font-bold">
                            State Snapshot Diff
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                        {/* Run A Step */}
                        <div className="border border-dashed border-[hsl(var(--grid-line))] p-2 bg-[hsl(var(--paper))] space-y-1">
                          <div className="flex justify-between items-center text-[hsl(var(--ink-soft))]">
                            <span className="font-bold text-[hsl(var(--ink))]">{logA ? logA.name : "—"}</span>
                            <span>{logA ? `${logA.ms}ms` : ""}</span>
                          </div>
                          {logA && (
                            <>
                              <div className="text-[9px] uppercase text-[hsl(var(--ink-faint))]">Kind: {logA.kind}</div>
                              <pre className="p-1 bg-[hsl(var(--ink)/0.02)] border border-dotted border-[hsl(var(--grid-line))] max-h-28 overflow-auto text-[9px]">
                                {typeof logA.output === "string" ? logA.output : JSON.stringify(logA.output, null, 2)}
                              </pre>
                            </>
                          )}
                        </div>

                        {/* Run B Step */}
                        <div className="border border-dashed border-[hsl(var(--grid-line))] p-2 bg-[hsl(var(--paper))] space-y-1">
                          <div className="flex justify-between items-center text-[hsl(var(--ink-soft))]">
                            <span className="font-bold text-[hsl(var(--ink))]">{logB ? logB.name : "—"}</span>
                            <span>{logB ? `${logB.ms}ms` : ""}</span>
                          </div>
                          {logB && (
                            <>
                              <div className="text-[9px] uppercase text-[hsl(var(--ink-faint))]">Kind: {logB.kind}</div>
                              <pre className="p-1 bg-[hsl(var(--ink)/0.02)] border border-dotted border-[hsl(var(--grid-line))] max-h-28 overflow-auto text-[9px]">
                                {typeof logB.output === "string" ? logB.output : JSON.stringify(logB.output, null, 2)}
                              </pre>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
