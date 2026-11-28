import { describe, expect, it, vi } from "vitest";
import { skippedNote } from "./dialogue";
import { loadFundamentals } from "./fundamentals";
import { BOTTOM_SHARE, rankQuick, shortlist, type QuickRow } from "./market/prescreen";

const row = (symbol: string, bottom: number, ret21: number): Omit<QuickRow, "score"> =>
  ({ symbol, close: 100, ret21, ret63: ret21, offHigh: 5, above50: true, above200: true, tradedCr: 5, bottom });

describe("full research size", () => {
  it("keeps a bigger share for stocks turning up from a bottom on bigger lists", () => {
    expect(Math.round(150 * BOTTOM_SHARE)).toBe(40);
    expect(Math.round(250 * BOTTOM_SHARE)).toBe(67);
    expect(Math.round(400 * BOTTOM_SHARE)).toBe(107);
    const rows = rankQuick([
      ...Array.from({ length: 600 }, (_, i) => row(`UP${i}`, 0, 30 - i / 20)),
      ...Array.from({ length: 200 }, (_, i) => row(`LOW${i}`, 100, -5)),
    ]);
    const s = shortlist(rows, 400);
    expect(s.rows).toHaveLength(400);
    expect(s.bottoms).toBe(107);
  });

  it("stops checking fundamentals after the time limit", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const f = await loadFundamentals({ TCS: 3000, INFY: 1500 }, false, 0, Date.now() - 1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(f.TCS.cap).toBe("Unknown");
    vi.unstubAllGlobals();
  });

  it("counts stocks not loaded in time instead of listing them", () => {
    expect(skippedNote(["XYZ (not enough history)", "A (time limit)", "B (time limit)"]))
      .toBe(" · skipped: XYZ (not enough history) · 2 stocks not loaded in time (data sources were slow), so they weren't researched this run");
    expect(skippedNote([])).toBe("");
  });
});
