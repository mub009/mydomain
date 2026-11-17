import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyPrice, checkPositions, newPosition } from "./positions/monitor";
import { demoPrice } from "./positions/prices";
import { evaluate, exitPlan, health } from "./positions/rules";
import { readState, resetCache, update } from "./positions/store";

// buy 100, stop 95 (risk 5), first exit 105, target 110
const pos = () => newPosition({ symbol: "TESTCO", qty: 10, buyPrice: 100, stop: 95, target: 110, feed: "demo" });

describe("exit plan", () => {
  it("first exit is buy price + 1x risk", () => expect(exitPlan(100, 95, 110).partial).toBe(105));
});

describe("follow-up alerts", () => {
  it("warns on a 3% loss, then near the stop, then on the stop", () => {
    const p = pos();
    expect(applyPrice(p, 99).map((a) => a.kind)).toEqual([]);
    expect(applyPrice(p, 96.9).map((a) => a.kind)).toEqual(["loss"]);
    expect(applyPrice(p, 95.5).map((a) => a.kind)).toEqual(["near-stop"]);
    const hit = applyPrice(p, 94.8);
    expect(hit.map((a) => a.kind)).toEqual(["stop-hit"]);
    expect(hit[0].severity).toBe("critical");
    expect(hit[0].from).toBe("Lotappi");
    expect(hit[0].text).toMatch(/Exit the position/);
  });

  it("each alert fires once; near-stop re-arms after a recovery", () => {
    const p = pos();
    expect(applyPrice(p, 95.5).map((a) => a.kind)).toContain("near-stop");
    expect(applyPrice(p, 95.4)).toEqual([]);
    applyPrice(p, 98); // recovered more than 2% above the stop
    expect(applyPrice(p, 95.6).map((a) => a.kind)).toEqual(["near-stop"]);
  });

  it("at the first exit: book half and move the stop to the buy price", () => {
    const p = pos();
    const a = applyPrice(p, 105.5);
    expect(a.map((x) => x.kind)).toEqual(["partial"]);
    expect(a[0].text).toMatch(/Book half \(5 shares\)/);
    expect(p.stop).toBe(100);
    // a fall back to the buy price is now a stop-hit, at no loss
    expect(applyPrice(p, 99.9).map((x) => x.kind)).toEqual(["stop-hit"]);
  });

  it("near target, then target hit (from Mayavi)", () => {
    const p = pos();
    applyPrice(p, 105.2);
    expect(applyPrice(p, 108).map((a) => a.kind)).toEqual(["near-target"]);
    const t = applyPrice(p, 110.4);
    expect(t.map((a) => a.kind)).toEqual(["target-hit"]);
    expect(t[0].from).toBe("Mayavi");
  });

  it("health labels", () => {
    const p = pos();
    expect(health(p, 94)).toBe("Stop hit");
    expect(health(p, 95.5)).toBe("Near stop");
    expect(health(p, 96.5)).toBe("In loss");
    expect(health(p, 101)).toBe("Healthy");
    expect(health(p, 106)).toBe("First exit hit");
    expect(health(p, 108)).toBe("Near target");
    expect(health(p, 111)).toBe("Target hit");
  });

  it("a jump straight past the target fires only target-hit", () => {
    const r = evaluate(pos(), 120);
    expect(r.fired.map((f) => f.kind)).toEqual(["target-hit"]);
  });
});

describe("demo price feed", () => {
  it("starts at the buy price and is repeatable", () => {
    const p = pos();
    expect(demoPrice(p, new Date(p.openedAt))).toBe(100);
    const later = new Date(new Date(p.openedAt).getTime() + 30 * 60000);
    expect(demoPrice(p, later)).toBe(demoPrice(p, later));
    expect(demoPrice(p, later)).not.toBe(100);
  });
});

describe("monitor with storage", () => {
  beforeEach(() => { vi.stubEnv("NSE_DESK_DATA_DIR", mkdtempSync(path.join(tmpdir(), "desk-"))); resetCache(); });
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); resetCache(); });

  it("saves positions, checks them and stores alerts", async () => {
    const p = pos();
    p.openedAt = new Date(Date.now() - 6 * 3600 * 1000).toISOString(); // 6 hours of demo moves
    await update((s) => { s.positions.push(p); });
    await checkPositions("demo");
    const s = await readState();
    expect(s.positions[0].lastPrice).toBeGreaterThan(0);
    expect(s.lastRunAt).toBeDefined();
    resetCache();
    expect((await readState()).positions[0].id).toBe(p.id); // persisted to disk
  });

  it("sends Telegram messages when configured", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc"); vi.stubEnv("TELEGRAM_CHAT_ID", "42");
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const p = pos(); p.buyPrice = 1000; p.stop = 999.99; p.partial = 1000.01; p.target = 1000.02; // any move fires
    p.openedAt = new Date(Date.now() - 3600 * 1000).toISOString();
    await update((s) => { s.positions.push(p); });
    const alerts = await checkPositions("demo");
    expect(alerts.length).toBeGreaterThan(0);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    expect(JSON.parse(String(init.body)).chat_id).toBe("42");
    vi.unstubAllGlobals();
  });
});
