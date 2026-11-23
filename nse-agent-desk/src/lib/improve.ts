/**
 * How to improve an investment: practical steps for one stock you hold, and
 * for the whole portfolio, including commodities (gold, crude, metals).
 * Built on the sell check (exit-check.ts) and the long-term view.
 */
import type { ExitAdvice } from "./exit-check";
import { EXPOSURES } from "./macro/exposure";
import type { Decision } from "./types";

export type TipKind = "act" | "add" | "trim" | "protect" | "commodity" | "diversify" | "info";
export interface Tip { kind: TipKind; title: string; text: string }

const inr = (n: number, d = 2) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d > 0 && n < 1000 ? 2 : 0 })}`;
const COMMODITY_SECTORS = new Set(["Metals", "Energy", "Oil & Gas", "Mining"]);
const FACTOR = { gold: "gold", crude: "crude oil", usdinr: "the US dollar" } as const;

/** Steps for one holding. `weightPct` is its share of the portfolio, when known. */
export function improveStock(d: Decision, a: ExitAdvice, weightPct?: number): Tip[] {
  const tips: Tip[] = [];
  const lt = a.longTerm?.action;
  const zone = d.chart?.zone;

  // 1. The decision itself.
  if (a.action === "SELL") tips.push({ kind: "act", title: `Sell ${a.sellQty === a.qty ? "all" : a.sellQty} shares`, text: a.reasons[0] });
  else if (a.action === "BOOK PROFIT") tips.push({ kind: "trim", title: `Book profit on ${a.sellQty} of ${a.qty} shares`, text: a.reasons[0] });

  // 2. Average down / add more, only when the business case is good and the short term isn't a sell.
  if (a.action !== "SELL" && (lt === "ACCUMULATE" || (lt === "HOLD" && (a.longTerm?.score ?? 0) >= 60))) {
    const buyAt = zone ? (zone.low + zone.high) / 2 : Math.min(a.price, d.entry);
    if (a.pnlPct <= -5 && buyAt < a.avgPrice && a.stop !== undefined && buyAt <= a.stop) {
      // Buying where you'd already have sold makes no sense.
      tips.push({ kind: "info", title: "Don't average down yet",
        text: `The agents' buy area${zone ? ` (${inr(zone.low, 0)}–${inr(zone.high, 0)})` : ""} is below your stop-loss (${inr(a.stop)}). Add only once the price holds above the stop and the trend turns up again.` });
    } else if (a.pnlPct <= -5 && buyAt < a.avgPrice) {
      const add = Math.max(1, Math.round(a.qty / 2));
      const newAvg = (a.avgPrice * a.qty + buyAt * add) / (a.qty + add);
      tips.push({ kind: "add", title: `Average down: add ${add} shares near ${inr(buyAt)}`,
        text: `Your average would fall from ${inr(a.avgPrice)} to ${inr(newAvg)}${zone ? ` (agents' buy zone ${inr(zone.low, 0)}–${inr(zone.high, 0)})` : ""}. Only if the long-term case holds and it isn't more than your planned share of the portfolio.` });
    } else if (a.pnlPct > -5 && lt === "ACCUMULATE" && (weightPct === undefined || weightPct < 15)) {
      tips.push({ kind: "add", title: "Add more on dips", text: zone ? `Strong long-term case: add near the buy zone ${inr(zone.low, 0)}–${inr(zone.high, 0)}, not at today's price.` : "Strong long-term case: add on dips of 5-8% rather than at today's price." });
    }
  } else if (a.action !== "SELL" && (lt === "REDUCE" || lt === "EXIT")) {
    tips.push({ kind: "trim", title: "Don't add to it", text: `Long-term case is ${a.longTerm!.grade.toLowerCase()} (${a.longTerm!.score}/100): hold for the trade only, and plan to exit on strength.` });
  }

  // 3. Size.
  if (weightPct !== undefined && weightPct >= 25) tips.push({ kind: "trim", title: `Too much in one stock (${weightPct.toFixed(0)}% of your portfolio)`, text: "Keep any single stock under about 15-20%, so one bad result can't sink the portfolio." });

  // 4. Protect.
  if (a.stop !== undefined) tips.push({ kind: "protect", title: `Stop-loss ${inr(a.stop)}${a.target ? `, target ${inr(a.target)}` : ""}`, text: a.pnlPct >= 10 ? "You're well in profit: the stop is at or above your buy price, so this trade can't turn into a loss." : "Sell if it closes below the stop-loss; review at the target." });

  // 5. Commodity links.
  for (const e of EXPOSURES[d.symbol] ?? []) {
    tips.push({ kind: "commodity", title: `Moves with ${FACTOR[e.factor]} (${e.link === "benefits" ? "rises with it" : e.link === "hurts" ? "falls when it rises" : "mixed"})`, text: `${e.reason.charAt(0).toUpperCase()}${e.reason.slice(1)}.` });
  }
  for (const m of d.macro ?? []) {
    if (m.basis === "measured" && m.points !== 0 && !(EXPOSURES[d.symbol] ?? []).some((e) => e.factor === m.factor))
      tips.push({ kind: "commodity", title: `Tracks ${FACTOR[m.factor as keyof typeof FACTOR] ?? m.factor} lately`, text: m.reason });
  }
  if (COMMODITY_SECTORS.has(d.sector) && !(EXPOSURES[d.symbol] ?? []).length)
    tips.push({ kind: "commodity", title: "A commodity stock", text: `${d.sector} profits follow global ${d.sector === "Metals" ? "metal" : "energy"} prices, so expect bigger swings than the market; size it smaller.` });

  // 6. Earnings.
  if (d.fundamentals?.epsGrowth1y !== undefined && d.fundamentals.epsGrowth1y < -15)
    tips.push({ kind: "info", title: `Earnings fell ${Math.abs(d.fundamentals.epsGrowth1y).toFixed(0)}% in a year`, text: "Check the next results before adding; falling earnings often lead the price lower." });
  return tips;
}

export interface CommodityPick { symbol: string; sector: string; verdict: string; why: string }

/** Steps for the whole portfolio, from the sell-check results. */
export function improvePortfolio(advice: ExitAdvice[], picks: CommodityPick[] = []): { tips: Tip[]; weights: { symbol: string; pct: number }[]; sectors: { sector: string; pct: number }[]; commodityPct: number; goldPct: number } {
  const value = (a: ExitAdvice) => a.qty * a.price;
  const total = advice.reduce((s, a) => s + value(a), 0) || 1;
  const weights = advice.map((a) => ({ symbol: a.symbol, pct: (value(a) / total) * 100 })).sort((a, b) => b.pct - a.pct);
  const bySector = new Map<string, number>();
  for (const a of advice) bySector.set(a.sector, (bySector.get(a.sector) ?? 0) + value(a));
  const sectors = [...bySector].map(([sector, v]) => ({ sector, pct: (v / total) * 100 })).sort((a, b) => b.pct - a.pct);
  const isCommodity = (a: ExitAdvice) => COMMODITY_SECTORS.has(a.sector) || (EXPOSURES[a.symbol] ?? []).some((e) => e.factor !== "usdinr" && e.link !== "mixed");
  const commodityPct = (advice.filter(isCommodity).reduce((s, a) => s + value(a), 0) / total) * 100;
  const goldPct = (advice.filter((a) => /GOLD|SGB/.test(a.symbol)).reduce((s, a) => s + value(a), 0) / total) * 100;
  const tips: Tip[] = [];

  const sell = advice.filter((a) => a.action === "SELL");
  if (sell.length) tips.push({ kind: "act", title: `Exit ${sell.length} weak holding${sell.length > 1 ? "s" : ""}: ${sell.map((a) => a.symbol).join(", ")}`, text: `They're ${(sell.reduce((s, a) => s + value(a), 0) / total * 100).toFixed(0)}% of the portfolio. Moving that money into the holdings with a strong long-term case (or cash) cuts the drag.` });
  const strong = advice.filter((a) => a.longTerm?.action === "ACCUMULATE" && a.action !== "SELL").map((a) => a.symbol);
  if (strong.length) tips.push({ kind: "add", title: `Build up your strongest: ${strong.slice(0, 4).join(", ")}`, text: "Best long-term cases in your portfolio: add to these on dips, within your per-stock limit." });
  if (weights[0] && weights[0].pct >= 25) tips.push({ kind: "trim", title: `${weights[0].symbol} is ${weights[0].pct.toFixed(0)}% of the portfolio`, text: "Keep any one stock under about 15-20%." });
  if (sectors[0] && sectors[0].pct >= 40 && advice.length > 2) tips.push({ kind: "diversify", title: `${sectors[0].pct.toFixed(0)}% in ${sectors[0].sector}`, text: "One sector at 40%+ means one bad news cycle hits most of your money: spread across 4-6 sectors." });
  if (advice.length < 5) tips.push({ kind: "diversify", title: `Only ${advice.length} stock${advice.length > 1 ? "s" : ""}`, text: "8-15 stocks across several sectors spread the risk without being too many to follow." });
  else if (advice.length > 30) tips.push({ kind: "diversify", title: `${advice.length} stocks is a lot to follow`, text: "Fewer, stronger holdings are easier to manage: start with the Sell list." });

  // Commodities
  if (goldPct < 1) tips.push({ kind: "commodity", title: "No gold for balance", text: "Gold often rises when stocks fall. Many investors keep 5-10% in a Gold ETF (e.g. GOLDBEES) or Sovereign Gold Bonds as a cushion; silver ETFs are a smaller, more volatile add-on." });
  if (commodityPct >= 30) tips.push({ kind: "commodity", title: `${commodityPct.toFixed(0)}% tied to commodity prices`, text: "Metal, oil and commodity-linked stocks swing with global prices: keep them nearer 10-20% unless that's a deliberate bet." });
  else if (commodityPct < 3 && picks.length) tips.push({ kind: "commodity", title: "No commodity stocks", text: "A small slice (5-10%) in metals or energy can help when inflation and commodity prices rise." });
  if (picks.length) tips.push({ kind: "commodity", title: "Commodity stocks the agents rate well today", text: picks.slice(0, 4).map((p) => `${p.symbol} (${p.sector}, ${p.verdict}): ${p.why}`).join(" · ") });
  return { tips, weights, sectors, commodityPct, goldPct };
}

/** Commodity-linked stocks from a run that the agents rate BUY or better. */
export function commodityPicks(all: Decision[]): CommodityPick[] {
  return all
    .filter((d) => (d.verdict === "STRONG BUY" || d.verdict === "BUY") && (COMMODITY_SECTORS.has(d.sector) || (EXPOSURES[d.symbol] ?? []).some((e) => e.factor !== "usdinr" && e.link === "benefits")))
    .sort((a, b) => b.combined - a.combined)
    .map((d) => ({ symbol: d.symbol, sector: d.sector, verdict: d.verdict, why: d.longTerm ? `long term ${d.longTerm.score}/100` : `score ${d.combined.toFixed(0)}` }));
}
