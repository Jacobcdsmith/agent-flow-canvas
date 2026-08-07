import { useEffect, useState } from "react";
import { fetchStats, type AnalyticsStats } from "@/lib/analytics";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 border border-[hsl(var(--grid-line))] px-6 py-5">
      <div className="text-[11px] uppercase tracking-[0.15em] text-[hsl(var(--ink-faint))]">{label}</div>
      <div className="text-[32px] font-bold leading-none tracking-[-0.02em]">{value}</div>
      {sub && <div className="text-[12px] text-[hsl(var(--ink-soft))]">{sub}</div>}
    </div>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden bg-[hsl(var(--grid-line))]">
      <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

const SOURCE_COLORS: Record<string, string> = {
  Direct: "hsl(var(--accent-deep))",
  Google: "hsl(var(--node-llm))",
  "GitHub": "hsl(var(--node-tool))",
  "Twitter / X": "hsl(var(--node-router))",
  Reddit: "hsl(var(--node-trigger))",
  "Hacker News": "hsl(var(--node-subagent))",
  "Product Hunt": "hsl(var(--accent-cyan))",
  LinkedIn: "hsl(var(--node-memory))",
  Search: "hsl(var(--node-sink))",
  Other: "hsl(var(--ink-faint))",
};

function fallbackColor(label: string) {
  return SOURCE_COLORS[label] ?? "hsl(var(--ink-faint))";
}

export function AnalyticsWidget() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats(30).then((s) => {
      setStats(s);
      setLoading(false);
    });
  }, []);

  return (
    <section className="mx-auto max-w-[1120px] px-6 pb-[100px] pt-5 sm:px-10">
      <div className="mb-2.5 text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
        // live analytics · last 30 days
      </div>
      <h2 className="m-0 mb-8 text-[28px] font-bold">Who's showing up — and who's jumping in</h2>

      {loading ? (
        <div className="border border-dashed border-[hsl(var(--grid-line))] px-6 py-10 text-center text-[13px] text-[hsl(var(--ink-faint))] uppercase tracking-[0.14em]">
          loading stats…
        </div>
      ) : stats === null ? (
        <div className="border border-dashed border-[hsl(var(--grid-line))] px-6 py-10 text-center text-[13px] text-[hsl(var(--ink-faint))] uppercase tracking-[0.14em]">
          analytics unavailable
        </div>
      ) : (
        <>
          {/* Top stats row */}
          <div className="mb-6 grid grid-cols-1 gap-px bg-[hsl(var(--grid-line))] sm:grid-cols-3">
            <Stat
              label="Page views"
              value={stats.views.toLocaleString()}
              sub="unique landing-page loads"
            />
            <Stat
              label="Canvas opens"
              value={stats.interactions.toLocaleString()}
              sub="clicked into /app"
            />
            <Stat
              label="Interaction rate"
              value={`${stats.interactionRate}%`}
              sub="viewers who opened the canvas"
            />
          </div>

          {/* Viewer → interactor funnel bar */}
          <div className="mb-8 border border-[hsl(var(--grid-line))] px-6 py-5">
            <div className="mb-3 text-[11px] uppercase tracking-[0.15em] text-[hsl(var(--ink-faint))]">
              viewer → interactor funnel
            </div>
            <div className="relative flex h-8 w-full overflow-hidden rounded-none bg-[hsl(var(--grid-line))]">
              {stats.views > 0 && (
                <div
                  className="flex h-full items-center justify-center text-[11px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--paper))]"
                  style={{
                    width: "100%",
                    background: "hsl(var(--ink-faint))",
                    position: "absolute",
                  }}
                >
                  {stats.views.toLocaleString()} viewers
                </div>
              )}
              {stats.interactions > 0 && stats.views > 0 && (
                <div
                  className="flex h-full items-center justify-center text-[11px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--paper))] transition-all"
                  style={{
                    width: `${Math.max(8, stats.interactionRate)}%`,
                    background: "hsl(var(--accent-deep))",
                    position: "absolute",
                    zIndex: 1,
                  }}
                >
                  {stats.interactions.toLocaleString()}
                </div>
              )}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-[hsl(var(--ink-faint))]">
              <span>viewed landing page</span>
              <span>opened canvas</span>
            </div>
          </div>

          {/* Traffic sources */}
          {stats.sources.length > 0 ? (
            <div className="border border-[hsl(var(--grid-line))] px-6 py-5">
              <div className="mb-4 text-[11px] uppercase tracking-[0.15em] text-[hsl(var(--ink-faint))]">
                traffic sources
              </div>
              <div className="flex flex-col gap-4">
                {stats.sources.map((s) => (
                  <div key={s.label}>
                    <div className="mb-1.5 flex items-center justify-between text-[13px]">
                      <span className="font-mono">{s.label}</span>
                      <span className="text-[hsl(var(--ink-soft))]">
                        {s.count.toLocaleString()} &nbsp;
                        <span className="text-[11px] text-[hsl(var(--ink-faint))]">({s.pct}%)</span>
                      </span>
                    </div>
                    <Bar pct={s.pct} color={fallbackColor(s.label)} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-[hsl(var(--grid-line))] px-6 py-8 text-center text-[12px] text-[hsl(var(--ink-faint))] uppercase tracking-[0.14em]">
              no traffic data yet — check back after some visitors arrive
            </div>
          )}
        </>
      )}
    </section>
  );
}
