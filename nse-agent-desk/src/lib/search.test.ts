import { describe, expect, it } from "vitest";
import { appSector, localSearch } from "./market/search";
import { registerSectors, sectorOf } from "./market/universe";

describe("stock search", () => {
  it("finds built-in stocks by symbol or company name", () => {
    expect(localSearch("hdfc").stocks.map((s) => s.symbol)).toContain("HDFCBANK");
    expect(localSearch("mahindra").stocks.map((s) => s.symbol)).toContain("M&M");
  });

  it("offers whole sectors as groups", () => {
    const g = localSearch("bank").groups.find((x) => x.name.startsWith("Banks"));
    expect(g?.symbols).toEqual(expect.arrayContaining(["HDFCBANK", "SBIN", "FEDERALBNK", "CUB"]));
    expect(localSearch("pharma").groups[0].symbols).toContain("SUNPHARMA");
  });

  it("maps Yahoo sectors to the app's sectors", () => {
    expect(appSector("Financial Services", "Banks - Regional")).toBe("Banks");
    expect(appSector("Technology", "Information Technology Services")).toBe("IT");
    expect(appSector("Technology", "Consumer Electronics")).toBe("Capital Goods");
    expect(appSector("Consumer Cyclical", "Auto Manufacturers")).toBe("Auto");
    expect(appSector("Basic Materials", "Steel")).toBe("Metals");
    expect(appSector("Healthcare", "Drug Manufacturers - Specialty & Generic")).toBe("Pharma");
    expect(appSector(undefined)).toBeUndefined();
  });

  it("uses searched sectors for stocks outside the built-in lists, never overriding them", () => {
    registerSectors({ DIXON: "Capital Goods", TCS: "Banks" });
    expect(sectorOf("DIXON")).toBe("Capital Goods");
    expect(sectorOf("TCS")).toBe("IT");
  });
});
