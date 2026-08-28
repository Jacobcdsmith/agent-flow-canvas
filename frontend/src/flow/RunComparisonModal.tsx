import React, { useState } from "react";
import { RunRecord } from "./runHistory";

interface RunComparisonModalProps {
  runs: RunRecord[];
  initialRunAId?: string;
  initialRunBId?: string;
  onClose: () => void;
  onApplyInitialState?: (stateStr: string) => void;
}

export function RunComparisonModal({
  runs,
  initialRunAId,
  initialRunBId,
  onClose,
  onApplyInitialState,
}: RunComparisonModalProps) {
  const [runAId, setRunAId] = useState<string>(
    initialRunAId || (runs.length > 0 ? runs[0].id : "")
  );
  const [runBId, setRunBId] = useState<string>(
    initialRunBId || (runs.length > 1 ? runs[1].id : runs.length > 0 ? runs[0].id : "")
  );

  const runA = runs.find((r) => r.id === runAId) || null;
  const runB = runs.find((r) => r.id === runBId) || null;

  const maxSteps = Math.max(runA?.logs.length || 0, runB?.logs.length || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--ink)/0.5)] backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col font-mono text-[11px]">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              Execution Analysis
            </div>
            <h2 className="text-sm font-semibold text-[hsl(var(--ink))]">
              Side-by-Side Run Comparison
            </h2>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            ✕ Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {runs.length === 0 ? (
            <div className="text-center py-12 text-[hsl(var(--ink-soft))] uppercase tracking-widest">
              No run history recorded for this workflow yet. Run the flow to compare executions.
            </div>
          ) : (
            <>
              {/* Selectors Bar */}
              <div className="grid grid-cols-2 gap-4 border-b border-dashed border-[hsl(var(--grid-line))] pb-4">
                {/* Run A Selector */}
                <div className="p-3 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.015)] space-y-2">
                  <div className="flex items-center justify-between font-bold uppercase tracking-wider text-[hsl(var(--ink-soft))] text-[10px]">
                    <span>Run A (Baseline)</span>
                    {runA && onApplyInitialState && (
                      <button
                        onClick={() => onApplyInitialState(JSON.stringify(runA.initialState, null, 2))}
                        className="text-[9px] px-1.5 py-0.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
                      >
                        Load State
                      </button>
                    )}
                  </div>
                  <select
                    value={runAId}
                    onChange={(e) => setRunAId(e.target.value)}
                    className="w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1 px-2 text-[10px]"
                  >
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {new Date(r.timestamp).toLocaleTimeString()} - {r.hasError ? "✗ ERROR" : "✓ PASS"} ({r.durationMs}ms, {r.stepCount} steps)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Run B Selector */}
                <div className="p-3 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.015)] space-y-2">
                  <div className="flex items-center justify-between font-bold uppercase tracking-wider text-[hsl(var(--ink-soft))] text-[10px]">
                    <span>Run B (Comparison)</span>
                    {runB && onApplyInitialState && (
                      <button
                        onClick={() => onApplyInitialState(JSON.stringify(runB.initialState, null, 2))}
                        className="text-[9px] px-1.5 py-0.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
                      >
                        Load State
                      </button>
                    )}
                  </div>
                  <select
                    value={runBId}
                    onChange={(e) => setRunBId(e.target.value)}
                    className="w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-1 px-2 text-[10px]"
                  >
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {new Date(r.timestamp).toLocaleTimeString()} - {r.hasError ? "✗ ERROR" : "✓ PASS"} ({r.durationMs}ms, {r.stepCount} steps)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Metrics Overview Cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Run A Summary */}
                {runA ? (
                  <div className="p-3 border border-dashed border-[hsl(var(--grid-line))] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[hsl(var(--ink-faint))]">Timestamp:</span>
                      <span className="font-bold">{new Date(runA.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[hsl(var(--ink-faint))]">Duration:</span>
                      <span className="font-bold">{runA.durationMs} ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[hsl(var(--ink-faint))]">Step Count:</span>
                      <span className="font-bold">{runA.stepCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[hsl(var(--ink-faint))]">Status:</span>
                      <span
                        className={`font-bold px-1.5 py-0.2 border text-[9px] ${
                          runA.hasError
                            ? "text-[hsl(var(--issue))] border-[hsl(var(--issue))]"
                            : "text-emerald-700 dark:text-emerald-400 border-emerald-600"
                        }`}
                      >
                        {runA.hasError ? "FAILED ✗" : "PASSED ✓"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 text-[hsl(var(--ink-faint))]">Select Run A</div>
                )}

                {/* Run B Summary */}
                {runB ? (
                  <div className="p-3 border border-dashed border-[hsl(var(--grid-line))] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[hsl(var(--ink-faint))]">Timestamp:</span>
                      <span className="font-bold">{new Date(runB.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[hsl(var(--ink-faint))]">Duration:</span>
                      <span className="font-bold">
                        {runB.durationMs} ms{" "}
                        {runA && (
                          <span
                            className={
                              runB.durationMs < runA.durationMs
                                ? "text-emerald-600 font-bold"
                                : runB.durationMs > runA.durationMs
                                ? "text-[hsl(var(--issue))]"
                                : ""
                            }
                          >
                            ({runB.durationMs - runA.durationMs > 0 ? "+" : ""}
                            {runB.durationMs - runA.durationMs}ms)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[hsl(var(--ink-faint))]">Step Count:</span>
                      <span className="font-bold">{runB.stepCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[hsl(var(--ink-faint))]">Status:</span>
                      <span
                        className={`font-bold px-1.5 py-0.2 border text-[9px] ${
                          runB.hasError
                            ? "text-[hsl(var(--issue))] border-[hsl(var(--issue))]"
                            : "text-emerald-700 dark:text-emerald-400 border-emerald-600"
                        }`}
                      >
                        {runB.hasError ? "FAILED ✗" : "PASSED ✓"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 text-[hsl(var(--ink-faint))]">Select Run B</div>
                )}
              </div>

              {/* Initial State Side-by-Side Comparison */}
              <div className="space-y-1">
                <span className="font-bold uppercase tracking-wider text-[10px] text-[hsl(var(--ink-soft))]">
                  Initial State Comparison
                </span>
                <div className="grid grid-cols-2 gap-4">
                  <pre className="p-2 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.02)] max-h-36 overflow-auto text-[10px]">
                    {runA ? JSON.stringify(runA.initialState, null, 2) : "-"}
                  </pre>
                  <pre className="p-2 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.02)] max-h-36 overflow-auto text-[10px]">
                    {runB ? JSON.stringify(runB.initialState, null, 2) : "-"}
                  </pre>
                </div>
              </div>

              {/* Step-by-Step Execution Diff Table */}
              <div className="space-y-2 pt-2">
                <span className="font-bold uppercase tracking-wider text-[10px] text-[hsl(var(--ink-soft))]">
                  Step Execution Diff Matrix
                </span>
                <div className="border border-dashed border-[hsl(var(--grid-line))] overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-[10px]">
                    <thead>
                      <tr className="border-b border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.04)] text-[9px] uppercase tracking-wider text-[hsl(var(--ink-soft))]">
                        <th className="p-2 border-r border-dashed border-[hsl(var(--grid-line))] w-12 text-center">
                          Step
                        </th>
                        <th className="p-2 border-r border-dashed border-[hsl(var(--grid-line))] w-1/2">
                          Run A Step Log
                        </th>
                        <th className="p-2 w-1/2">Run B Step Log</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: maxSteps }).map((_, idx) => {
                        const logA = runA?.logs[idx];
                        const logB = runB?.logs[idx];
                        const isDiff =
                          logA?.name !== logB?.name ||
                          logA?.error !== logB?.error ||
                          JSON.stringify(logA?.output) !== JSON.stringify(logB?.output);

                        return (
                          <tr
                            key={idx}
                            className={`border-b border-dashed border-[hsl(var(--grid-line))] ${
                              isDiff ? "bg-[hsl(var(--issue)/0.03)]" : ""
                            }`}
                          >
                            <td className="p-2 border-r border-dashed border-[hsl(var(--grid-line))] text-center font-bold text-[hsl(var(--ink-faint))]">
                              #{idx + 1}
                            </td>
                            {/* Log A */}
                            <td className="p-2 border-r border-dashed border-[hsl(var(--grid-line))] align-top space-y-1">
                              {logA ? (
                                <div>
                                  <div className="font-semibold flex items-center justify-between">
                                    <span>
                                      {logA.name} ({logA.kind})
                                    </span>
                                    <span className="text-[hsl(var(--ink-faint))]">{logA.ms}ms</span>
                                  </div>
                                  {logA.error ? (
                                    <div className="text-[hsl(var(--issue))] font-mono whitespace-pre-wrap mt-0.5">
                                      {logA.error}
                                    </div>
                                  ) : (
                                    <div className="text-[hsl(var(--ink-soft))] truncate max-w-md">
                                      {typeof logA.output === "string"
                                        ? logA.output
                                        : JSON.stringify(logA.output)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[hsl(var(--ink-faint))] italic">- no step -</span>
                              )}
                            </td>

                            {/* Log B */}
                            <td className="p-2 align-top space-y-1">
                              {logB ? (
                                <div>
                                  <div className="font-semibold flex items-center justify-between">
                                    <span>
                                      {logB.name} ({logB.kind})
                                    </span>
                                    <span className="text-[hsl(var(--ink-faint))]">{logB.ms}ms</span>
                                  </div>
                                  {logB.error ? (
                                    <div className="text-[hsl(var(--issue))] font-mono whitespace-pre-wrap mt-0.5">
                                      {logB.error}
                                    </div>
                                  ) : (
                                    <div className="text-[hsl(var(--ink-soft))] truncate max-w-md">
                                      {typeof logB.output === "string"
                                        ? logB.output
                                        : JSON.stringify(logB.output)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[hsl(var(--ink-faint))] italic">- no step -</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
