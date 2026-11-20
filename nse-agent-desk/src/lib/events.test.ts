import { describe, expect, it } from "vitest";
import { projectDividend } from "./events";

describe("upcoming dividend projection", () => {
  it("moves last year's ex-date a year on", () => {
    expect(projectDividend([{ date: "2026-02-04", amount: 6.5 }, { date: "2026-05-27", amount: 8 }], "2026-11-20"))
      .toEqual({ date: "2027-02-04", amount: 6.5, basedOn: "2026-02-04" });
  });
  it("uses the usual gap for quarterly payers", () => {
    const q = ["2026-02-10", "2026-05-11", "2026-08-10", "2026-11-09"].map((date) => ({ date, amount: 0.25 }));
    expect(projectDividend(q, "2026-11-20")?.date).toBe("2027-02-08"); // median gap 91 days after 2026-11-09
  });
  it("returns nothing outside the window or without history", () => {
    expect(projectDividend([{ date: "2026-08-01", amount: 5 }], "2026-11-20")).toBeUndefined();
    expect(projectDividend([], "2026-11-20")).toBeUndefined();
  });
});
