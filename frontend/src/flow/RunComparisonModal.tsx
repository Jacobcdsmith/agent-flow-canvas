import { useState } from "react";
import { ExecutionRunRecord } from "./runHistory";

interface RunComparisonModalProps {
  runs: ExecutionRunRecord[];
  onClose: () => void;
}

export function RunComparisonModal({ runs, onClose }: RunComparisonModalProps) {
  const [runAId, setRunAId] = useState<string>(runs[0]?.id || "");
  const [runBId, setRunBId] = useState<string>(runs[1]?.id || runs[0]?.id || "");

  const runA = runs.find((r) => r.id === runAId);
  const runB = runs.find((r) => r.id === runBId);

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const maxSteps = Math.max(runA?.logs.length || 0, runB?.logs.length || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--ink)/0.5)] backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] shadow-xl flex flex-col max-h-[90vh] font-mono">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              Execution Benchmark & Diff
            </div>
            <h2 className="text-sm font-semibold text-[hsl(var(--ink))] mt-0.5">
              Compare Execution Runs
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[11px] px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            Close ✕
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {runs.length < 2 && (
            <div className="p-3 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.02)] text-[11px] text-[hsl(var(--ink-soft))]">
              ℹ Run at least 2 executions to perform side-by-side comparison across runs.
            </div>
          )}

          {/* Selector bar */}
          <div className="grid grid-cols-2 gap-4 border-b border-dashed border-[hsl(var(--grid-line))] pb-4">
            {/* Run A Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] font-semibold block">
                Run A (Baseline)
              </label>
              <select
                value={runAId}
                onChange={(e) => setRunAId(e.target.value)}
                className="w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink))] text-[11px] p-1.5 outline-none"
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatTime(r.timestamp)} - {r.status.toUpperCase()} ({r.durationMs}ms, {r.stepCount} steps)
                  </option>
                ))}
              </select>
            </div>

            {/* Run B Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] font-semibold block">
                Run B (Comparison)
              </label>
              <select
                value={runBId}
                onChange={(e) => setRunBId(e.target.value)}
                className="w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink))] text-[11px] p-1.5 outline-none"
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatTime(r.timestamp)} - {r.status.toUpperCase()} ({r.durationMs}ms, {r.stepCount} steps)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Metric Diff Overview Table */}
          {runA && runB && (
            <div className="space-y-3">
              <div className="text-[11px] font-semibold text-[hsl(var(--ink))] uppercase tracking-wider">
                Metrics Overview
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                {/* Duration */}
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-2 bg-[hsl(var(--ink)/0.01)] space-y-1">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">
                    Total Duration
                  </div>
                  <div className="flex justify-center items-center gap-2">
                    <span className="font-semibold">{runA.durationMs}ms</span>
                    <span className="text-[hsl(var(--ink-faint))]">➔</span>
                    <span className="font-semibold">{runB.durationMs}ms</span>
                  </div>
                  <div className="text-[9px]">
                    {runB.durationMs - runA.durationMs === 0 ? (
                      <span className="text-[hsl(var(--ink-faint))]">no change</span>
                    ) : runB.durationMs < runA.durationMs ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                        ↓ {runA.durationMs - runB.durationMs}ms faster
                      </span>
                    ) : (
                      <span className="text-[hsl(var(--issue))] font-bold">
                        ↑ {runB.durationMs - runA.durationMs}ms slower
                      </span>
                    )}
                  </div>
                </div>

                {/* Step Count */}
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-2 bg-[hsl(var(--ink)/0.01)] space-y-1">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">
                    Steps Count
                  </div>
                  <div className="flex justify-center items-center gap-2">
                    <span className="font-semibold">{runA.stepCount}</span>
                    <span className="text-[hsl(var(--ink-faint))]">➔</span>
                    <span className="font-semibold">{runB.stepCount}</span>
                  </div>
                  <div className="text-[9px]">
                    {runB.stepCount === runA.stepCount ? (
                      <span className="text-[hsl(var(--ink-faint))]">same step count</span>
                    ) : (
                      <span className="text-[hsl(var(--ink))] font-bold">
                        {runB.stepCount - runA.stepCount > 0 ? "+" : ""}
                        {runB.stepCount - runA.stepCount} steps
                      </span>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-2 bg-[hsl(var(--ink)/0.01)] space-y-1">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">
                    Execution Outcome
                  </div>
                  <div className="flex justify-center items-center gap-2">
                    <span
                      className={`font-semibold px-1 ${
                        runA.status === "pass" ? "text-emerald-700" : "text-[hsl(var(--issue))]"
                      }`}
                    >
                      {runA.status.toUpperCase()}
                    </span>
                    <span className="text-[hsl(var(--ink-faint))]">➔</span>
                    <span
                      className={`font-semibold px-1 ${
                        runB.status === "pass" ? "text-emerald-700" : "text-[hsl(var(--issue))]"
                      }`}
                    >
                      {runB.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[9px] text-[hsl(var(--ink-faint))]">
                    {runA.status === runB.status ? "matched status" : "status changed"}
                  </div>
                </div>
              </div>

              {/* Side-by-side Final Output */}
              <div className="space-y-1.5 pt-2">
                <div className="text-[11px] font-semibold text-[hsl(var(--ink))] uppercase tracking-wider">
                  Final Output Comparison
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <pre className="p-2.5 bg-[hsl(var(--ink)/0.02)] border border-dashed border-[hsl(var(--grid-line))] text-[10px] max-h-36 overflow-auto whitespace-pre-wrap">
                    {typeof runA.finalOutput === "string"
                      ? runA.finalOutput
                      : JSON.stringify(runA.finalOutput, null, 2)}
                  </pre>
                  <pre className="p-2.5 bg-[hsl(var(--ink)/0.02)] border border-dashed border-[hsl(var(--grid-line))] text-[10px] max-h-36 overflow-auto whitespace-pre-wrap">
                    {typeof runB.finalOutput === "string"
                      ? runB.finalOutput
                      : JSON.stringify(runB.finalOutput, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Step-by-Step Timeline Diff */}
              <div className="space-y-1.5 pt-2">
                <div className="text-[11px] font-semibold text-[hsl(var(--ink))] uppercase tracking-wider">
                  Step-by-Step Execution Diff
                </div>
                <div className="border border-dashed border-[hsl(var(--grid-line))] divide-y divide-dashed divide-[hsl(var(--grid-line))]">
                  {Array.from({ length: maxSteps }).map((_, idx) => {
                    const stepA = runA.logs[idx];
                    const stepB = runB.logs[idx];

                    return (
                      <div key={idx} className="p-2 grid grid-cols-2 gap-4 text-[10px]">
                        {/* Step A */}
                        <div className="space-y-1">
                          {stepA ? (
                            <>
                              <div className="flex items-center justify-between font-bold">
                                <span>
                                  #{stepA.step} {stepA.name} ({stepA.kind})
                                </span>
                                <span className="text-[hsl(var(--ink-faint))]">{stepA.ms}ms</span>
                              </div>
                              <div className="text-[hsl(var(--ink-soft))] text-[9px]">
                                → {stepA.label}
                              </div>
                              <pre className="p-1.5 bg-[hsl(var(--ink)/0.02)] border border-dashed border-[hsl(var(--grid-line))] max-h-24 overflow-auto whitespace-pre-wrap text-[9px]">
                                {stepA.error
                                  ? `ERROR: ${stepA.error}`
                                  : typeof stepA.output === "string"
                                  ? stepA.output
                                  : JSON.stringify(stepA.output, null, 2)}
                              </pre>
                            </>
                          ) : (
                            <span className="text-[hsl(var(--ink-faint))] italic">
                              -- No Step #{idx + 1} --
                            </span>
                          )}
                        </div>

                        {/* Step B */}
                        <div className="space-y-1">
                          {stepB ? (
                            <>
                              <div className="flex items-center justify-between font-bold">
                                <span>
                                  #{stepB.step} {stepB.name} ({stepB.kind})
                                </span>
                                <span className="text-[hsl(var(--ink-faint))]">{stepB.ms}ms</span>
                              </div>
                              <div className="text-[hsl(var(--ink-soft))] text-[9px]">
                                → {stepB.label}
                              </div>
                              <pre className="p-1.5 bg-[hsl(var(--ink)/0.02)] border border-dashed border-[hsl(var(--grid-line))] max-h-24 overflow-auto whitespace-pre-wrap text-[9px]">
                                {stepB.error
                                  ? `ERROR: ${stepB.error}`
                                  : typeof stepB.output === "string"
                                  ? stepB.output
                                  : JSON.stringify(stepB.output, null, 2)}
                              </pre>
                            </>
                          ) : (
                            <span className="text-[hsl(var(--ink-faint))] italic">
                              -- No Step #{idx + 1} --
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
