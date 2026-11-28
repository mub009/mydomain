import { describe, expect, it } from "vitest";
import { applyGeo, geoExposures, geoReport, levelOf, scoreTheme, toneOf, type GeoHeadline } from "./geopolitics";

const h = (title: string): GeoHeadline => ({ title, source: "Test", url: "", date: "", tone: toneOf(title) });

describe("Geopolitics Agent", () => {
  it("reads the tone of a headline", () => {
    expect(toneOf("Iran fires missiles at Israel, attack escalates")).toBe("escalation");
    expect(toneOf("Gaza ceasefire talks resume in Cairo")).toBe("calming");
    expect(toneOf("Ceasefire collapses as strikes resume")).toBe("escalation");
    expect(toneOf("Oil ministers meet in Vienna")).toBe("neutral");
    expect(toneOf("Leaders hold talks to end the war in Ukraine")).toBe("calming");
    expect(toneOf("Truce ends as shelling restarts")).toBe("escalation");
  });

  it("scores a region by escalation against calming news, only counting headlines about it", () => {
    const hot = scoreTheme("middleeast", [h("Houthi missile attack on Red Sea tanker"), h("Israel strikes Iran"), h("Iran vows retaliation after attack"), h("Hezbollah drones hit Israel"), h("Russia says nothing"), h("Iran missile barrage kills 4"), h("Gaza airstrike kills dozens")]);
    expect(hot.headlines).toHaveLength(6);
    expect(hot.trend).toBe("Escalating");
    expect(hot.score).toBeGreaterThanOrEqual(50);
    const calm = scoreTheme("russia", [h("Russia and Ukraine agree to ceasefire talks"), h("Peace deal signed with Ukraine")]);
    expect(calm.trend).toBe("Easing");
    expect(calm.score).toBeLessThan(25);
    expect(levelOf(80)).toBe("High"); expect(levelOf(10)).toBe("Calm");
  });

  it("maps tension to Indian stocks: defence and oil producers up, oil users down, capped at ±3", () => {
    const hot = scoreTheme("middleeast", Array.from({ length: 6 }, (_, i) => h(`Missile attack ${i} near Hormuz, Iran warns`)));
    const ex = geoExposures([hot], ["HAL", "ONGC", "BPCL", "INDIGO", "MUTHOOTFIN", "SCI", "TCS"], { crudePct: 4 });
    const by = Object.fromEntries(ex.map((e) => [e.symbol, e.points]));
    expect(by).toMatchObject({ HAL: 2, ONGC: 2, BPCL: -2, INDIGO: -2, MUTHOOTFIN: 1, SCI: 1 });
    expect(by.TCS).toBeUndefined();
    // Crude not reacting: oil effects halved.
    expect(Object.fromEntries(geoExposures([hot], ["BPCL"], { crudePct: 0.2 }).map((e) => [e.symbol, e.points]))).toEqual({ BPCL: -1 });
  });

  it("nothing changes when the world is calm", () => {
    const r = geoReport({ themes: [scoreTheme("middleeast", []), scoreTheme("southasia", [])], sample: false }, undefined, ["HAL", "BPCL"]);
    expect(r.level).toBe("Calm");
    expect(r.exposures).toEqual([]);
    expect(r.summary).toMatch(/calm/);
    const rows = [{ symbol: "HAL", combined: 50, notes: [] }] as never[];
    expect(applyGeo(rows, r)).toBe(rows);
  });

  it("adds the points and a note to the score", () => {
    const hot = scoreTheme("southasia", Array.from({ length: 6 }, (_, i) => h(`Firing at LoC ${i}, Pakistan army attack`)));
    const r = geoReport({ themes: [hot], sample: false }, { crude: Array.from({ length: 10 }, (_, i) => ({ close: 80 + i })) }, ["HAL"]);
    expect(r.markets.crudePct).toBeGreaterThan(5);
    const [row] = applyGeo([{ symbol: "HAL", combined: 60, notes: [] } as never], r) as { combined: number; notes: string[] }[];
    expect(row.combined).toBe(63);
    expect(row.notes[0]).toMatch(/World events \+3: Defence/);
  });
});

describe("calibration", () => {
  it("everyday regional news isn't a crisis", () => {
    const t = scoreTheme("eastasia", [h("Taiwan China trade talks continue"), h("Taiwan's chip exports to China rise"), h("North Korea leader visits factory"), h("China warns Taiwan over US visit"), h("Trade war fears ease as US and China agree tariff pause")]);
    expect(t.score).toBeLessThan(25);
  });
  it("one opinion piece doesn't make a crisis", () => {
    expect(scoreTheme("southasia", [h("Pakistan Army's troubles may push it into a misadventure against India")]).score).toBeLessThan(25);
  });
});

describe("market confirmation", () => {
  it("a tense (not extreme) Middle East counts for oil stocks once crude is up 2%+", () => {
    const mid = scoreTheme("middleeast", [h("Israel strikes Gaza clinic"), h("Iran war hits oil supply"), h("Talks stall in Israel"), h("Gunmen shoot dead cleric in Iran"), h("Iran tension rises"), h("Houthi missile hits Red Sea tanker")]);
    expect(mid.score).toBeGreaterThanOrEqual(45); expect(mid.score).toBeLessThan(60);
    expect(geoExposures([mid], ["BPCL"], { crudePct: 0.5 })).toEqual([]);
    expect(geoExposures([mid], ["BPCL", "HAL"], { crudePct: 3.8 }).map((e) => `${e.symbol} ${e.points}`).sort()).toEqual(["BPCL -2", "HAL 2"]);
  });
});
