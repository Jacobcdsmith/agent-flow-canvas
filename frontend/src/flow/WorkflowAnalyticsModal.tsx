import React, { useState, useMemo } from "react";
import type { RunLog } from "./runFlow";
import { toast } from "sonner";

interface WorkflowAnalyticsModalProps {
  logs: RunLog[];
  onClose: () => void;
}

export interface NodeMetrics {
  nodeId: string;
  name: string;
  kind: string;
  count: number;
  totalMs: number;
  avgMs: number;
  pctTotal: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
}

export function computeWorkflowAnalytics(logs: RunLog[]) {
  const totalMs = logs.reduce((acc, l) => acc + l.ms, 0);
  const totalSteps = logs.length;
  const errorCount = logs.filter((l) => !!l.error).length;

  const nodeMap = new Map<string, { nodeId: string; name: string; kind: string; count: number; totalMs: number; textChars: number }>();

  logs.forEach((log) => {
    const existing = nodeMap.get(log.nodeId) || {
      nodeId: log.nodeId,
      name: log.name,
      kind: log.kind,
      count: 0,
      totalMs: 0,
      textChars: 0,
    };

    existing.count += 1;
    existing.totalMs += log.ms;

    // Estimate character length for token calculations
    if (log.output) {
      const outStr = typeof log.output === "string" ? log.output : JSON.stringify(log.output);
      existing.textChars += outStr.length;
    }

    nodeMap.set(log.nodeId, existing);
  });

  let totalEstimatedTokens = 0;
  let totalEstimatedCostUsd = 0;

  const nodeMetrics: NodeMetrics[] = Array.from(nodeMap.values()).map((nm) => {
    const avgMs = Math.round(nm.totalMs / nm.count);
    const pctTotal = totalMs > 0 ? Math.round((nm.totalMs / totalMs) * 100) : 0;

    // ~4 chars per token estimate
    const estimatedTokens = Math.round(nm.textChars / 4);
    // Rough estimate: $0.002 per 1k tokens for standard LLM inference
    const estimatedCostUsd = (estimatedTokens / 1000) * 0.002;

    totalEstimatedTokens += estimatedTokens;
    totalEstimatedCostUsd += estimatedCostUsd;

    return {
      nodeId: nm.nodeId,
      name: nm.name,
      kind: nm.kind,
      count: nm.count,
      totalMs: nm.totalMs,
      avgMs,
      pctTotal,
      estimatedTokens,
      estimatedCostUsd,
    };
  });

  // Bottleneck detection: find node taking highest % of runtime
  const sortedByTime = [...nodeMetrics].sort((a, b) => b.totalMs - a.totalMs);
  const slowestNode = sortedByTime[0] || null;

  const recommendations: string[] = [];
  if (slowestNode && slowestNode.pctTotal >= 40) {
    recommendations.push(
      `Node "${slowestNode.name}" (${slowestNode.kind}) accounts for ${slowestNode.pctTotal}% of total execution duration (${slowestNode.totalMs}ms). Consider optimizing model selection, prompt size, or request parallelism.`
    );
  }
  if (errorCount > 0) {
    recommendations.push(
      `Execution encountered ${errorCount} error(s). Review edge conditions and retry strategy for failing nodes.`
    );
  }
  if (totalSteps > 15) {
    recommendations.push(
      `Flow executed in ${totalSteps} steps. High step count may indicate circular loops or unoptimized routing.`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push("Workflow execution profile is balanced and optimal. No major bottlenecks detected.");
  }

  return {
    totalMs,
    totalSteps,
    errorCount,
    totalEstimatedTokens,
    totalEstimatedCostUsd,
    nodeMetrics,
    slowestNode,
    recommendations,
  };
}

export function generateAnalyticsCsv(logs: RunLog[]): string {
  const { nodeMetrics, totalMs, totalSteps, errorCount, totalEstimatedTokens, totalEstimatedCostUsd } = computeWorkflowAnalytics(logs);

  const lines: string[] = [];
  lines.push(`Workflow Performance & Profiling Report`);
  lines.push(`Generated,${new Date().toISOString()}`);
  lines.push(`Total Steps,${totalSteps}`);
  lines.push(`Total Duration (ms),${totalMs}`);
  lines.push(`Error Count,${errorCount}`);
  lines.push(`Total Estimated Tokens,${totalEstimatedTokens}`);
  lines.push(`Total Estimated Cost (USD),$${totalEstimatedCostUsd.toFixed(5)}`);
  lines.push(``);
  lines.push(`Node ID,Node Name,Node Kind,Execution Count,Total Duration (ms),Avg Duration (ms),% of Total,Estimated Tokens,Estimated Cost (USD)`);

  nodeMetrics.forEach((nm) => {
    lines.push(
      `"${nm.nodeId}","${nm.name.replace(/"/g, '""')}","${nm.kind}",${nm.count},${nm.totalMs},${nm.avgMs},${nm.pctTotal}%,${nm.estimatedTokens},$${nm.estimatedCostUsd.toFixed(5)}`
    );
  });

  return lines.join("\n");
}

export const WorkflowAnalyticsModal: React.FC<WorkflowAnalyticsModalProps> = ({
  logs,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof NodeMetrics>("totalMs");
  const [sortAsc, setSortAsc] = useState(false);

  const analytics = useMemo(() => computeWorkflowAnalytics(logs), [logs]);

  const filteredMetrics = useMemo(() => {
    let result = analytics.nodeMetrics.filter(
      (m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.kind.toLowerCase().includes(searchTerm.toLowerCase())
    );

    result.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

    return result;
  }, [analytics.nodeMetrics, searchTerm, sortField, sortAsc]);

  const handleSort = (field: keyof NodeMetrics) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleCopySummary = () => {
    const text = [
      `📊 Agent Flow Execution Analytics Summary`,
      `Total Steps: ${analytics.totalSteps}`,
      `Total Duration: ${analytics.totalMs} ms`,
      `Errors: ${analytics.errorCount}`,
      `Estimated Tokens: ~${analytics.totalEstimatedTokens}`,
      `Estimated Cost: ~$${analytics.totalEstimatedCostUsd.toFixed(5)}`,
      `Bottleneck: ${analytics.slowestNode ? `${analytics.slowestNode.name} (${analytics.slowestNode.pctTotal}%)` : "None"}`,
      `Recommendations: ${analytics.recommendations.join(" ")}`,
    ].join("\n");

    navigator.clipboard.writeText(text);
    toast.success("Analytics summary copied to clipboard");
  };

  const handleExportCsv = () => {
    const csv = generateAnalyticsCsv(logs);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workflow_analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV analytics report downloaded");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--ink)/0.5)] backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] bg-[hsl(var(--paper))] border-2 border-[hsl(var(--ink))] shadow-xl flex flex-col font-mono text-[11px] overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]"
          style={{ background: "var(--gradient-header)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <div>
              <h2 className="font-semibold text-sm text-[hsl(var(--ink))]">
                Workflow Profiler & Analytics
              </h2>
              <div className="text-[10px] text-[hsl(var(--ink-faint))] uppercase tracking-wider">
                Execution Performance & Latency Bottlenecks
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
            >
              📋 Copy Summary
            </button>
            <button
              onClick={handleExportCsv}
              className="px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
            >
              💾 Export CSV
            </button>
            <button
              onClick={onClose}
              className="px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors ml-2"
            >
              × Close
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {logs.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-[hsl(var(--grid-line))] text-[hsl(var(--ink-soft))]">
              No execution log data available. Execute your workflow to generate performance metrics.
            </div>
          ) : (
            <>
              {/* Key Overview Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 bg-[hsl(var(--ink)/0.01)] text-center">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Total Duration</div>
                  <div className="font-bold text-base text-[hsl(var(--ink))] mt-0.5">{analytics.totalMs} ms</div>
                  <div className="text-[8px] text-[hsl(var(--ink-soft))] mt-0.5">{analytics.totalSteps} execution steps</div>
                </div>

                <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 bg-[hsl(var(--ink)/0.01)] text-center">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Slowest Node</div>
                  <div className="font-bold text-sm text-[hsl(var(--ink))] mt-0.5 truncate">
                    {analytics.slowestNode ? analytics.slowestNode.name : "N/A"}
                  </div>
                  <div className="text-[8px] text-[hsl(var(--ink-soft))] mt-0.5">
                    {analytics.slowestNode ? `${analytics.slowestNode.totalMs}ms (${analytics.slowestNode.pctTotal}%)` : "-"}
                  </div>
                </div>

                <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 bg-[hsl(var(--ink)/0.01)] text-center">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Est. LLM Tokens</div>
                  <div className="font-bold text-base text-[hsl(var(--ink))] mt-0.5">~{analytics.totalEstimatedTokens}</div>
                  <div className="text-[8px] text-[hsl(var(--ink-soft))] mt-0.5">~4 chars / token</div>
                </div>

                <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 bg-[hsl(var(--ink)/0.01)] text-center">
                  <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))]">Est. Cost (USD)</div>
                  <div className="font-bold text-base text-[hsl(var(--ink))] mt-0.5">${analytics.totalEstimatedCostUsd.toFixed(5)}</div>
                  <div className="text-[8px] text-[hsl(var(--ink-soft))] mt-0.5">Standard model rates</div>
                </div>
              </div>

              {/* Actionable Recommendations */}
              <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-1.5 bg-[hsl(var(--ink)/0.015)]">
                <span className="text-[10px] uppercase font-bold text-[hsl(var(--ink-soft))] block">
                  💡 Optimization Recommendations:
                </span>
                <ul className="space-y-1 list-disc list-inside text-[10px] text-[hsl(var(--ink))]">
                  {analytics.recommendations.map((rec, i) => (
                    <li key={i} className="leading-relaxed">{rec}</li>
                  ))}
                </ul>
              </div>

              {/* Node Breakdown Table with Search & Sorting */}
              <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[hsl(var(--ink-soft))]">
                    Per-Node Performance Breakdown
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search nodes by name or kind..."
                    className="bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--ink))] px-2 py-1 text-[10px] w-56 outline-none focus:border-[hsl(var(--edge-selected))]"
                  />
                </div>

                <div className="border border-dashed border-[hsl(var(--grid-line))] max-h-60 overflow-y-auto">
                  <table className="w-full text-left font-mono text-[10px]">
                    <thead className="bg-[hsl(var(--ink)/0.03)] border-b border-dashed border-[hsl(var(--grid-line))] uppercase text-[hsl(var(--ink-faint))] sticky top-0 bg-[hsl(var(--paper))] z-10">
                      <tr>
                        <th onClick={() => handleSort("name")} className="p-2 cursor-pointer hover:underline">
                          Name {sortField === "name" ? (sortAsc ? "▲" : "▼") : ""}
                        </th>
                        <th onClick={() => handleSort("kind")} className="p-2 cursor-pointer hover:underline">
                          Kind {sortField === "kind" ? (sortAsc ? "▲" : "▼") : ""}
                        </th>
                        <th onClick={() => handleSort("count")} className="p-2 cursor-pointer hover:underline text-right">
                          Steps {sortField === "count" ? (sortAsc ? "▲" : "▼") : ""}
                        </th>
                        <th onClick={() => handleSort("totalMs")} className="p-2 cursor-pointer hover:underline text-right">
                          Total (ms) {sortField === "totalMs" ? (sortAsc ? "▲" : "▼") : ""}
                        </th>
                        <th onClick={() => handleSort("avgMs")} className="p-2 cursor-pointer hover:underline text-right">
                          Avg (ms) {sortField === "avgMs" ? (sortAsc ? "▲" : "▼") : ""}
                        </th>
                        <th onClick={() => handleSort("pctTotal")} className="p-2 cursor-pointer hover:underline text-right">
                          % Runtime {sortField === "pctTotal" ? (sortAsc ? "▲" : "▼") : ""}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dashed divide-[hsl(var(--grid-line))]">
                      {filteredMetrics.map((nm) => (
                        <tr key={nm.nodeId} className="hover:bg-[hsl(var(--ink)/0.02)]">
                          <td className="p-2 font-bold text-[hsl(var(--ink))]">{nm.name}</td>
                          <td className="p-2 uppercase text-[hsl(var(--ink-soft))]">{nm.kind}</td>
                          <td className="p-2 text-right">{nm.count}</td>
                          <td className="p-2 text-right font-bold">{nm.totalMs}ms</td>
                          <td className="p-2 text-right">{nm.avgMs}ms</td>
                          <td className="p-2 text-right">
                            <span className={nm.pctTotal >= 40 ? "text-[hsl(var(--issue))] font-bold" : ""}>
                              {nm.pctTotal}%
                            </span>
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
      </div>
    </div>
  );
};
