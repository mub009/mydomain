import { afterEach, describe, expect, it, vi } from "vitest";
import { checksum, cookieName, kiteApps, normalizeHoldings, normalizePositions, seal, sessionExpiry, unseal } from "./broker/zerodha";

describe("Zerodha", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("makes Kite's checksum", () => {
    // sha256("abc" + "req" + "sec")
    expect(checksum("abc", "req", "sec")).toBe("9a5c8cfd494ff6b4a58bff684e1af903790b22dcad0f88ce4e2781d940da5589");
    expect(checksum("abc", "req", "sec")).not.toBe(checksum("abc", "req", "other"));
  });

  it("ends the session at the next 06:00 IST", () => {
    expect(sessionExpiry(new Date("2026-11-20T10:00:00Z")).toISOString()).toBe("2026-11-21T00:30:00.000Z"); // 15:30 IST -> next 06:00 IST
    expect(sessionExpiry(new Date("2026-11-20T00:00:00Z")).toISOString()).toBe("2026-11-20T00:30:00.000Z"); // 05:30 IST -> same morning
  });

  it("seals the session cookie so it can't be read or changed", () => {
    vi.stubEnv("KITE_API_SECRET", "secret-1");
    const s = { token: "tok123", userId: "AB1234", name: "Test", exp: Date.now() + 3600e3 };
    const v = seal(s);
    expect(v).not.toContain("tok123");
    expect(unseal(v)).toEqual(s);
    expect(unseal(v.slice(0, -2) + (v.endsWith("A") ? "BB" : "AA"))).toBeNull(); // tampered
    vi.stubEnv("KITE_API_SECRET", "secret-2");
    expect(unseal(v)).toBeNull(); // another key
  });

  it("drops an expired session", () => {
    vi.stubEnv("KITE_API_SECRET", "k");
    expect(unseal(seal({ token: "t", userId: "u", exp: Date.now() - 1 }))).toBeNull();
  });

  it("turns Kite holdings into rows, counting shares still settling", () => {
    const h = normalizeHoldings([
      { tradingsymbol: "INFY", exchange: "NSE", quantity: 10, t1_quantity: 5, average_price: 1400, last_price: 1500, close_price: 1480, pnl: 1500, day_change_percentage: 1.35 },
      { tradingsymbol: "OLD", exchange: "NSE", quantity: 0, average_price: 10, last_price: 12, close_price: 12, pnl: 0 },
      { tradingsymbol: "TCS", exchange: "NSE", quantity: 2, average_price: 4000, last_price: 3000, close_price: 3100, pnl: -2000 },
    ]);
    expect(h.map((x) => x.symbol)).toEqual(["INFY", "TCS"]); // sold-out row dropped, largest first
    expect(h[0]).toMatchObject({ qty: 15, invested: 21000, value: 22500, pnlPct: 7.14, dayChangePct: 1.35 });
    expect(h[1].dayChangePct).toBe(-3.23);
  });

  it("reads today's net positions", () => {
    const p = normalizePositions({ net: [{ tradingsymbol: "SBIN", exchange: "NSE", product: "MIS", quantity: -50, average_price: 800, last_price: 790, pnl: 500, m2m: 500 }] });
    expect(p[0]).toMatchObject({ symbol: "SBIN", product: "MIS", qty: -50, pnl: 500 });
  });

  it("finds one Kite Connect app per account, each with its own cookie", () => {
    vi.stubEnv("KITE_API_KEY", "k1"); vi.stubEnv("KITE_API_SECRET", "s1");
    vi.stubEnv("KITE_API_KEY_3", "k3"); vi.stubEnv("KITE_API_SECRET_3", "s3");
    vi.stubEnv("KITE_API_KEY_2", "k2"); // no secret: skipped
    expect(kiteApps().map((a) => a.slot)).toEqual([1, 3]);
    expect([cookieName(1), cookieName(3)]).toEqual(["kite_session", "kite_session_3"]);
    const v = seal({ token: "t", userId: "u", exp: Date.now() + 1000 }, "s3");
    expect(unseal(v, Date.now(), "s3")?.token).toBe("t");
    expect(unseal(v, Date.now(), "s1")).toBeNull(); // one account's cookie can't be read with another's key
  });
});
