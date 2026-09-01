import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Node } from "reactflow";
import type { AgentNodeData } from "./types";
import type { RunLog } from "./runFlow";

interface WorkflowAnalyticsModalProps {
  isOpen: boolean;
  runLogs: RunLog[] | null;
  nodes: Node<AgentNodeData>[];
  onClose: () => void;
}

interface NodePerfStat {
  nodeId: string;
  name: string;
  kind: string;
  calls: number;
  totalMs: number;
  avgMs: number;
  percentTotal: number;
  errorCount: number;
}

export function WorkflowAnalyticsModal({
  isOpen,
  runLogs,
  nodes,
  onClose,
}: WorkflowAnalyticsModalProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [sortField, setSortField] = useState<"totalMs" | "calls" | "avgMs" | "name">("totalMs");
  const [sortAsc, setSortAsc] = useState(false);

  // Compute analytics statistics
  const analytics = useMemo(() => {
    if (!runLogs || runLogs.length === 0) return null;

    const totalSteps = runLogs.length;
    const totalDurationMs = runLogs.reduce((acc, l) => acc + l.ms, 0);
    const avgStepMs = totalSteps > 0 ? Math.round(totalDurationMs / totalSteps) : 0;
    const errorCount = runLogs.filter((l) => !!l.error).length;
    const isSuccess = errorCount === 0;

    // Aggregate by nodeId
    const nodeStatsMap = new Map<string, { name: string; kind: string; calls: number; totalMs: number; errorCount: number }>();

    let totalLlmChars = 0;
    let totalLlmOutputChars = 0;

    runLogs.forEach((log) => {
      if (log.nodeId && log.nodeId !== "_error" && log.nodeId !== "_runtime") {
        const existing = nodeStatsMap.get(log.nodeId) ?? {
          name: log.name,
          kind: log.kind,
          calls: 0,
          totalMs: 0,
          errorCount: 0,
        };
        existing.calls += 1;
        existing.totalMs += log.ms;
        if (log.error) existing.errorCount += 1;
        nodeStatsMap.set(log.nodeId, existing);
      }

      if (log.kind === "llm") {
        const outputText = typeof log.output === "string" ? log.output : JSON.stringify(log.output ?? "");
        totalLlmOutputChars += outputText.length;
        if (log.stateSnapshot?.query) {
          totalLlmChars += String(log.stateSnapshot.query).length;
        }
      }
    });

    const perfStats: NodePerfStat[] = Array.from(nodeStatsMap.entries()).map(([nodeId, stat]) => ({
      nodeId,
      name: stat.name,
      kind: stat.kind,
      calls: stat.calls,
      totalMs: stat.totalMs,
      avgMs: stat.calls > 0 ? Math.round(stat.totalMs / stat.calls) : 0,
      percentTotal: totalDurationMs > 0 ? parseFloat(((stat.totalMs / totalDurationMs) * 100).toFixed(1)) : 0,
      errorCount: stat.errorCount,
    }));

    // Find bottleneck
    const bottleneck = perfStats.length > 0 ? [...perfStats].sort((a, b) => b.totalMs - a.totalMs)[0] : null;

    // Token & Cost estimates
    const estInputTokens = Math.ceil(totalLlmChars / 4);
    const estOutputTokens = Math.ceil(totalLlmOutputChars / 4);
    const estCostUSD = ((estInputTokens * 0.0000025) + (estOutputTokens * 0.00001)).toFixed(5);

    return {
      totalSteps,
      totalDurationMs,
      avgStepMs,
      errorCount,
      isSuccess,
      perfStats,
      bottleneck,
      estInputTokens,
      estOutputTokens,
      estCostUSD,
      uniqueKinds: new Set(runLogs.map((l) => l.kind)).size,
    };
  }, [runLogs]);

  if (!isOpen) return null;

  const filteredStats = (analytics?.perfStats ?? []).filter((s) => {
    const q = filterQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.kind.toLowerCase().includes(q) || s.nodeId.toLowerCase().includes(q);
  }).sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (typeof valA === "string") {
      valA = (valA as string).toLowerCase();
      valB = (valB as string).toLowerCase();
    }
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleCopyReport = () => {
    if (!analytics) return;
    const text = [
      `=== AGENT FLOW ANALYTICS REPORT ===`,
      `Status: ${analytics.isSuccess ? "PASS" : "FAILED (" + analytics.errorCount + " errors)"}`,
      `Total Steps: ${analytics.totalSteps}`,
      `Total Duration: ${analytics.totalDurationMs} ms`,
      `Avg Step Duration: ${analytics.avgStepMs} ms`,
      `Bottleneck Node: ${analytics.bottleneck ? `${analytics.bottleneck.name} (${analytics.bottleneck.totalMs} ms)` : "None"}`,
      `Est LLM Tokens: ~${analytics.estInputTokens + analytics.estOutputTokens} (${analytics.estInputTokens} in / ${analytics.estOutputTokens} out)`,
      `Est LLM Cost: ~$${analytics.estCostUSD}`,
      ``,
      `--- Node Latency Breakdown ---`,
      ...analytics.perfStats.map(
        (s) => `${s.name} [${s.kind}]: ${s.totalMs}ms (${s.percentTotal}%) | Calls: ${s.calls} | Avg: ${s.avgMs}ms`
      ),
    ].join("\n");

    navigator.clipboard.writeText(text);
    toast.success("Analytics summary report copied to clipboard");
  };

  const handleDownloadCSV = () => {
    if (!analytics) return;
    const rows = [
      ["Node ID", "Node Name", "Node Kind", "Invocations", "Total Duration (ms)", "Avg Latency (ms)", "Share of Run Time (%)", "Errors"],
      ...analytics.perfStats.map((s) => [
        s.nodeId,
        `"${s.name.replace(/"/g, '""')}"`,
        s.kind,
        s.calls,
        s.totalMs,
        s.avgMs,
        s.percentTotal,
        s.errorCount,
      ]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "agent_flow_analytics.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Analytics CSV exported");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] w-full max-w-2xl max-h-[90vh] flex flex-col font-mono text-[11px] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]" style={{ background: "var(--gradient-header)" }}>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              execution analytics
            </div>
            <h2 className="text-sm font-semibold text-[hsl(var(--ink))] mt-0.5 flex items-center gap-2">
              📊 Workflow Performance Profiler
            </h2>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!analytics ? (
            <div className="text-center py-8 text-[hsl(var(--ink-faint))]">
              No execution run logs available. Run a workflow first to analyze performance.
            </div>
          ) : (
            <>
              {/* Key Metrics Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-2.5 bg-[hsl(var(--ink)/0.015)] text-center">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">
                    Total Duration
                  </div>
                  <div className="text-sm font-bold text-[hsl(var(--ink))] mt-0.5">
                    {analytics.totalDurationMs} ms
                  </div>
                </div>
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-2.5 bg-[hsl(var(--ink)/0.015)] text-center">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">
                    Total Steps
                  </div>
                  <div className="text-sm font-bold text-[hsl(var(--ink))] mt-0.5">
                    {analytics.totalSteps} steps
                  </div>
                </div>
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-2.5 bg-[hsl(var(--ink)/0.015)] text-center">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">
                    Avg Step Latency
                  </div>
                  <div className="text-sm font-bold text-[hsl(var(--ink))] mt-0.5">
                    {analytics.avgStepMs} ms
                  </div>
                </div>
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-2.5 bg-[hsl(var(--ink)/0.015)] text-center">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">
                    Status
                  </div>
                  <div
                    className={`text-sm font-bold mt-0.5 ${
                      analytics.isSuccess ? "text-emerald-600" : "text-[hsl(var(--issue))]"
                    }`}
                  >
                    {analytics.isSuccess ? "PASS ✓" : "ERROR ✗"}
                  </div>
                </div>
              </div>

              {/* Bottleneck Recommendation Alert */}
              {analytics.bottleneck && (
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 bg-[hsl(var(--ink)/0.02)] space-y-1">
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[hsl(var(--ink))]">
                    <span>⚡ Bottleneck Analysis</span>
                    <span className="text-[hsl(var(--edge-selected))]">
                      {analytics.bottleneck.totalMs} ms ({analytics.bottleneck.percentTotal}% of total run)
                    </span>
                  </div>
                  <p className="text-[10px] text-[hsl(var(--ink-soft))]">
                    The slowest node in this execution was <strong className="text-[hsl(var(--ink))]">{analytics.bottleneck.name}</strong> ({analytics.bottleneck.kind}).
                    {analytics.bottleneck.kind === "llm" && " Tip: Consider lowering temperature/max_tokens or tuning model prompts for faster responses."}
                    {analytics.bottleneck.kind === "http" && " Tip: Consider caching HTTP responses or reducing payload sizes."}
                    {analytics.bottleneck.kind === "script" && " Tip: Optimize JavaScript execution loops inside the script node."}
                  </p>
                </div>
              )}

              {/* LLM Tokens & Cost Estimator */}
              {(analytics.estInputTokens > 0 || analytics.estOutputTokens > 0) && (
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 bg-[hsl(var(--ink)/0.01)] flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-semibold text-[hsl(var(--ink))] uppercase text-[10px] tracking-wider block">
                      🤖 LLM Token & Cost Estimate
                    </span>
                    <span className="text-[10px] text-[hsl(var(--ink-soft))]">
                      Input: ~{analytics.estInputTokens} tokens · Output: ~{analytics.estOutputTokens} tokens
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-[hsl(var(--ink-faint))] block">Est Cost</span>
                    <span className="font-bold text-[hsl(var(--ink))]">${analytics.estCostUSD} USD</span>
                  </div>
                </div>
              )}

              {/* Per-Node Breakdown Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-[hsl(var(--ink))] uppercase tracking-wider text-[10px]">
                    Node Latency & Execution Breakdown
                  </span>
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Search node name/kind..."
                    className="bg-transparent border border-dashed border-[hsl(var(--ink-faint))] focus:border-[hsl(var(--ink))] outline-none py-0.5 px-2 font-mono text-[10px] w-48"
                  />
                </div>

                <div className="border border-dashed border-[hsl(var(--grid-line))] overflow-x-auto">
                  <table className="w-full text-left font-mono text-[10px]">
                    <thead className="bg-[hsl(var(--ink)/0.04)] border-b border-dashed border-[hsl(var(--grid-line))] text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">
                      <tr>
                        <th
                          className="p-2 cursor-pointer hover:text-[hsl(var(--ink))]"
                          onClick={() => { setSortField("name"); setSortAsc(!sortAsc); }}
                        >
                          Node Name {sortField === "name" && (sortAsc ? "▲" : "▼")}
                        </th>
                        <th className="p-2">Kind</th>
                        <th
                          className="p-2 cursor-pointer hover:text-[hsl(var(--ink))]"
                          onClick={() => { setSortField("calls"); setSortAsc(!sortAsc); }}
                        >
                          Calls {sortField === "calls" && (sortAsc ? "▲" : "▼")}
                        </th>
                        <th
                          className="p-2 cursor-pointer hover:text-[hsl(var(--ink))]"
                          onClick={() => { setSortField("totalMs"); setSortAsc(!sortAsc); }}
                        >
                          Total (ms) {sortField === "totalMs" && (sortAsc ? "▲" : "▼")}
                        </th>
                        <th
                          className="p-2 cursor-pointer hover:text-[hsl(var(--ink))]"
                          onClick={() => { setSortField("avgMs"); setSortAsc(!sortAsc); }}
                        >
                          Avg (ms) {sortField === "avgMs" && (sortAsc ? "▲" : "▼")}
                        </th>
                        <th className="p-2">% Share</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dashed divide-[hsl(var(--grid-line))]">
                      {filteredStats.map((stat) => (
                        <tr key={stat.nodeId} className="hover:bg-[hsl(var(--ink)/0.02)]">
                          <td className="p-2 font-semibold text-[hsl(var(--ink))] truncate max-w-[140px]">
                            {stat.name}
                          </td>
                          <td className="p-2 uppercase text-[9px] text-[hsl(var(--ink-soft))]">
                            {stat.kind}
                          </td>
                          <td className="p-2 text-[hsl(var(--ink))]">{stat.calls}</td>
                          <td className="p-2 font-bold text-[hsl(var(--ink))]">{stat.totalMs} ms</td>
                          <td className="p-2 text-[hsl(var(--ink-soft))]">{stat.avgMs} ms</td>
                          <td className="p-2 text-[hsl(var(--ink-soft))]">{stat.percentTotal}%</td>
                          <td className="p-2">
                            {stat.errorCount > 0 ? (
                              <span className="text-[hsl(var(--issue))] font-bold">FAIL ({stat.errorCount})</span>
                            ) : (
                              <span className="text-emerald-600 font-semibold">OK</span>
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
        <div className="px-4 py-2.5 border-t border-dashed border-[hsl(var(--grid-line))] flex items-center justify-between gap-2 flex-wrap" style={{ background: "var(--gradient-header)" }}>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReport}
              disabled={!analytics}
              className="px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] disabled:opacity-40 transition-colors uppercase text-[9px] tracking-wider"
            >
              📋 Copy Summary Report
            </button>
            <button
              onClick={handleDownloadCSV}
              disabled={!analytics}
              className="px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] disabled:opacity-40 transition-colors uppercase text-[9px] tracking-wider"
            >
              💾 Export CSV Report
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[hsl(var(--ink))] text-[hsl(var(--paper))] hover:opacity-90 uppercase text-[9px] tracking-wider transition-opacity font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
