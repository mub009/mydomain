/** Morning Session agent: reads the news brief and passes the positive
 *  stories to Lotappi and Mayavi, who give those stocks a score boost. */
import type { AgentReport, NewsBrief, NewsItem } from "../types";
import { byScore, clamp, round, signalFor } from "./base";

export const NEWS_BOOST = 6;

export class MorningSession {
  positive(brief: NewsBrief | null): NewsItem[] {
    return first(brief?.items.filter((i) => i.sentiment === "positive") ?? []);
  }
  negative(brief: NewsBrief | null): NewsItem[] {
    return first(brief?.items.filter((i) => i.sentiment === "negative") ?? []);
  }

  /** Apply the news to a scanner's reports: positive news adds points, negative news adds a warning. */
  apply(reports: AgentReport[], brief: NewsBrief | null): AgentReport[] {
    const pos = new Map(this.positive(brief).map((i) => [i.symbol, i]));
    const neg = new Map(this.negative(brief).map((i) => [i.symbol, i]));
    return reports.map((r) => {
      const p = pos.get(r.symbol), n = neg.get(r.symbol);
      if (!p && !n) return r;
      const score = p && !n ? round(clamp(r.score + NEWS_BOOST)) : r.score;
      return {
        ...r, score, signal: signalFor(score),
        reasons: p && !n ? [...r.reasons, `Positive news: ${p.headline}`] : r.reasons,
        warnings: n ? [...r.warnings, `Negative news: ${n.headline}`] : r.warnings,
      };
    }).sort(byScore);
  }
}

/** One headline per stock. */
function first(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((i) => !seen.has(i.symbol) && seen.add(i.symbol));
}
