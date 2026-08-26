import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  loadRunHistory,
  deleteRunRecord,
  clearRunHistory,
  RunRecord,
} from "./runHistory";

interface RunComparisonModalProps {
  isOpen: boolean;
  workflowId: string | null;
  onClose: () => void;
  onRefreshHistory?: () => void;
}

export function RunComparisonModal({
  isOpen,
  workflowId,
  onClose,
  onRefreshHistory,
}: RunComparisonModalProps) {
  const [history, setHistory] = useState<RunRecord[]>(() => loadRunHistory(workflowId));
  const [runAId, setRunAId] = useState<string>(() => (history.length > 0 ? history[0].id : ""));
  const [runBId, setRunBId] = useState<string>(() => (history.length > 1 ? history[1].id : ""));

  const refreshLocalHistory = () => {
    const fresh = loadRunHistory(workflowId);
    setHistory(fresh);
    if (!fresh.some((r) => r.id === runAId)) {
      setRunAId(fresh.length > 0 ? fresh[0].id : "");
    }
    if (!fresh.some((r) => r.id === runBId)) {
      setRunBId(fresh.length > 1 ? fresh[1].id : "");
    }
    onRefreshHistory?.();
  };

  const runA = useMemo(() => history.find((r) => r.id === runAId) ?? null, [history, runAId]);
  const runB = useMemo(() => history.find((r) => r.id === runBId) ?? null, [history, runBId]);

  if (!isOpen) return null;

  const durationDelta =
    runA && runB ? runB.durationMs - runA.durationMs : null;
  const stepDelta = runA && runB ? runB.stepCount - runA.stepCount : null;

  // Compute maximum steps across both runs to render side-by-side step comparison
  const maxStepsCount = Math.max(
    runA ? runA.logs.length : 0,
    runB ? runB.logs.length : 0
  );

  const exportComparisonReport = () => {
    if (!runA && !runB) {
      toast.error("No runs selected for export");
      return;
    }
    const report = {
      exportedAt: new Date().toISOString(),
      workflowId: workflowId || "default",
      runA,
      runB,
      metrics: {
        durationDeltaMs: durationDelta,
        stepDelta,
      },
    };
    const data = JSON.stringify(report, null, 2);
    const blob = new Blob([data], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `run_comparison_${workflowId || "default"}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Comparison report exported");
  };

  const handleDeleteRun = (id: string, label: string) => {
    if (confirm(`Delete run record ${id}?`)) {
      deleteRunRecord(workflowId, id);
      toast.success(`Deleted ${label}`);
      refreshLocalHistory();
    }
  };

  const handleClearAllHistory = () => {
    if (confirm("Are you sure you want to clear all execution run history for this workflow?")) {
      clearRunHistory(workflowId);
      toast.success("Run history cleared");
      refreshLocalHistory();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--ink)/0.5)] backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl max-h-[90vh] bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] flex flex-col shadow-2xl overflow-hidden font-mono text-[11px]">
        {/* Header Bar */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">⚖️</span>
            <div>
              <h2 className="font-semibold text-sm text-[hsl(var(--ink))]">
                Run Comparison & Analytics
              </h2>
              <p className="text-[10px] text-[hsl(var(--ink-faint))]">
                Compare workflow performance, step logs, and state snapshots side by side
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            ✕ Close
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {history.length < 2 && (
            <div className="p-3 border border-dashed border-[hsl(var(--issue))] bg-[hsl(var(--issue)/0.05)] text-[hsl(var(--issue))] text-[10px] space-y-1">
              <span className="font-bold uppercase tracking-wider block">ℹ Note: Limited Run History</span>
              <p>
                You need at least 2 recorded execution runs to perform side-by-side comparison. Run the workflow again to populate history.
              </p>
            </div>
          )}

          {/* Run Selectors Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[hsl(var(--ink)/0.02)] p-3 border border-dashed border-[hsl(var(--grid-line))]">
            {/* Run A Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[hsl(var(--ink))] uppercase tracking-wider text-[10px]">
                  Run A (Baseline)
                </span>
                {runA && (
                  <button
                    onClick={() => handleDeleteRun(runA.id, "Run A")}
                    className="text-[9px] text-[hsl(var(--issue))] hover:underline uppercase tracking-wider"
                  >
                    Delete Run A
                  </button>
                )}
              </div>
              <select
                value={runAId}
                onChange={(e) => setRunAId(e.target.value)}
                className="w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink))] p-1.5 outline-none font-mono text-[10px]"
              >
                <option value="">-- Select Run A --</option>
                {history.map((r, idx) => (
                  <option key={r.id} value={r.id}>
                    #{history.length - idx} · {new Date(r.timestamp).toLocaleTimeString()} · {r.status.toUpperCase()} ({r.durationMs}ms, {r.stepCount} steps)
                  </option>
                ))}
              </select>
            </div>

            {/* Run B Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[hsl(var(--ink))] uppercase tracking-wider text-[10px]">
                  Run B (Comparison Target)
                </span>
                {runB && (
                  <button
                    onClick={() => handleDeleteRun(runB.id, "Run B")}
                    className="text-[9px] text-[hsl(var(--issue))] hover:underline uppercase tracking-wider"
                  >
                    Delete Run B
                  </button>
                )}
              </div>
              <select
                value={runBId}
                onChange={(e) => setRunBId(e.target.value)}
                className="w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink))] p-1.5 outline-none font-mono text-[10px]"
              >
                <option value="">-- Select Run B --</option>
                {history.map((r, idx) => (
                  <option key={r.id} value={r.id}>
                    #{history.length - idx} · {new Date(r.timestamp).toLocaleTimeString()} · {r.status.toUpperCase()} ({r.durationMs}ms, {r.stepCount} steps)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* High Level Metrics Comparison Cards */}
          {(runA || runB) && (
            <div className="space-y-2">
              <h3 className="font-bold text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] border-b border-dashed border-[hsl(var(--grid-line))] pb-1">
                Executive Metric Comparison
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Run A Card */}
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-2 bg-[hsl(var(--paper))]">
                  <div className="flex items-center justify-between border-b border-dotted border-[hsl(var(--grid-line))] pb-1">
                    <span className="font-bold text-[hsl(var(--ink))]">Run A Metrics</span>
                    {runA ? (
                      <span
                        className={`px-1.5 py-0.2 text-[9px] font-bold uppercase border ${
                          runA.status === "pass"
                            ? "border-emerald-600 text-emerald-600"
                            : "border-[hsl(var(--issue))] text-[hsl(var(--issue))]"
                        }`}
                      >
                        {runA.status}
                      </span>
                    ) : (
                      <span className="text-[hsl(var(--ink-faint))]">No Run Selected</span>
                    )}
                  </div>
                  {runA ? (
                    <div className="space-y-1 text-[10px]">
                      <div><span className="text-[hsl(var(--ink-faint))]">Timestamp:</span> {new Date(runA.timestamp).toLocaleString()}</div>
                      <div><span className="text-[hsl(var(--ink-faint))]">Duration:</span> <span className="font-bold">{runA.durationMs} ms</span></div>
                      <div><span className="text-[hsl(var(--ink-faint))]">Steps:</span> <span className="font-bold">{runA.stepCount}</span></div>
                      <div>
                        <span className="text-[hsl(var(--ink-faint))] block mb-0.5">Final Output:</span>
                        <pre className="p-1.5 bg-[hsl(var(--ink)/0.03)] border border-dashed border-[hsl(var(--grid-line))] max-h-24 overflow-auto text-[9px] whitespace-pre-wrap">
                          {typeof runA.finalOutput === "string" ? runA.finalOutput : JSON.stringify(runA.finalOutput, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[hsl(var(--ink-faint))] italic py-4 text-center">Select Run A to compare</div>
                  )}
                </div>

                {/* Run B Card */}
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-2 bg-[hsl(var(--paper))]">
                  <div className="flex items-center justify-between border-b border-dotted border-[hsl(var(--grid-line))] pb-1">
                    <span className="font-bold text-[hsl(var(--ink))]">Run B Metrics</span>
                    {runB ? (
                      <span
                        className={`px-1.5 py-0.2 text-[9px] font-bold uppercase border ${
                          runB.status === "pass"
                            ? "border-emerald-600 text-emerald-600"
                            : "border-[hsl(var(--issue))] text-[hsl(var(--issue))]"
                        }`}
                      >
                        {runB.status}
                      </span>
                    ) : (
                      <span className="text-[hsl(var(--ink-faint))]">No Run Selected</span>
                    )}
                  </div>
                  {runB ? (
                    <div className="space-y-1 text-[10px]">
                      <div><span className="text-[hsl(var(--ink-faint))]">Timestamp:</span> {new Date(runB.timestamp).toLocaleString()}</div>
                      <div>
                        <span className="text-[hsl(var(--ink-faint))]">Duration:</span> <span className="font-bold">{runB.durationMs} ms</span>
                        {durationDelta !== null && (
                          <span
                            className={`ml-2 font-bold ${
                              durationDelta > 0
                                ? "text-[hsl(var(--issue))]"
                                : durationDelta < 0
                                ? "text-emerald-600"
                                : "text-[hsl(var(--ink-faint))]"
                            }`}
                          >
                            ({durationDelta > 0 ? `+${durationDelta}` : durationDelta} ms)
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[hsl(var(--ink-faint))]">Steps:</span> <span className="font-bold">{runB.stepCount}</span>
                        {stepDelta !== null && stepDelta !== 0 && (
                          <span className="ml-2 font-bold text-[hsl(var(--ink-soft))]">
                            ({stepDelta > 0 ? `+${stepDelta}` : stepDelta} steps)
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[hsl(var(--ink-faint))] block mb-0.5">Final Output:</span>
                        <pre className="p-1.5 bg-[hsl(var(--ink)/0.03)] border border-dashed border-[hsl(var(--grid-line))] max-h-24 overflow-auto text-[9px] whitespace-pre-wrap">
                          {typeof runB.finalOutput === "string" ? runB.finalOutput : JSON.stringify(runB.finalOutput, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[hsl(var(--ink-faint))] italic py-4 text-center">Select Run B to compare</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step-by-Step State & Log Comparison Table */}
          {runA && runB && maxStepsCount > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="font-bold text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] border-b border-dashed border-[hsl(var(--grid-line))] pb-1">
                Step-by-Step Execution Comparison ({maxStepsCount} Steps)
              </h3>
              <div className="border border-dashed border-[hsl(var(--grid-line))] overflow-x-auto">
                <table className="w-full text-left font-mono text-[10px]">
                  <thead>
                    <tr className="bg-[hsl(var(--ink)/0.04)] border-b border-dashed border-[hsl(var(--grid-line))]">
                      <th className="p-2 border-r border-dashed border-[hsl(var(--grid-line))] w-12 text-center">Step</th>
                      <th className="p-2 border-r border-dashed border-[hsl(var(--grid-line))] w-1/2">Run A Step Detail</th>
                      <th className="p-2 w-1/2">Run B Step Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-[hsl(var(--grid-line))]">
                    {Array.from({ length: maxStepsCount }).map((_, idx) => {
                      const logA = runA.logs[idx];
                      const logB = runB.logs[idx];
                      const isDiff =
                        JSON.stringify(logA?.output) !== JSON.stringify(logB?.output) ||
                        logA?.error !== logB?.error;

                      return (
                        <tr
                          key={idx}
                          className={isDiff ? "bg-[hsl(var(--accent-deep)/0.02)]" : undefined}
                        >
                          <td className="p-2 border-r border-dashed border-[hsl(var(--grid-line))] text-center font-bold text-[hsl(var(--ink-soft))]">
                            #{idx + 1}
                          </td>
                          {/* Run A Step Column */}
                          <td className="p-2 border-r border-dashed border-[hsl(var(--grid-line))] align-top space-y-1">
                            {logA ? (
                              <>
                                <div className="flex items-center gap-1.5 font-semibold">
                                  <span>{logA.name}</span>
                                  <span className="text-[8px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">({logA.kind})</span>
                                  <span className="ml-auto text-[9px] text-[hsl(var(--ink-faint))]">{logA.ms}ms</span>
                                </div>
                                {logA.error ? (
                                  <pre className="p-1 bg-[hsl(var(--issue)/0.1)] text-[hsl(var(--issue))] text-[9px] whitespace-pre-wrap">
                                    {logA.error}
                                  </pre>
                                ) : (
                                  <pre className="p-1 bg-[hsl(var(--ink)/0.02)] border border-dashed border-[hsl(var(--grid-line))] max-h-24 overflow-auto text-[9px] whitespace-pre-wrap">
                                    {typeof logA.output === "string" ? logA.output : JSON.stringify(logA.output, null, 2)}
                                  </pre>
                                )}
                              </>
                            ) : (
                              <span className="text-[hsl(var(--ink-faint))] italic">— No step —</span>
                            )}
                          </td>

                          {/* Run B Step Column */}
                          <td className="p-2 align-top space-y-1">
                            {logB ? (
                              <>
                                <div className="flex items-center gap-1.5 font-semibold">
                                  <span>{logB.name}</span>
                                  <span className="text-[8px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">({logB.kind})</span>
                                  <span className="ml-auto text-[9px] text-[hsl(var(--ink-faint))]">{logB.ms}ms</span>
                                </div>
                                {logB.error ? (
                                  <pre className="p-1 bg-[hsl(var(--issue)/0.1)] text-[hsl(var(--issue))] text-[9px] whitespace-pre-wrap">
                                    {logB.error}
                                  </pre>
                                ) : (
                                  <pre
                                    className={`p-1 border border-dashed max-h-24 overflow-auto text-[9px] whitespace-pre-wrap ${
                                      isDiff
                                        ? "bg-amber-500/10 border-amber-500/30"
                                        : "bg-[hsl(var(--ink)/0.02)] border-[hsl(var(--grid-line))]"
                                    }`}
                                  >
                                    {typeof logB.output === "string" ? logB.output : JSON.stringify(logB.output, null, 2)}
                                  </pre>
                                )}
                              </>
                            ) : (
                              <span className="text-[hsl(var(--ink-faint))] italic">— No step —</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className="flex items-center justify-between px-4 py-3 border-t border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <button
            onClick={handleClearAllHistory}
            disabled={history.length === 0}
            className="px-2.5 py-1 border border-dashed text-[hsl(var(--issue))] border-[hsl(var(--issue))] hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))] disabled:opacity-40 transition-colors uppercase text-[10px]"
          >
            Clear History ({history.length})
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={exportComparisonReport}
              disabled={!runA && !runB}
              className="px-3 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] disabled:opacity-40 transition-colors uppercase text-[10px]"
            >
              Export Comparison JSON
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 border border-dashed text-[hsl(var(--paper))] uppercase text-[10px]"
              style={{ background: "var(--gradient-accent)", borderColor: "hsl(var(--accent-deep))" }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
