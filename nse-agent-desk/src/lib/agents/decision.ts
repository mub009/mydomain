/** Agent 4 - Decision Agent: turns Research Agent's analysis into verdicts, applies
 *  portfolio rules (sector concentration, capital) and chooses the picks. */
import { PERIOD_LABEL } from "../black-points/analyst";
import type { Analysis, BPStatus, Decision, HoldingPeriod, Verdict } from "../types";

const periodsOf = (horizon: string): HoldingPeriod[] =>
  horizon.startsWith("Swing, then") ? ["swing", "positional"] : horizon.startsWith("Swing") ? ["swing"] : ["positional"];
const HORIZON: Record<HoldingPeriod, string> = { swing: "Swing · 1-10 days", positional: "Positional · ~1 month" };
const STOP_ATR: Record<HoldingPeriod, number> = { swing: 1.5, positional: 2.5 };

export const MAX_PER_SECTOR = 2;
/** Most picks from one sector: 2 up to 15 picks, then 4 for 20 and 5 for 25, so the longer lists can fill. */
export const sectorCap = (top: number) => (top <= 15 ? MAX_PER_SECTOR : Math.ceil(top / 5));

export class DecisionAgent {
  verdict(r: Analysis): Verdict {
    const f = r.fundamentals;
    const loss = f?.epsTTM !== undefined && f.epsTTM < 0;
    const epsFalling = f?.epsGrowth1y !== undefined && f.epsGrowth1y < 0;
    let v: Verdict = "AVOID";
    if (r.combined >= 70 && r.agree && r.risk !== "HIGH") v = "STRONG BUY";
    else if (r.combined >= 60 && r.risk !== "HIGH") v = "BUY";
    else if (r.combined >= 48) v = "WATCH";
    // Earnings caps: never a strong buy with falling EPS, never a buy while loss-making.
    if (v === "STRONG BUY" && epsFalling) v = "BUY";
    if ((v === "STRONG BUY" || v === "BUY") && loss) v = "WATCH";
    // Red Flag Agent: a severe flag (GSM, late-stage ASM, heavy pledge, tip alert, high default risk) blocks a buy.
    if ((v === "STRONG BUY" || v === "BUY") && r.desk?.severe) v = "WATCH";
    // Black Points Analyst: no score or vote overrides it. Excluded everywhere = AVOID;
    // nothing eligible (some Needs Review) = at most WATCH.
    const st = Object.values(r.blackPoints?.status ?? {}) as BPStatus[];
    if (st.length && !st.includes("Eligible")) {
      if (st.every((x) => x === "Excluded")) v = "AVOID";
      else if (v === "STRONG BUY" || v === "BUY") v = "WATCH";
    }
    return v;
  }

  /**
   * Keep a trade only on the holding periods the Black Points Analyst cleared:
   * a stock eligible for one period only is re-planned for that period.
   */
  fitHorizon(r: Analysis): Analysis {
    const st = r.blackPoints?.status;
    if (!st) return r;
    const want = periodsOf(r.horizon), ok = want.filter((p) => st[p] === "Eligible");
    if (!ok.length || ok.length === want.length) return r;
    const p = ok[0], atr = (r.atrPct / 100) * r.entry, stop = r.entry - STOP_ATR[p] * atr;
    const blocked = want.filter((x) => st[x] !== "Eligible").map((x) => `${PERIOD_LABEL[x]} ${st[x]}`).join(", ");
    return { ...r, horizon: HORIZON[p], stopLoss: Math.round(stop * 100) / 100, target: Math.round((r.entry + 2 * (r.entry - stop)) * 100) / 100,
      notes: [...r.notes, `Holding plan narrowed to ${PERIOD_LABEL[p]} (${blocked} by the Black Points Analyst)`] };
  }

  /** The Decision Agent's final word on a stock the Black Points Analyst checked. */
  ruling(d: Decision, picked: boolean): string {
    const bp = d.blackPoints!;
    const ps = Object.keys(bp.status) as HoldingPeriod[];
    const why = (p: HoldingPeriod) => bp.findings.filter((f) => f.materiality === "material" && f.impact[p] && f.impact[p] !== "Eligible").map((f) => f.flag);
    const parts = ps.map((p) => {
      const s = bp.status[p]!;
      return s === "Eligible" ? `eligible for the ${PERIOD_LABEL[p].toLowerCase()} shortlist`
        : s === "Excluded" ? `excluded from the ${PERIOD_LABEL[p].toLowerCase()} shortlist (${why(p).join("; ")})`
        : `held out of the ${PERIOD_LABEL[p].toLowerCase()} shortlist for review (${why(p).join("; ")})`;
    });
    const anyOk = ps.some((p) => bp.status[p] === "Eligible");
    const tail = !anyOk ? " No technical score or agent vote can override this." : picked ? ` Chosen as a final pick (${d.horizon}).` : ` Not chosen: ${d.passedOver ?? `rated ${d.verdict}`}.`;
    return `${parts.join("; ").replace(/^./, (c) => c.toUpperCase())}.${tail}`;
  }

  /** Stocks among the candidates that Decision Agent wants to ask Research Agent about. */
  conflicted(rows: Analysis[], top: number): Analysis[] {
    return rows.slice(0, Math.max(top * 2, 10)).filter((r) => r.conflict && r.combined >= 48).slice(0, 2);
  }

  decide(rows: Analysis[], sparks: Record<string, number[]>, top: number,
    clarifications: Record<string, string>, capital?: number, riskPerTrade = 1) {
    const all: Decision[] = rows.map((r) => ({
      ...this.fitHorizon(r), verdict: this.verdict(r), clarification: clarifications[r.symbol], spark: sparks[r.symbol] ?? [],
    }));

    // Choose picks in score order, but never more than the sector cap from one sector.
    const cap = sectorCap(top);
    const picks: Decision[] = [], passed: Decision[] = [];
    const perSector: Record<string, number> = {};
    // When the Research Agent chart-checked the leaders, only those can become picks.
    const charted = all.some((d) => d.chart);
    for (const d of all) {
      if (d.verdict !== "STRONG BUY" && d.verdict !== "BUY") continue;
      if (picks.length >= top) break;
      if (charted && !d.chart) { d.passedOver = "Outside the chart-checked candidates"; passed.push(d); continue; }
      if ((perSector[d.sector] ?? 0) >= cap) {
        d.passedOver = `Sector cap: already ${cap} ${d.sector} picks`;
        passed.push(d);
        continue;
      }
      perSector[d.sector] = (perSector[d.sector] ?? 0) + 1;
      picks.push(d);
    }

    // Position sizing: Quantity = floor((Capital x Risk %) / (Entry - Stop-loss)),
    // capped by the capital still unallocated, so the total never exceeds capital.
    if (capital && capital > 0) {
      let remaining = capital;
      for (const p of picks) {
        const perShare = Math.max(p.entry - p.stopLoss, 0.01);
        const riskQty = Math.floor((capital * riskPerTrade) / 100 / perShare);
        const qty = Math.max(0, Math.min(riskQty, Math.floor(remaining / p.entry)));
        p.quantity = qty;
        p.investment = Math.round(qty * p.entry * 100) / 100;
        remaining -= p.investment;
      }
    }

    for (const d of all) if (d.blackPoints) d.blackPoints = { ...d.blackPoints, finalDecision: this.ruling(d, picks.includes(d)) };
    const watchlist = [...passed, ...all.filter((d) => d.verdict === "WATCH")].slice(0, Math.max(top, 5));
    return { all, picks, watchlist, passed };
  }
}
