import React, { useState } from "react";
import { RunRecord, diffStateSnapshots } from "./runHistory";

interface RunComparisonModalProps {
  runs: RunRecord[];
  onClose: () => void;
}

export const RunComparisonModal: React.FC<RunComparisonModalProps> = ({
  runs,
  onClose,
}) => {
  const [runAId, setRunAId] = useState<string>(runs[0]?.id || "");
  const [runBId, setRunBId] = useState<string>(runs[1]?.id || runs[0]?.id || "");
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);

  const runA = runs.find((r) => r.id === runAId) || runs[0];
  const runB = runs.find((r) => r.id === runBId) || runs[1] || runs[0];

  const durationDiff = runA && runB ? runB.totalMs - runA.totalMs : 0;
  const stepCountDiff = runA && runB ? runB.stepCount - runA.stepCount : 0;

  const maxSteps = Math.max(
    runA?.logs.length || 0,
    runB?.logs.length || 0
  );

  const logA = runA?.logs[selectedStepIndex];
  const logB = runB?.logs[selectedStepIndex];

  const stateDiffs = diffStateSnapshots(
    logA?.stateSnapshot,
    logB?.stateSnapshot
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--ink)/0.5)] backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] shadow-xl flex flex-col font-mono text-[11px] overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">⚖️</span>
            <div>
              <h2 className="font-semibold text-sm text-[hsl(var(--ink))]">
                Run Comparison & State Diff
              </h2>
              <div className="text-[10px] text-[hsl(var(--ink-faint))] uppercase tracking-wider">
                Compare execution runs side-by-side
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            × Close
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {runs.length < 2 ? (
            <div className="p-8 text-center border border-dashed border-[hsl(var(--grid-line))] text-[hsl(var(--ink-soft))] space-y-2">
              <p className="font-semibold text-sm">Need at least 2 execution runs to compare.</p>
              <p className="text-[10px] text-[hsl(var(--ink-faint))]">
                Run your workflow multiple times to generate run history records for side-by-side comparison.
              </p>
            </div>
          ) : (
            <>
              {/* Selectors & Metrics Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-dashed border-[hsl(var(--grid-line))] p-3 bg-[hsl(var(--ink)/0.01)]">
                {/* Run A Selector */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[hsl(var(--ink-soft))] block">
                    Run A (Baseline):
                  </label>
                  <select
                    value={runAId}
                    onChange={(e) => setRunAId(e.target.value)}
                    className="w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink))] p-1.5 font-mono text-[10px] text-[hsl(var(--ink))]"
                  >
                    {runs.map((r, idx) => (
                      <option key={r.id} value={r.id}>
                        Run #{runs.length - idx} · {new Date(r.timestamp).toLocaleTimeString()} · {r.totalMs}ms · {r.status.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  {runA && (
                    <div className="text-[9px] text-[hsl(var(--ink-faint))] flex justify-between pt-1">
                      <span>Duration: <strong>{runA.totalMs}ms</strong></span>
                      <span>Steps: <strong>{runA.stepCount}</strong></span>
                      <span className={runA.status === "pass" ? "text-emerald-600 font-bold" : "text-[hsl(var(--issue))] font-bold"}>
                        {runA.status.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Run B Selector */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[hsl(var(--ink-soft))] block">
                    Run B (Comparison):
                  </label>
                  <select
                    value={runBId}
                    onChange={(e) => setRunBId(e.target.value)}
                    className="w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink))] p-1.5 font-mono text-[10px] text-[hsl(var(--ink))]"
                  >
                    {runs.map((r, idx) => (
                      <option key={r.id} value={r.id}>
                        Run #{runs.length - idx} · {new Date(r.timestamp).toLocaleTimeString()} · {r.totalMs}ms · {r.status.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  {runB && (
                    <div className="text-[9px] text-[hsl(var(--ink-faint))] flex justify-between pt-1">
                      <span>
                        Duration: <strong>{runB.totalMs}ms</strong>{" "}
                        <span className={durationDiff <= 0 ? "text-emerald-600 font-bold" : "text-[hsl(var(--issue))] font-bold"}>
                          ({durationDiff > 0 ? `+${durationDiff}` : durationDiff}ms)
                        </span>
                      </span>
                      <span>
                        Steps: <strong>{runB.stepCount}</strong> ({stepCountDiff > 0 ? `+${stepCountDiff}` : stepCountDiff})
                      </span>
                      <span className={runB.status === "pass" ? "text-emerald-600 font-bold" : "text-[hsl(var(--issue))] font-bold"}>
                        {runB.status.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Side-by-side Final Outputs */}
              <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-2">
                <span className="text-[10px] uppercase font-bold text-[hsl(var(--ink-soft))] block">
                  Final Outputs Comparison
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[10px]">
                  <div className="p-2 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.01)] max-h-36 overflow-auto">
                    <span className="text-[9px] text-[hsl(var(--ink-faint))] uppercase block mb-1">Run A Final Output:</span>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(runA?.finalOutput, null, 2)}</pre>
                  </div>
                  <div className="p-2 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.01)] max-h-36 overflow-auto">
                    <span className="text-[9px] text-[hsl(var(--ink-faint))] uppercase block mb-1">Run B Final Output:</span>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(runB?.finalOutput, null, 2)}</pre>
                  </div>
                </div>
              </div>

              {/* Step-by-Step State Diff Inspector */}
              <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[hsl(var(--ink-soft))]">
                    Step-by-Step State Diff
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[hsl(var(--ink-faint))] uppercase">Step:</span>
                    <select
                      value={selectedStepIndex}
                      onChange={(e) => setSelectedStepIndex(Number(e.target.value))}
                      className="bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink))] px-2 py-0.5 text-[10px]"
                    >
                      {Array.from({ length: maxSteps }).map((_, idx) => (
                        <option key={idx} value={idx}>
                          Step #{idx + 1} ({runA?.logs[idx]?.name || "N/A"} vs {runB?.logs[idx]?.name || "N/A"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Step Metadata Summary */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-b border-dotted border-[hsl(var(--grid-line))] pb-2">
                  <div className="p-1.5 border border-dashed border-[hsl(var(--grid-line))]">
                    <div className="font-bold text-[hsl(var(--ink))]">Run A Step #{selectedStepIndex + 1}</div>
                    <div className="text-[9px] text-[hsl(var(--ink-soft))]">
                      Node: {logA ? `${logA.name} (${logA.kind})` : "None / Ended"} · {logA ? `${logA.ms}ms` : "-"}
                    </div>
                  </div>
                  <div className="p-1.5 border border-dashed border-[hsl(var(--grid-line))]">
                    <div className="font-bold text-[hsl(var(--ink))]">Run B Step #{selectedStepIndex + 1}</div>
                    <div className="text-[9px] text-[hsl(var(--ink-soft))]">
                      Node: {logB ? `${logB.name} (${logB.kind})` : "None / Ended"} · {logB ? `${logB.ms}ms` : "-"}
                    </div>
                  </div>
                </div>

                {/* State Keys Comparison Table */}
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-soft))] block font-bold">
                    State Variable Diffs:
                  </span>
                  {stateDiffs.length === 0 ? (
                    <div className="p-2 text-center text-[9px] text-[hsl(var(--ink-faint))] border border-dashed border-[hsl(var(--grid-line))]">
                      No state variables present for this step.
                    </div>
                  ) : (
                    <div className="border border-dashed border-[hsl(var(--grid-line))] max-h-48 overflow-y-auto">
                      <table className="w-full text-left font-mono text-[9px]">
                        <thead className="bg-[hsl(var(--ink)/0.03)] border-b border-dashed border-[hsl(var(--grid-line))] uppercase text-[hsl(var(--ink-faint))]">
                          <tr>
                            <th className="p-1.5">Key</th>
                            <th className="p-1.5">Run A Value</th>
                            <th className="p-1.5">Run B Value</th>
                            <th className="p-1.5 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dashed divide-[hsl(var(--grid-line))]">
                          {stateDiffs.map((diff) => (
                            <tr
                              key={diff.key}
                              className={diff.changed ? "bg-[hsl(var(--issue)/0.05)]" : ""}
                            >
                              <td className="p-1.5 font-bold text-[hsl(var(--ink))]">{diff.key}</td>
                              <td className="p-1.5 text-[hsl(var(--ink-soft))] max-w-[150px] truncate">
                                {JSON.stringify(diff.valA)}
                              </td>
                              <td className="p-1.5 text-[hsl(var(--ink-soft))] max-w-[150px] truncate">
                                {JSON.stringify(diff.valB)}
                              </td>
                              <td className="p-1.5 text-right font-bold">
                                {diff.changed ? (
                                  <span className="text-[hsl(var(--issue))] font-bold">DIFFERENT</span>
                                ) : (
                                  <span className="text-[hsl(var(--ink-faint))]">identical</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
