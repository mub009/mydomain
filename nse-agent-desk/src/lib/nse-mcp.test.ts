import { describe, expect, it } from "vitest";
import { adjustForActions, dividendAmount } from "./nse-mcp/client";

const bar = (date: string, close: number, volume = 1000) => ({ date, open: close, high: close, low: close, close, volume });

describe("NSE MCP helpers", () => {
  it("adjusts raw bhavcopy prices for a split and a bonus on the same day", () => {
    // Bajaj Finance, June 2025: 1:2 split (0.5) and 4:1 bonus (0.2) both ex on 2025-06-16
    const bars = [bar("2025-06-13", 9331), bar("2025-06-16", 938), bar("2025-06-17", 923)];
    const out = adjustForActions(bars, [
      { exDate: "2025-06-16", actionType: "SPLIT", purpose: "Face Value Split", adjustmentFactor: 0.5 },
      { exDate: "2025-06-16", actionType: "BONUS", purpose: "Bonus 4:1", adjustmentFactor: 0.2 },
      { exDate: "2025-05-30", actionType: "DIVIDEND", purpose: "Dividend - Rs 44 Per Share", adjustmentFactor: 1 },
    ]);
    expect(out[0].close).toBeCloseTo(933.1, 5);
    expect(out[0].volume).toBeCloseTo(10000, 5);
    expect(out[1]).toEqual(bars[1]);
  });

  it("reads rupees per share from NSE dividend descriptions", () => {
    expect(dividendAmount("Interim Dividend - Rs 6.25 Per Share")).toBe(6.25);
    expect(dividendAmount("Dividend - Rs 6.75 Per Share /Special Dividend - Rs 2.75 Per Share")).toBe(9.5);
    expect(dividendAmount("Interim Dividend - Rs  6 Per Share")).toBe(6);
    expect(dividendAmount("Annual General Meeting")).toBe(0);
  });
});
