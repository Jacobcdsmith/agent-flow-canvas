import { useState, useMemo } from "react";
import { RunLog } from "./runFlow";
import { WorkflowRun, loadRunHistory } from "./runHistory";

interface RunComparisonModalProps {
  workflowId: string | null;
  currentLogs?: RunLog[] | null;
  onClose: () => void;
}

export function RunComparisonModal({
  workflowId,
  currentLogs,
  onClose,
}: RunComparisonModalProps) {
  const history = useMemo(() => loadRunHistory(workflowId), [workflowId]);

  // Construct synthetic "Current Run" if available
  const allRuns = useMemo(() => {
    const list: WorkflowRun[] = [...history];
    if (currentLogs && currentLogs.length > 0) {
      const currentRunObj: WorkflowRun = {
        id: "current_active_run",
        workflowId: workflowId || "default",
        runAt: Date.now(),
        durationMs: currentLogs.reduce((acc, l) => acc + l.ms, 0),
        stepCount: currentLogs.length,
        status: currentLogs.some((l) => l.error) ? "error" : "pass",
        logs: currentLogs,
      };
      return [currentRunObj, ...list];
    }
    return list;
  }, [history, currentLogs, workflowId]);

  const [runAId, setRunAId] = useState<string>(() => allRuns[0]?.id || "");
  const [runBId, setRunBId] = useState<string>(() => allRuns[1]?.id || allRuns[0]?.id || "");

  const runA = useMemo(() => allRuns.find((r) => r.id === runAId) || null, [allRuns, runAId]);
  const runB = useMemo(() => allRuns.find((r) => r.id === runBId) || null, [allRuns, runBId]);

  // Max steps to render in diff table
  const maxStepsCount = Math.max(runA?.logs.length || 0, runB?.logs.length || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--ink)/0.5)] backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] w-full max-w-4xl flex flex-col shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              Execution Run Comparison
            </div>
            <h2 className="font-mono text-sm font-semibold text-[hsl(var(--ink))]">
              Compare Workflow Execution Runs Side-by-Side
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            × Close
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto font-mono text-[11px]">
          {allRuns.length < 2 && (!currentLogs || currentLogs.length === 0) ? (
            <div className="p-6 text-center border border-dashed border-[hsl(var(--grid-line))] text-[hsl(var(--ink-soft))] space-y-2">
              <div className="text-base font-semibold">Not Enough Execution Runs</div>
              <p className="text-[10px]">Execute the workflow at least twice to enable side-by-side run comparisons.</p>
            </div>
          ) : (
            <>
              {/* Run Selectors */}
              <div className="grid grid-cols-2 gap-4 border-b border-dashed border-[hsl(var(--grid-line))] pb-3">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] font-semibold block">
                    Run A (Base Run)
                  </span>
                  <select
                    value={runAId}
                    onChange={(e) => setRunAId(e.target.value)}
                    className="w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink))] p-1.5 font-mono text-[10px] outline-none"
                  >
                    {allRuns.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id === "current_active_run"
                          ? "● Current Run (Active)"
                          : `${r.status === "pass" ? "✓" : "✗"} ${new Date(r.runAt).toLocaleTimeString()} (${r.durationMs}ms, ${r.stepCount} steps)`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] font-semibold block">
                    Run B (Comparison Run)
                  </span>
                  <select
                    value={runBId}
                    onChange={(e) => setRunBId(e.target.value)}
                    className="w-full bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink))] p-1.5 font-mono text-[10px] outline-none"
                  >
                    {allRuns.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id === "current_active_run"
                          ? "● Current Run (Active)"
                          : `${r.status === "pass" ? "✓" : "✗"} ${new Date(r.runAt).toLocaleTimeString()} (${r.durationMs}ms, ${r.stepCount} steps)`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Side-by-Side Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Run A Card */}
                <div className="p-3 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--paper))] space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[hsl(var(--ink))]">
                      {runA?.id === "current_active_run" ? "Current Run" : "Run A"}
                    </span>
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.2 font-bold border ${
                        runA?.status === "pass"
                          ? "text-emerald-700 dark:text-emerald-400 border-emerald-600"
                          : "text-[hsl(var(--issue))] border-[hsl(var(--issue))]"
                      }`}
                    >
                      {runA?.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[10px] text-[hsl(var(--ink-soft))]">
                    Duration: <span className="font-bold text-[hsl(var(--ink))]">{runA?.durationMs}ms</span> · Steps:{" "}
                    <span className="font-bold text-[hsl(var(--ink))]">{runA?.stepCount}</span>
                  </div>
                </div>

                {/* Run B Card */}
                <div className="p-3 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--paper))] space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[hsl(var(--ink))]">
                      {runB?.id === "current_active_run" ? "Current Run" : "Run B"}
                    </span>
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.2 font-bold border ${
                        runB?.status === "pass"
                          ? "text-emerald-700 dark:text-emerald-400 border-emerald-600"
                          : "text-[hsl(var(--issue))] border-[hsl(var(--issue))]"
                      }`}
                    >
                      {runB?.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[10px] text-[hsl(var(--ink-soft))]">
                    Duration: <span className="font-bold text-[hsl(var(--ink))]">{runB?.durationMs}ms</span>
                    {runA && runB && (
                      <span className="ml-1 text-[9px] font-semibold text-[hsl(var(--ink-soft))]">
                        ({runB.durationMs - runA.durationMs >= 0 ? "+" : ""}
                        {runB.durationMs - runA.durationMs}ms delta)
                      </span>
                    )}
                    {" · "}Steps: <span className="font-bold text-[hsl(var(--ink))]">{runB?.stepCount}</span>
                  </div>
                </div>
              </div>

              {/* Step-by-Step Side-by-Side Diff Table */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] font-semibold block">
                  Step-by-Step Execution Diff
                </span>
                <div className="border border-dashed border-[hsl(var(--grid-line))] max-h-72 overflow-y-auto">
                  <table className="w-full text-left font-mono text-[10px]">
                    <thead className="bg-[hsl(var(--ink)/0.03)] border-b border-dashed border-[hsl(var(--grid-line))] sticky top-0">
                      <tr>
                        <th className="p-1.5 w-12">Step</th>
                        <th className="p-1.5 w-1/2 border-r border-dashed border-[hsl(var(--grid-line))]">
                          Run A Step Details
                        </th>
                        <th className="p-1.5 w-1/2">Run B Step Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dotted divide-[hsl(var(--grid-line))]">
                      {Array.from({ length: maxStepsCount }).map((_, idx) => {
                        const logA = runA?.logs[idx];
                        const logB = runB?.logs[idx];
                        const isDiff =
                          logA?.name !== logB?.name ||
                          logA?.error !== logB?.error ||
                          Math.abs((logA?.ms || 0) - (logB?.ms || 0)) > 100;

                        return (
                          <tr
                            key={idx}
                            className={isDiff ? "bg-[hsl(var(--accent-deep)/0.03)]" : "hover:bg-[hsl(var(--ink)/0.02)]"}
                          >
                            <td className="p-1.5 font-bold text-[hsl(var(--ink-faint))] align-top">#{idx + 1}</td>

                            {/* Run A Cell */}
                            <td className="p-1.5 border-r border-dashed border-[hsl(var(--grid-line))] align-top">
                              {logA ? (
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-[hsl(var(--ink))]">
                                    {logA.name} <span className="uppercase text-[8px] text-[hsl(var(--ink-soft))]">({logA.kind})</span>
                                  </div>
                                  <div className="text-[9px] text-[hsl(var(--ink-faint))]">{logA.ms}ms</div>
                                  {logA.error ? (
                                    <div className="text-[9px] text-[hsl(var(--issue))]">{logA.error}</div>
                                  ) : (
                                    <pre className="text-[8px] text-[hsl(var(--ink-soft))] max-h-12 overflow-hidden truncate">
                                      {typeof logA.output === "string" ? logA.output : JSON.stringify(logA.output)}
                                    </pre>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[hsl(var(--ink-faint))] italic">—</span>
                              )}
                            </td>

                            {/* Run B Cell */}
                            <td className="p-1.5 align-top">
                              {logB ? (
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-[hsl(var(--ink))]">
                                    {logB.name} <span className="uppercase text-[8px] text-[hsl(var(--ink-soft))]">({logB.kind})</span>
                                  </div>
                                  <div className="text-[9px] text-[hsl(var(--ink-faint))]">{logB.ms}ms</div>
                                  {logB.error ? (
                                    <div className="text-[9px] text-[hsl(var(--issue))]">{logB.error}</div>
                                  ) : (
                                    <pre className="text-[8px] text-[hsl(var(--ink-soft))] max-h-12 overflow-hidden truncate">
                                      {typeof logB.output === "string" ? logB.output : JSON.stringify(logB.output)}
                                    </pre>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[hsl(var(--ink-faint))] italic">—</span>
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
