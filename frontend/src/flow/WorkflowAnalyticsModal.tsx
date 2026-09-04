import { useState, useMemo } from "react";
import { toast } from "sonner";
import { RunLog } from "./runFlow";

interface WorkflowAnalyticsModalProps {
  runLogs: RunLog[];
  onClose: () => void;
}

export function WorkflowAnalyticsModal({ runLogs, onClose }: WorkflowAnalyticsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"step" | "ms">("step");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Computed metrics
  const totalMs = useMemo(() => runLogs.reduce((acc, l) => acc + l.ms, 0), [runLogs]);
  const avgMs = useMemo(() => (runLogs.length ? Math.round(totalMs / runLogs.length) : 0), [totalMs, runLogs]);

  // Bottleneck detection
  const slowestLog = useMemo(() => {
    if (!runLogs.length) return null;
    return [...runLogs].sort((a, b) => b.ms - a.ms)[0];
  }, [runLogs]);

  // Token and cost estimation
  const llmMetrics = useMemo(() => {
    const llmLogs = runLogs.filter((l) => l.kind === "llm");
    let estimatedTokens = 0;
    llmLogs.forEach((l) => {
      let charCount = 0;
      if (typeof l.output === "string") {
        charCount += l.output.length;
      } else if (l.output && typeof l.output === "object") {
        charCount += JSON.stringify(l.output).length;
      }
      estimatedTokens += Math.max(20, Math.round(charCount / 4));
    });
    // Approx $0.00015 per 1k tokens (blended input/output mini model rate)
    const estimatedCost = (estimatedTokens / 1000) * 0.00015;
    return {
      callCount: llmLogs.length,
      tokens: estimatedTokens,
      costFormatted: `$${estimatedCost.toFixed(5)}`,
    };
  }, [runLogs]);

  // Recommendations
  const recommendations = useMemo(() => {
    const recs: string[] = [];
    if (!slowestLog) return recs;

    if (slowestLog.ms > totalMs * 0.4 && totalMs > 500) {
      recs.push(
        `Node "${slowestLog.name}" (${slowestLog.kind}) accounts for ${Math.round((slowestLog.ms / totalMs) * 100)}% of total execution time. Consider caching or optimizing this step.`
      );
    }
    if (slowestLog.kind === "http") {
      recs.push(`HTTP Request node "${slowestLog.name}" is the primary latency bottleneck (${slowestLog.ms}ms). Verify endpoint response time and consider response payload trimming.`);
    }
    if (llmMetrics.callCount > 3) {
      recs.push(`Multiple LLM calls detected (${llmMetrics.callCount}). Batch prompts or reuse step states to reduce API latency and token cost.`);
    }
    if (recs.length === 0) {
      recs.push("Workflow execution is highly optimized! All step latencies are within expected bounds.");
    }
    return recs;
  }, [slowestLog, totalMs, llmMetrics]);

  // Filtered and sorted logs
  const processedLogs = useMemo(() => {
    let list = runLogs.filter((l) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.kind.toLowerCase().includes(q) ||
        (l.error ? l.error.toLowerCase().includes(q) : false)
      );
    });

    list.sort((a, b) => {
      const mult = sortOrder === "asc" ? 1 : -1;
      if (sortField === "ms") return (a.ms - b.ms) * mult;
      return (a.step - b.step) * mult;
    });

    return list;
  }, [runLogs, searchQuery, sortField, sortOrder]);

  const handleCopySummary = () => {
    const text = [
      `=== WORKFLOW PERFORMANCE PROFILER REPORT ===`,
      `Total Steps: ${runLogs.length}`,
      `Total Duration: ${totalMs}ms (${(totalMs / 1000).toFixed(2)}s)`,
      `Average Step Latency: ${avgMs}ms`,
      `Slowest Node: ${slowestLog ? `${slowestLog.name} (${slowestLog.ms}ms)` : "N/A"}`,
      `LLM Calls: ${llmMetrics.callCount} (~${llmMetrics.tokens} est. tokens, est. cost ${llmMetrics.costFormatted})`,
      `\nRecommendations:`,
      ...recommendations.map((r) => `- ${r}`),
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      toast.success("Performance summary report copied to clipboard");
    });
  };

  const handleExportCSV = () => {
    const header = ["Step", "Node Name", "Kind", "Label", "Duration (ms)", "Status", "Error"];
    const rows = runLogs.map((l) => [
      l.step,
      `"${l.name.replace(/"/g, '""')}"`,
      l.kind,
      l.label,
      l.ms,
      l.error ? "ERROR" : "SUCCESS",
      `"${(l.error || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow_analytics_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Performance CSV report exported");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--ink)/0.5)] backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] w-full max-w-3xl flex flex-col shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              Performance Profiler & Analytics
            </div>
            <h2 className="font-mono text-sm font-semibold text-[hsl(var(--ink))]">
              Workflow Execution Insights ({runLogs.length} Steps)
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
          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--paper))]">
              <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Total Duration</div>
              <div className="text-sm font-bold text-[hsl(var(--ink))] mt-0.5">{totalMs}ms</div>
              <div className="text-[9px] text-[hsl(var(--ink-soft))]">{(totalMs / 1000).toFixed(2)} seconds</div>
            </div>

            <div className="p-2.5 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--paper))]">
              <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Avg Step Latency</div>
              <div className="text-sm font-bold text-[hsl(var(--ink))] mt-0.5">{avgMs}ms</div>
              <div className="text-[9px] text-[hsl(var(--ink-soft))]">{runLogs.length} total steps</div>
            </div>

            <div className="p-2.5 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--paper))]">
              <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Slowest Node</div>
              <div className="text-sm font-bold text-[hsl(var(--ink))] mt-0.5 truncate">
                {slowestLog ? slowestLog.name : "N/A"}
              </div>
              <div className="text-[9px] text-[hsl(var(--issue))] font-semibold">
                {slowestLog ? `${slowestLog.ms}ms` : "0ms"}
              </div>
            </div>

            <div className="p-2.5 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--paper))]">
              <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Est. LLM Cost</div>
              <div className="text-sm font-bold text-[hsl(var(--ink))] mt-0.5">{llmMetrics.costFormatted}</div>
              <div className="text-[9px] text-[hsl(var(--ink-soft))]">~{llmMetrics.tokens} est. tokens</div>
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div className="p-3 border border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.015)] space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] font-semibold flex items-center gap-1.5">
              <span>💡 Bottleneck Analysis & Recommendations</span>
            </div>
            <ul className="space-y-1 pl-4 list-disc text-[10px] text-[hsl(var(--ink))]">
              {recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>

          {/* Per-Node Performance Table Controls */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] font-semibold">
                Per-Node Step Metrics
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter nodes..."
                  className="bg-transparent border border-dashed border-[hsl(var(--grid-line))] px-2 py-0.5 font-mono text-[10px] outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="px-2 py-0.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
                >
                  📋 Copy Summary
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-2 py-0.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
                >
                  ↓ Export CSV
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="border border-dashed border-[hsl(var(--grid-line))] max-h-60 overflow-y-auto">
              <table className="w-full text-left font-mono text-[10px]">
                <thead className="bg-[hsl(var(--ink)/0.03)] border-b border-dashed border-[hsl(var(--grid-line))] sticky top-0">
                  <tr>
                    <th
                      className="p-1.5 cursor-pointer hover:bg-[hsl(var(--ink)/0.05)]"
                      onClick={() => {
                        if (sortField === "step") setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                        else { setSortField("step"); setSortOrder("asc"); }
                      }}
                    >
                      # {sortField === "step" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                    </th>
                    <th className="p-1.5">Node Name</th>
                    <th className="p-1.5">Kind</th>
                    <th
                      className="p-1.5 cursor-pointer hover:bg-[hsl(var(--ink)/0.05)]"
                      onClick={() => {
                        if (sortField === "ms") setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                        else { setSortField("ms"); setSortOrder("desc"); }
                      }}
                    >
                      Duration {sortField === "ms" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                    </th>
                    <th className="p-1.5">Latency Bar</th>
                    <th className="p-1.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dotted divide-[hsl(var(--grid-line))]">
                  {processedLogs.map((log) => {
                    const pct = totalMs > 0 ? Math.round((log.ms / totalMs) * 100) : 0;
                    return (
                      <tr key={`${log.step}-${log.nodeId}`} className="hover:bg-[hsl(var(--ink)/0.02)]">
                        <td className="p-1.5 font-bold text-[hsl(var(--ink-faint))]">#{log.step}</td>
                        <td className="p-1.5 font-semibold text-[hsl(var(--ink))]">{log.name}</td>
                        <td className="p-1.5 uppercase text-[9px] text-[hsl(var(--ink-soft))]">{log.kind}</td>
                        <td className="p-1.5 font-bold text-[hsl(var(--ink))]">{log.ms}ms</td>
                        <td className="p-1.5 w-32">
                          <div className="w-full bg-[hsl(var(--ink)/0.08)] h-2 rounded-none overflow-hidden relative">
                            <div
                              className="h-full"
                              style={{
                                width: `${Math.max(4, pct)}%`,
                                background: log.error
                                  ? "hsl(var(--issue))"
                                  : pct > 35
                                  ? "hsl(var(--accent-deep))"
                                  : "hsl(var(--ink))",
                              }}
                            />
                          </div>
                        </td>
                        <td className="p-1.5">
                          {log.error ? (
                            <span className="text-[hsl(var(--issue))] font-bold uppercase tracking-wider text-[8px]">
                              Error
                            </span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider text-[8px]">
                              Pass
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
