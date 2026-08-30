import { useState } from "react";
import { RunRecord } from "./runHistory";

interface RunComparisonModalProps {
  runA: RunRecord;
  runB: RunRecord;
  onClose: () => void;
}

export function RunComparisonModal({ runA, runB, onClose }: RunComparisonModalProps) {
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  const toggleStep = (stepIdx: number) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepIdx]: !prev[stepIdx],
    }));
  };

  const maxSteps = Math.max(runA.logs.length, runB.logs.length);
  const stepIndices = Array.from({ length: maxSteps }, (_, i) => i);

  const durationDelta = runB.durationMs - runA.durationMs;
  const durationPercent = runA.durationMs > 0 ? Math.round((durationDelta / runA.durationMs) * 100) : 0;

  const dateStrA = new Date(runA.timestamp).toLocaleString();
  const dateStrB = new Date(runB.timestamp).toLocaleString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-5xl bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        style={{ background: "var(--gradient-paper)" }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              run history comparison · side-by-side
            </div>
            <h2 className="font-mono text-sm font-semibold text-[hsl(var(--ink))] mt-0.5">
              Compare Execution Runs
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            × close
          </button>
        </div>

        {/* Executive Summary Metrics comparison banner */}
        <div className="p-4 border-b border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.015)] font-mono space-y-3">
          <div className="grid grid-cols-2 gap-4">
            {/* Run A summary */}
            <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 bg-[hsl(var(--paper))] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[hsl(var(--ink))]">
                  Run A <span className="text-[9px] font-normal text-[hsl(var(--ink-faint))]">({runA.id.slice(0, 8)})</span>
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 border ${
                    runA.hasError
                      ? "text-[hsl(var(--issue))] border-[hsl(var(--issue))]"
                      : "text-emerald-700 dark:text-emerald-400 border-emerald-600"
                  }`}
                >
                  {runA.hasError ? "ERROR ✗" : "PASS ✓"}
                </span>
              </div>
              <div className="text-[9.5px] text-[hsl(var(--ink-soft))]">{dateStrA}</div>
              <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                <div>Steps: <span className="font-bold">{runA.stepCount}</span></div>
                <div>Duration: <span className="font-bold">{runA.durationMs}ms</span></div>
              </div>
            </div>

            {/* Run B summary */}
            <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 bg-[hsl(var(--paper))] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[hsl(var(--ink))]">
                  Run B <span className="text-[9px] font-normal text-[hsl(var(--ink-faint))]">({runB.id.slice(0, 8)})</span>
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 border ${
                    runB.hasError
                      ? "text-[hsl(var(--issue))] border-[hsl(var(--issue))]"
                      : "text-emerald-700 dark:text-emerald-400 border-emerald-600"
                  }`}
                >
                  {runB.hasError ? "ERROR ✗" : "PASS ✓"}
                </span>
              </div>
              <div className="text-[9.5px] text-[hsl(var(--ink-soft))]">{dateStrB}</div>
              <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                <div>Steps: <span className="font-bold">{runB.stepCount}</span></div>
                <div>
                  Duration: <span className="font-bold">{runB.durationMs}ms</span>{" "}
                  <span className={`text-[9px] ${durationDelta > 0 ? "text-[hsl(var(--issue))]" : "text-emerald-600"}`}>
                    ({durationDelta >= 0 ? `+${durationDelta}` : durationDelta}ms / {durationPercent > 0 ? `+${durationPercent}` : durationPercent}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Side-by-Side Per-Step Execution Comparison */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono">
          <div className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[hsl(var(--ink-soft))] mb-1">
            Step-by-Step Execution Diff ({maxSteps} total steps)
          </div>

          {stepIndices.map((idx) => {
            const logA = runA.logs[idx];
            const logB = runB.logs[idx];
            const isExpanded = !!expandedSteps[idx];

            const stepNameA = logA ? logA.name : "N/A";
            const stepNameB = logB ? logB.name : "N/A";

            const nameDiffers = logA && logB && logA.name !== logB.name;
            const outputDiffers =
              logA && logB && JSON.stringify(logA.output) !== JSON.stringify(logB.output);
            const statusDiffers =
              logA && logB && !!logA.error !== !!logB.error;

            const isDiff = nameDiffers || outputDiffers || statusDiffers || !logA || !logB;

            return (
              <div
                key={idx}
                className={`border border-dashed p-3 space-y-2 transition-all ${
                  isDiff
                    ? "border-[hsl(var(--edge-selected))] bg-[hsl(var(--edge-selected)/0.02)]"
                    : "border-[hsl(var(--grid-line))] bg-[hsl(var(--paper))]"
                }`}
              >
                {/* Step header bar */}
                <div className="flex items-center justify-between flex-wrap gap-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[hsl(var(--ink-faint))]">Step #{idx + 1}</span>
                    <span className="font-semibold text-[hsl(var(--ink))]">
                      {stepNameA === stepNameB ? stepNameA : `${stepNameA} vs ${stepNameB}`}
                    </span>
                    {isDiff && (
                      <span className="text-[9px] px-1.5 py-0.2 bg-[hsl(var(--edge-selected))] text-[hsl(var(--paper))] uppercase font-bold tracking-wider">
                        diff detected
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleStep(idx)}
                    className="text-[9.5px] uppercase font-semibold text-[hsl(var(--ink-soft))] hover:text-[hsl(var(--ink))] flex items-center gap-1"
                  >
                    <span>{isExpanded ? "▲ Hide State Snapshots" : "▼ Inspect Details & Snapshots"}</span>
                  </button>
                </div>

                {/* Side-by-side log details */}
                <div className="grid grid-cols-2 gap-3 text-[10px] border-t border-dotted border-[hsl(var(--grid-line))] pt-2">
                  {/* Log A */}
                  <div className="space-y-1">
                    <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))] flex justify-between">
                      <span>Run A Output</span>
                      <span>{logA ? `${logA.ms}ms` : "-"}</span>
                    </div>
                    {logA ? (
                      logA.error ? (
                        <pre className="p-2 bg-[hsl(var(--issue)/0.08)] border border-dashed border-[hsl(var(--issue))] text-[hsl(var(--issue))] text-[9.5px] whitespace-pre-wrap">
                          {logA.error}
                        </pre>
                      ) : (
                        <pre className="p-2 bg-[hsl(var(--ink)/0.02)] border border-dashed border-[hsl(var(--grid-line))] text-[hsl(var(--ink))] text-[9.5px] max-h-36 overflow-auto whitespace-pre">
                          {typeof logA.output === "string" ? logA.output : JSON.stringify(logA.output, null, 2)}
                        </pre>
                      )
                    ) : (
                      <div className="p-2 text-[hsl(var(--ink-faint))] italic">Step omitted in Run A</div>
                    )}

                    {isExpanded && logA?.stateSnapshot && (
                      <div className="pt-1.5">
                        <span className="text-[8.5px] uppercase tracking-wider text-[hsl(var(--ink-soft))] font-semibold">
                          Run A State Snapshot:
                        </span>
                        <pre className="mt-1 p-2 bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--grid-line))] text-[9px] max-h-40 overflow-auto whitespace-pre">
                          {JSON.stringify(logA.stateSnapshot, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Log B */}
                  <div className="space-y-1">
                    <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))] flex justify-between">
                      <span>Run B Output</span>
                      <span>{logB ? `${logB.ms}ms` : "-"}</span>
                    </div>
                    {logB ? (
                      logB.error ? (
                        <pre className="p-2 bg-[hsl(var(--issue)/0.08)] border border-dashed border-[hsl(var(--issue))] text-[hsl(var(--issue))] text-[9.5px] whitespace-pre-wrap">
                          {logB.error}
                        </pre>
                      ) : (
                        <pre className="p-2 bg-[hsl(var(--ink)/0.02)] border border-dashed border-[hsl(var(--grid-line))] text-[hsl(var(--ink))] text-[9.5px] max-h-36 overflow-auto whitespace-pre">
                          {typeof logB.output === "string" ? logB.output : JSON.stringify(logB.output, null, 2)}
                        </pre>
                      )
                    ) : (
                      <div className="p-2 text-[hsl(var(--ink-faint))] italic">Step omitted in Run B</div>
                    )}

                    {isExpanded && logB?.stateSnapshot && (
                      <div className="pt-1.5">
                        <span className="text-[8.5px] uppercase tracking-wider text-[hsl(var(--ink-soft))] font-semibold">
                          Run B State Snapshot:
                        </span>
                        <pre className="mt-1 p-2 bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--grid-line))] text-[9px] max-h-40 overflow-auto whitespace-pre">
                          {JSON.stringify(logB.stateSnapshot, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
