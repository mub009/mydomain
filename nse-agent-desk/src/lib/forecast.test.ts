import { describe, expect, it } from "vitest";
import { forecast } from "./forecast";
import { demoBars } from "./market/demo";
import type { Bar } from "./types";

const bars = demoBars("TCS", 5);
const last = bars.at(-1)!.close;
const f = forecast(bars, { horizon: 21, stop: last * 0.94, target: last * 1.12, seed: "t" });

describe("forecast", () => {
  it("starts at today's price and fans out", () => {
    const today = f.points.find((p) => p.t === 0)!;
    expect(today.p50).toBeCloseTo(last, 1);
    const d1 = f.points.find((p) => p.t === 1)!, dN = f.points.at(-1)!;
    expect(dN.p90! - dN.p10!).toBeGreaterThan(d1.p90! - d1.p10!);
    for (const p of f.points.filter((x) => x.t > 0)) expect(p.p10! <= p.p25! && p.p25! <= p.p50! && p.p50! <= p.p75! && p.p75! <= p.p90!).toBe(true);
  });
  it("has 60 days of history and the right horizon", () => {
    expect(f.points.filter((p) => p.t <= 0)).toHaveLength(60);
    expect(f.points.filter((p) => p.t > 0)).toHaveLength(21);
  });
  it("odds add up to 100%", () => expect(f.probTarget + f.probStop + f.probNeither).toBeCloseTo(100, 0));
  it("is repeatable", () => expect(forecast(bars, { horizon: 21, stop: last * 0.94, target: last * 1.12, seed: "t" }).median).toBe(f.median));
  it("a target closer than the stop is reached more often", () => {
    const near = forecast(bars, { horizon: 21, stop: last * 0.8, target: last * 1.02, seed: "t" });
    expect(near.probTarget).toBeGreaterThan(near.probStop);
  });
  it("its 80% ranges hold about 80% of the time on a random walk", () => {
    let c = 100, x = 7;
    const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const walk: Bar[] = Array.from({ length: 600 }, (_, i) => {
      c *= Math.exp(0.015 * Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd()));
      return { date: `d${i}`, open: c, high: c, low: c, close: c, volume: 1 };
    });
    const w = forecast(walk, { horizon: 10, stop: c * 0.9, target: c * 1.1, seed: "w" });
    expect(w.calibration!.checks).toBeGreaterThan(30);
    expect(w.calibration!.coverage).toBeGreaterThanOrEqual(65);
    expect(w.calibration!.coverage).toBeLessThanOrEqual(95);
  });
});
