import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshNote } from "./broker/refresh-note";
import { safePath } from "./desk-path";

describe("Zerodha refresh note", () => {
  const ch = (symbol: string, qty: number, clientId = "ZX1234") => ({ accountId: 1, clientId, symbol, qty });
  it("lists sold and new stocks", () => {
    expect(refreshNote({ removed: [ch("ITC", 20)], added: [ch("TCS", 3)], errors: [] }, 1))
      .toEqual(["Refreshed from Zerodha. Removed 1 sold: ITC (20 sh). New: TCS (3 sh).", true]);
    expect(refreshNote({ removed: [ch("ITC", 20, "AB1")], added: [], errors: [] }, 2)[0]).toContain("ITC (20 sh, AB1)");
  });
  it("says when nothing changed, and when an account couldn't refresh", () => {
    expect(refreshNote({ removed: [], added: [], errors: [] }, 1)[0]).toMatch(/No stocks bought or sold/);
    expect(refreshNote({ removed: [], added: [], errors: [{ accountId: 1, clientId: "ZX1234", message: "Session ended" }] }, 1)).toEqual(["Couldn't refresh ZX1234: Session ended", false]);
  });
});

describe("desk API proxy paths", () => {
  it("allows API paths and stock symbols, never dot segments", () => {
    expect(safePath(["zerodha", "refresh"])).toBe(true);
    expect(safePath(["watchlist", "M&M"])).toBe(true);
    expect(safePath(["watchlist", "BAJAJ-AUTO"])).toBe(true);
    expect(safePath(["watchlist", ".."])).toBe(false);
    expect(safePath(["auth", "lo gin"])).toBe(false);
    expect(safePath(["a?b=1"])).toBe(false);
    expect(safePath([])).toBe(false);
  });
});

describe("watchlist in this browser (not logged in)", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
    vi.resetModules();
  });

  it("adds, keeps the first price, updates notes and removes", async () => {
    const { useWatchlist } = await import("../store/watchlist");
    const w = useWatchlist.getState();
    await w.load();
    expect(useWatchlist.getState().where).toBe("browser");
    await w.add("infy", { price: 1500 });
    await w.add("TCS");
    await useWatchlist.getState().add("INFY", { note: "Wait for 1400", price: 9 });
    const items = useWatchlist.getState().items;
    expect(items.map((x) => x.symbol)).toEqual(["TCS", "INFY"]);
    expect(items[1]).toMatchObject({ addedPrice: 1500, note: "Wait for 1400" });
    expect(useWatchlist.getState().has("TCS")).toBe(true);
    await useWatchlist.getState().remove("TCS");
    expect(JSON.parse(store.get("nse-desk-watchlist-v1")!).map((x: { symbol: string }) => x.symbol)).toEqual(["INFY"]);
  });

  it("reads back what was saved", async () => {
    store.set("nse-desk-watchlist-v1", JSON.stringify([{ symbol: "SBIN" }, { bad: 1 }]));
    const { useWatchlist } = await import("../store/watchlist");
    await useWatchlist.getState().load();
    expect(useWatchlist.getState().items.map((x) => x.symbol)).toEqual(["SBIN"]);
  });
});
