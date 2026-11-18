import { describe, expect, it } from "vitest";
import { correlation, diversify, type Holding } from "./diversify";
import type { Decision } from "./types";

const L = { sector: 30, stock: 20, smallcap: 30 };
const h = (symbol: string, sector: string, value: number, cap: Holding["cap"] = "Large", closes?: number[]): Holding => ({ symbol, sector, value, cap, closes });

describe("diversification", () => {
  it("a well-spread portfolio grades A with no warnings", () => {
    const d = diversify([h("A", "IT", 100), h("B", "Banks", 100), h("C", "Pharma", 100), h("D", "FMCG", 100), h("E", "Auto", 100), h("F", "Energy", 100)], [], L);
    expect(d.warnings).toEqual([]);
    expect(d.effectiveSectors).toBe(6);
    expect(d.grade).toBe("A");
  });

  it("flags a heavy sector and a heavy stock, and suggests a trim", () => {
    const d = diversify([h("HDFC", "Banks", 500), h("ICICI", "Banks", 200), h("TCS", "IT", 150), h("SUN", "Pharma", 150)], [], L);
    expect(d.bySector[0]).toMatchObject({ name: "Banks", pct: 70 });
    expect(d.warnings.map((w) => w.kind)).toEqual(expect.arrayContaining(["sector", "stock"]));
    expect(d.warnings.find((w) => w.kind === "sector")!.severity).toBe("critical"); // 70% > 1.5 × 30%
    expect(d.suggestions.find((s) => s.action === "trim")!.symbol).toBe("HDFC");
    expect(d.grade === "C" || d.grade === "D").toBe(true);
  });

  it("warns on too many small caps", () => {
    const d = diversify([h("A", "IT", 100, "Small"), h("B", "Banks", 100, "Small"), h("C", "Pharma", 100, "Large")], [], L);
    expect(d.warnings.some((w) => w.kind === "smallcap")).toBe(true);
  });

  it("finds stocks that move together", () => {
    const base = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 2) * 5 + i * 0.1);
    const twin = base.map((x) => x * 2);
    const other = Array.from({ length: 60 }, (_, i) => 100 + Math.cos(i * 1.7) * 3);
    expect(correlation(base, twin)).toBe(1);
    const d = diversify([h("A", "IT", 100, "Large", base), h("B", "Banks", 100, "Large", twin), h("C", "Pharma", 100, "Large", other)], [], L);
    expect(d.correlated).toEqual([{ a: "A", b: "B", rho: 1 }]);
  });

  it("suggests good-rated stocks from sectors you don't hold", () => {
    const cand = (symbol: string, sector: string, verdict: Decision["verdict"], combined: number) => ({ symbol, sector, verdict, combined }) as Decision;
    const d = diversify([h("A", "Banks", 100), h("B", "Banks", 100), h("C", "IT", 100)],
      [cand("SUN", "Pharma", "BUY", 70), cand("CIPLA", "Pharma", "STRONG BUY", 80), cand("ITC", "FMCG", "WATCH", 90), cand("HDFC", "Banks", "STRONG BUY", 95)], L);
    const adds = d.suggestions.filter((s) => s.action === "add").map((s) => s.symbol);
    expect(adds).toEqual(["CIPLA"]); // one per sector, best score; WATCH and the heavy Banks sector are skipped
  });

  it("merges two holdings of the same stock", () => {
    expect(diversify([h("A", "IT", 100), h("A", "IT", 50), h("B", "Banks", 150)], [], L).count).toBe(2);
  });

  it("is n/a when empty", () => expect(diversify([], [], L).grade).toBe("n/a"));
});
