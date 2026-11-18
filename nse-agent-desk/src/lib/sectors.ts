/**
 * Research Agent's sector check.
 *
 * Each sector's price line is its NSE sector index (live data, where Yahoo
 * has it) or the equal-weight average of the sector's stocks in this run.
 * Against the Nifty 50 it gets:
 *   relative strength (RS)   sector 1-month return minus Nifty 1-month return
 *   RS momentum              change in that RS over the last 10 trading days
 *   breadth                  % of the sector's stocks above their 50-day average
 * and a state, like a relative-rotation chart:
 *   Leading    RS > 0, lead not shrinking          (stock score +3)
 *   Weakening  RS > 0, lead shrinking (> 0.1 pts)  (−1)
 *   Improving  RS ≤ 0, gap closing (> 0.1 pts)     (+1)
 *   Lagging    RS ≤ 0, gap not closing             (−3)
 */
import type { Analysis, Bar, Decision, SectorView, Snapshot } from "./types";

/** NSE sector indices on Yahoo, for the sectors that have a clear match. */
export const SECTOR_INDEX: Record<string, { symbol: string; name: string }> = {
  Banks: { symbol: "^NSEBANK", name: "Nifty Bank" },
  IT: { symbol: "^CNXIT", name: "Nifty IT" },
  Pharma: { symbol: "^CNXPHARMA", name: "Nifty Pharma" },
  Auto: { symbol: "^CNXAUTO", name: "Nifty Auto" },
  FMCG: { symbol: "^CNXFMCG", name: "Nifty FMCG" },
  Metals: { symbol: "^CNXMETAL", name: "Nifty Metal" },
  Energy: { symbol: "^CNXENERGY", name: "Nifty Energy" },
  Realty: { symbol: "^CNXREALTY", name: "Nifty Realty" },
  Infrastructure: { symbol: "^CNXINFRA", name: "Nifty Infrastructure" },
};

export const SECTOR_ADJ: Record<SectorView["state"], number> = { Leading: 3, Improving: 1, Weakening: -1, Lagging: -3 };

const ret = (c: number[], days: number, back = 0) => {
  const end = c.length - 1 - back, start = end - days;
  return start >= 0 ? (c[end] / c[start] - 1) * 100 : 0;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Equal-weight line from several stocks' closes (each rebased to 100). */
function composite(series: number[][]): number[] {
  const n = Math.min(...series.map((s) => s.length));
  return Array.from({ length: n }, (_, i) =>
    series.reduce((s, c) => s + (c[c.length - n + i] / c[c.length - n]) * 100, 0) / series.length);
}

export function analyseSectors(
  frames: Record<string, Bar[]>, snaps: Record<string, Snapshot>, sectorOf: (s: string) => string,
  indexClose: number[], sectorIndex: Record<string, number[]> = {},
): SectorView[] {
  const groups = new Map<string, string[]>();
  for (const s of Object.keys(frames)) {
    const sec = sectorOf(s);
    if (sec === "Other") continue;
    groups.set(sec, [...(groups.get(sec) ?? []), s]);
  }
  const nifty = indexClose.length > 31 ? indexClose : [];
  const views: SectorView[] = [];
  for (const [sector, members] of groups) {
    const idx = sectorIndex[sector];
    const useIndex = Boolean(idx && idx.length > 63);
    if (!useIndex && members.length < 2) continue; // one stock is not a sector trend
    const line = useIndex ? idx : composite(members.map((m) => frames[m].map((b) => b.close)));
    if (line.length < 32) continue;
    const n1 = nifty.length ? ret(nifty, 21) : 0, n1b = nifty.length ? ret(nifty, 21, 10) : 0;
    const rs = ret(line, 21) - n1;
    const rsMomentum = rs - (ret(line, 21, 10) - n1b);
    const breadth = (members.filter((m) => snaps[m].close > snaps[m].sma50).length / members.length) * 100;
    // A turn must be real (more than 0.1 points over 10 days): a steady leader stays
    // Leading, a steady laggard stays Lagging, and rounding noise isn't read as a turn.
    const state: SectorView["state"] = rs > 0 ? (rsMomentum < -0.1 ? "Weakening" : "Leading") : (rsMomentum > 0.1 ? "Improving" : "Lagging");
    const tail = (c: number[]) => { const t = c.slice(-60); return t.map((v) => r1((v / t[0]) * 100)); };
    views.push({
      sector, members: members.length, source: useIndex ? "index" : "composite",
      sourceLabel: useIndex ? `the ${SECTOR_INDEX[sector].name} index` : `the average of ${members.length} stocks in this run`,
      ret1m: r1(ret(line, 21)), ret3m: r1(ret(line, Math.min(63, line.length - 1))),
      relStrength: r1(rs), rsMomentum: r1(rsMomentum), breadth: Math.round(breadth), state, rank: 0,
      closes: tail(line), niftyCloses: nifty.length ? tail(nifty) : [],
      buyPct: 0, avgScore: 0, leaders: [],
    });
  }
  // Rank: relative strength, plus 3-month edge and breadth.
  const n3 = nifty.length ? ret(nifty, Math.min(63, nifty.length - 1)) : 0;
  const strength = (v: SectorView) => v.relStrength + (v.ret3m - n3) * 0.5 + (v.breadth - 50) / 5;
  views.sort((a, b) => strength(b) - strength(a)).forEach((v, i) => { v.rank = i + 1; });
  return views;
}

/** Move each stock's score by its sector's state. */
export function applySectors(rows: Analysis[], sectors: SectorView[]): Analysis[] {
  const by = new Map(sectors.map((s) => [s.sector, s]));
  return rows.map((r) => {
    const s = by.get(r.sector);
    if (!s) return r;
    const adj = SECTOR_ADJ[s.state];
    return {
      ...r, combined: Math.round(Math.max(0, Math.min(100, r.combined + adj)) * 10) / 10,
      notes: [...r.notes, `Sector ${r.sector}: ${s.state.toLowerCase()} (rank ${s.rank} of ${sectors.length}, ${adj >= 0 ? "+" : ""}${adj})`],
    };
  }).sort((a, b) => b.combined - a.combined);
}

/** After the decision: buy signals, average score and leading stocks per sector. */
export function enrichSectors(sectors: SectorView[], all: Decision[]): SectorView[] {
  return sectors.map((s) => {
    const m = all.filter((d) => d.sector === s.sector);
    if (!m.length) return s;
    return {
      ...s, buyPct: Math.round((m.filter((d) => d.verdict === "STRONG BUY" || d.verdict === "BUY").length / m.length) * 100),
      avgScore: r1(m.reduce((a, d) => a + d.combined, 0) / m.length),
      leaders: [...m].sort((a, b) => b.combined - a.combined).slice(0, 3).map((d) => d.symbol),
    };
  });
}
