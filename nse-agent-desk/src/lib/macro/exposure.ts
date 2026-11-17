/**
 * Known business links between Indian stocks and Gold, Brent crude and USD/INR.
 * "benefits": the stock tends to gain when the factor rises; "hurts": the
 * opposite; "mixed": both effects matter, so no score change, only a note.
 * Edit this list to add stocks (e.g. gold-loan companies like MUTHOOTFIN).
 */
export type FactorId = "gold" | "crude" | "usdinr";
export type Link = "benefits" | "hurts" | "mixed";

const IT_EXPORT = "earns most revenue in US dollars, so a weaker rupee lifts its rupee earnings";
const PHARMA_EXPORT = "sells heavily in the US, so a weaker rupee lifts its rupee earnings";

export const EXPOSURES: Record<string, { factor: FactorId; link: Link; reason: string }[]> = {
  ...Object.fromEntries(["TCS", "INFY", "HCLTECH", "WIPRO", "TECHM", "PERSISTENT", "COFORGE", "MPHASIS", "LTTS", "TATAELXSI", "BSOFT", "CYIENT", "SONATSOFTW", "ZENSARTECH", "MASTEK"]
    .map((s) => [s, [{ factor: "usdinr" as const, link: "benefits" as const, reason: IT_EXPORT }]])),
  ...Object.fromEntries(["SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "LUPIN", "AUROPHARMA", "GRANULES", "NATCOPHARM"]
    .map((s) => [s, [{ factor: "usdinr" as const, link: "benefits" as const, reason: PHARMA_EXPORT }]])),
  TRIDENT: [{ factor: "usdinr", link: "benefits", reason: "textile exporter, gains when the rupee weakens" }],
  BPCL: [
    { factor: "crude", link: "hurts", reason: "oil marketing company: costlier crude squeezes fuel margins when pump prices are held" },
    { factor: "usdinr", link: "hurts", reason: "pays for imported crude in dollars" },
  ],
  HINDPETRO: [
    { factor: "crude", link: "hurts", reason: "oil marketing company: costlier crude squeezes fuel margins when pump prices are held" },
    { factor: "usdinr", link: "hurts", reason: "pays for imported crude in dollars" },
  ],
  ONGC: [{ factor: "crude", link: "benefits", reason: "produces and sells crude oil, so higher prices raise its revenue" }],
  ASIANPAINT: [{ factor: "crude", link: "hurts", reason: "many paint raw materials are made from crude oil" }],
  MRF: [{ factor: "crude", link: "hurts", reason: "synthetic rubber and carbon black are crude-based inputs" }],
  BALKRISIND: [{ factor: "crude", link: "hurts", reason: "synthetic rubber and carbon black are crude-based inputs" }],
  RELIANCE: [{ factor: "crude", link: "mixed", reason: "refining and petrochemicals: crude affects both costs and product prices" }],
  TITAN: [{ factor: "gold", link: "mixed", reason: "jewellery maker: costlier gold raises inventory value but can slow buying" }],
};

/** Daily volatility of each factor, used for demo series. */
export const FACTOR_VOL: Record<FactorId, number> = { gold: 0.009, crude: 0.018, usdinr: 0.003 };
/** How strongly demo stocks with a known link move with the factor (per unit of factor return). */
const DEMO_LOAD: Record<FactorId, number> = { gold: 0.5, crude: 0.3, usdinr: 1.6 };

function seeded(str: string) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(rand() || 1e-12)) * Math.cos(2 * Math.PI * rand());
}

const cache = new Map<string, Record<FactorId, number[]>>();
/** Fictional daily returns for gold, crude and USD/INR in a demo run. */
export function demoFactorReturns(seed: number, days: number): Record<FactorId, number[]> {
  const key = `${seed}:${days}`;
  if (cache.has(key)) return cache.get(key)!;
  const out = {} as Record<FactorId, number[]>;
  for (const f of ["gold", "crude", "usdinr"] as FactorId[]) {
    const n = seeded(`factor:${f}:${seed}`);
    // A mild background trend, plus a clearer move in the last month so each run has a story.
    const drift = n() * FACTOR_VOL[f] * 0.02, recent = n() * FACTOR_VOL[f] * 0.08;
    out[f] = Array.from({ length: days }, (_, i) => (i > days - 22 ? recent : drift) + n() * FACTOR_VOL[f]);
  }
  cache.set(key, out);
  return out;
}

/** Extra daily return a demo stock gets from its known factor links. */
export function demoFactorTerm(symbol: string, seed: number, days: number): number[] | null {
  const ex = EXPOSURES[symbol]?.filter((e) => e.link !== "mixed");
  if (!ex?.length) return null;
  const f = demoFactorReturns(seed, days);
  return Array.from({ length: days }, (_, i) => ex.reduce((s, e) => s + (e.link === "benefits" ? 1 : -1) * DEMO_LOAD[e.factor] * f[e.factor][i], 0));
}
