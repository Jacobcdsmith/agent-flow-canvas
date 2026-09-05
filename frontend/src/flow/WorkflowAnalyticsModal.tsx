import { useMemo, useState } from "react";
import type { Node, Edge } from "reactflow";
import type { AgentNodeData } from "./types";
import type { RunLog } from "./runFlow";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  runLogs: RunLog[] | null;
  nodes: Node<AgentNodeData>[];
  edges: Edge[];
}

export function WorkflowAnalyticsModal({
  isOpen,
  onClose,
  runLogs,
  nodes,
  edges,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"step" | "ms" | "name">("step");
  const [sortAsc, setSortAsc] = useState(true);

  const logs = useMemo(() => runLogs ?? [], [runLogs]);

  // Performance calculations
  const totalMs = useMemo(() => logs.reduce((acc, l) => acc + l.ms, 0), [logs]);
  const avgMs = useMemo(() => (logs.length > 0 ? Math.round(totalMs / logs.length) : 0), [logs, totalMs]);
  const errorCount = useMemo(() => logs.filter((l) => l.error).length, [logs]);
  const llmCount = useMemo(() => logs.filter((l) => l.kind === "llm").length, [logs]);

  // Token & cost estimation heuristic (~4 chars per token for LLM prompts/responses)
  const tokenMetrics = useMemo(() => {
    let charCount = 0;
    logs.forEach((l) => {
      if (l.kind === "llm" && l.output) {
        if (typeof l.output === "string") {
          charCount += l.output.length;
        } else if (typeof l.output === "object" && l.output !== null) {
          charCount += JSON.stringify(l.output).length;
        }
      }
    });
    const estimatedTokens = Math.round(charCount / 4);
    const estimatedCostUsd = (estimatedTokens * 0.000002).toFixed(5);
    return { estimatedTokens, estimatedCostUsd };
  }, [logs]);

  // Bottleneck detection
  const bottlenecks = useMemo(() => {
    if (logs.length === 0) return [];
    const sorted = [...logs].sort((a, b) => b.ms - a.ms);
    const topSlow = sorted.slice(0, 2).filter((l) => l.ms > 100);
    return topSlow.map((l) => {
      let rec = "Optimize processing or response handling.";
      if (l.kind === "llm") {
        rec = "Consider lowering temperature or max_tokens, or selecting a faster provider profile.";
      } else if (l.kind === "http") {
        rec = "Ensure external API latency is acceptable and consider caching responses.";
      } else if (l.kind === "subagent") {
        rec = "Review subagent workflow depth and optimize child graph execution steps.";
      }
      return { log: l, recommendation: rec };
    });
  }, [logs]);

  // Filtered and sorted logs
  const filteredLogs = useMemo(() => {
    let list = [...logs];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.kind.toLowerCase().includes(q) ||
          (l.error && l.error.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "step") cmp = a.step - b.step;
      else if (sortField === "ms") cmp = a.ms - b.ms;
      else if (sortField === "name") cmp = a.name.localeCompare(b.name);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [logs, searchQuery, sortField, sortAsc]);

  const handleCopyReport = () => {
    if (logs.length === 0) {
      toast.error("No execution logs to report");
      return;
    }
    const reportText = [
      `=== WORKFLOW PERFORMANCE REPORT ===`,
      `Total Steps: ${logs.length}`,
      `Total Duration: ${totalMs} ms`,
      `Average Latency: ${avgMs} ms / step`,
      `Errors: ${errorCount}`,
      `Estimated LLM Tokens: ${tokenMetrics.estimatedTokens}`,
      `Estimated Cost: $${tokenMetrics.estimatedCostUsd}`,
      ``,
      `--- BOTTLENECKS ---`,
      ...bottlenecks.map(
        (b) => `• Step #${b.log.step} "${b.log.name}" (${b.log.kind}): ${b.log.ms} ms -> ${b.recommendation}`
      ),
    ].join("\n");

    navigator.clipboard.writeText(reportText).then(() => {
      toast.success("Performance report copied to clipboard");
    });
  };

  const handleExportCsv = () => {
    if (logs.length === 0) {
      toast.error("No execution logs to export");
      return;
    }
    const headers = ["Step", "Node ID", "Name", "Kind", "Label", "Duration (ms)", "Status", "Error"];
    const rows = logs.map((l) => [
      l.step,
      `"${l.nodeId}"`,
      `"${l.name}"`,
      `"${l.kind}"`,
      `"${l.label}"`,
      l.ms,
      l.error ? "ERROR" : "PASS",
      `"${(l.error || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workflow_performance_analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported performance analytics CSV");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--ink)/0.5)] backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] shadow-xl flex flex-col max-h-[85vh] font-mono text-[11px] overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <div>
              <h2 className="font-semibold text-[13px] text-[hsl(var(--ink))]">
                Workflow Performance Profiler & Analytics
              </h2>
              <div className="text-[9px] uppercase tracking-[0.15em] text-[hsl(var(--ink-faint))]">
                {nodes.length} nodes · {edges.length} edges · {logs.length} run steps
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            × Close
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {logs.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-[hsl(var(--grid-line))] space-y-2">
              <span className="text-2xl block">⚡</span>
              <div className="font-semibold text-[hsl(var(--ink))]">No Execution Run Logs Available</div>
              <p className="text-[10px] text-[hsl(var(--ink-soft))] max-w-md mx-auto">
                Run the workflow canvas using the "▶ run" or Stepper button to analyze execution latency, detect slow node bottlenecks, and estimate token costs.
              </p>
            </div>
          ) : (
            <>
              {/* Summary Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-2.5 bg-[hsl(var(--ink)/0.02)]">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Total Duration</div>
                  <div className="text-sm font-bold text-[hsl(var(--ink))] mt-0.5">{totalMs} ms</div>
                </div>
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-2.5 bg-[hsl(var(--ink)/0.02)]">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Avg Step Latency</div>
                  <div className="text-sm font-bold text-[hsl(var(--ink))] mt-0.5">{avgMs} ms</div>
                </div>
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-2.5 bg-[hsl(var(--ink)/0.02)]">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Estimated Tokens</div>
                  <div className="text-sm font-bold text-[hsl(var(--ink))] mt-0.5">{tokenMetrics.estimatedTokens} tkns</div>
                </div>
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-2.5 bg-[hsl(var(--ink)/0.02)]">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Estimated Cost</div>
                  <div className="text-sm font-bold text-[hsl(var(--ink))] mt-0.5">${tokenMetrics.estimatedCostUsd}</div>
                </div>
              </div>

              {/* Bottleneck & Slow Node Detection */}
              {bottlenecks.length > 0 && (
                <div className="border border-dashed border-[hsl(var(--issue))] p-3 space-y-2 bg-[hsl(var(--issue)/0.03)]">
                  <div className="flex items-center gap-2 font-semibold text-[hsl(var(--issue))] uppercase tracking-wider text-[10px]">
                    <span>⚠️ Bottleneck & Slow Node Recommendations</span>
                  </div>
                  <div className="space-y-1.5">
                    {bottlenecks.map((b) => (
                      <div key={`${b.log.step}-${b.log.nodeId}`} className="text-[10px] space-y-0.5">
                        <div className="flex items-center justify-between font-semibold text-[hsl(var(--ink))]">
                          <span>
                            Step #{b.log.step}: {b.log.name} ({b.log.kind})
                          </span>
                          <span className="text-[hsl(var(--issue))]">{b.log.ms} ms</span>
                        </div>
                        <p className="text-[hsl(var(--ink-soft))] leading-tight pl-2 border-l border-dashed border-[hsl(var(--issue))]">
                          {b.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step Performance Breakdown Table */}
              <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-2 bg-[hsl(var(--paper))]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-semibold text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--ink-soft))]">
                    Per-Node Execution Table
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search node or kind..."
                    className="bg-transparent border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-0.5 px-2 text-[10px]"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.03)] text-[hsl(var(--ink-soft))] uppercase tracking-wider">
                        <th
                          className="p-1.5 cursor-pointer hover:underline"
                          onClick={() => {
                            if (sortField === "step") setSortAsc(!sortAsc);
                            else { setSortField("step"); setSortAsc(true); }
                          }}
                        >
                          Step {sortField === "step" ? (sortAsc ? "▲" : "▼") : ""}
                        </th>
                        <th
                          className="p-1.5 cursor-pointer hover:underline"
                          onClick={() => {
                            if (sortField === "name") setSortAsc(!sortAsc);
                            else { setSortField("name"); setSortAsc(true); }
                          }}
                        >
                          Node Name {sortField === "name" ? (sortAsc ? "▲" : "▼") : ""}
                        </th>
                        <th className="p-1.5">Kind</th>
                        <th className="p-1.5">Label</th>
                        <th
                          className="p-1.5 cursor-pointer hover:underline text-right"
                          onClick={() => {
                            if (sortField === "ms") setSortAsc(!sortAsc);
                            else { setSortField("ms"); setSortAsc(false); }
                          }}
                        >
                          Duration {sortField === "ms" ? (sortAsc ? "▲" : "▼") : ""}
                        </th>
                        <th className="p-1.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dashed divide-[hsl(var(--grid-line))]">
                      {filteredLogs.map((l) => (
                        <tr key={`${l.step}-${l.nodeId}`} className="hover:bg-[hsl(var(--ink)/0.02)]">
                          <td className="p-1.5 text-[hsl(var(--ink-faint))]">#{l.step}</td>
                          <td className="p-1.5 font-semibold text-[hsl(var(--ink))]">{l.name}</td>
                          <td className="p-1.5 uppercase tracking-wider text-[hsl(var(--ink-soft))] text-[9px]">
                            {l.kind}
                          </td>
                          <td className="p-1.5 text-[hsl(var(--ink-soft))]">{l.label}</td>
                          <td className="p-1.5 text-right font-semibold">{l.ms} ms</td>
                          <td className="p-1.5 text-center">
                            {l.error ? (
                              <span className="text-[hsl(var(--issue))] font-bold">FAIL ✗</span>
                            ) : (
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold">PASS ✓</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--ink)/0.02)]">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReport}
              disabled={logs.length === 0}
              className="font-mono text-[10px] uppercase tracking-wider px-3 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] disabled:opacity-40 transition-colors"
            >
              📋 Copy Report
            </button>
            <button
              onClick={handleExportCsv}
              disabled={logs.length === 0}
              className="font-mono text-[10px] uppercase tracking-wider px-3 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] disabled:opacity-40 transition-colors"
            >
              📥 Export CSV
            </button>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[10px] uppercase tracking-wider px-3 py-1 border border-dashed border-[hsl(var(--ink))] bg-[hsl(var(--paper))]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
