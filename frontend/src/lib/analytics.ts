import { supabase } from "@/integrations/supabase/client";

export type EventType = "view" | "open_canvas";

/** Classify document.referrer or UTM params into a named traffic source. */
export function classifySource(referrer: string): string {
  if (!referrer) return "direct";
  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();
    if (host.includes("google")) return "google";
    if (host.includes("bing") || host.includes("duckduckgo") || host.includes("yahoo")) return "search";
    if (host.includes("github")) return "github";
    if (host.includes("twitter") || host === "x.com" || host.endsWith(".x.com")) return "twitter";
    if (host.includes("reddit")) return "reddit";
    if (host.includes("linkedin")) return "linkedin";
    if (host.includes("producthunt")) return "product_hunt";
    if (host.includes("hackernews") || host.includes("ycombinator")) return "hacker_news";
    return "other";
  } catch {
    return "other";
  }
}

/** Fire an analytics event. Errors are swallowed — never break the app. */
export async function trackEvent(type: EventType): Promise<void> {
  try {
    const referrer = document.referrer || "";
    const source = classifySource(referrer);
    await supabase.from("analytics_events").insert({ event_type: type, referrer, source });
  } catch {
    // silent — analytics must never block the UI
  }
}

export interface AnalyticsStats {
  views: number;
  interactions: number;
  interactionRate: number; // 0-100
  sources: { label: string; count: number; pct: number }[];
}

const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct",
  google: "Google",
  search: "Search",
  github: "GitHub",
  twitter: "Twitter / X",
  reddit: "Reddit",
  linkedin: "LinkedIn",
  product_hunt: "Product Hunt",
  hacker_news: "Hacker News",
  other: "Other",
};

/** Fetch aggregated analytics for the last N days. */
export async function fetchStats(days = 30): Promise<AnalyticsStats | null> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const iso = since.toISOString();

    const { data, error } = await supabase
      .from("analytics_events_public")
      .select("event_type, source")
      .gte("created_at", iso);

    if (error) return null;
    if (!data || data.length === 0) {
      return { views: 0, interactions: 0, interactionRate: 0, sources: [] };
    }

    let views = 0;
    let interactions = 0;
    const sourceCounts: Record<string, number> = {};

    for (const row of data) {
      if (row.event_type === "view") {
        views++;
        // traffic sources are derived only from page-view events (where referrer is meaningful)
        const s = row.source || "direct";
        sourceCounts[s] = (sourceCounts[s] ?? 0) + 1;
      }
      if (row.event_type === "open_canvas") interactions++;
    }

    const interactionRate = views === 0 ? 0 : Math.round((interactions / views) * 100);

    const sources = Object.entries(sourceCounts)
      .map(([key, count]) => ({
        label: SOURCE_LABELS[key] ?? key,
        count,
        pct: views === 0 ? 0 : Math.round((count / views) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    return { views, interactions, interactionRate, sources };
  } catch {
    return null;
  }
}
