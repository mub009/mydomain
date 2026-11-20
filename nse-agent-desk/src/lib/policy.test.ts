import { describe, expect, it } from "vitest";
import { parseFedRate, parseFomc, parseMeeting, parseMpcRelease, parseRbiRates, policyEffect, type PolicyReport } from "./policy";

describe("Central Bank Agent", () => {
  it("reads RBI's current rates", () => {
    const html = `<div>Policy Repo Rate : 5.50% <br/>Standing Deposit Facility Rate : 5.25% Marginal Standing Facility Rate : 5.75% Bank Rate : 5.75% Reserve&nbsp;Ratios CRR : 3.00% SLR : 18.00%</div>`;
    expect(parseRbiRates(html)).toMatchObject({ repo: 5.5, sdf: 5.25, msf: 5.75, bankRate: 5.75, crr: 3, slr: 18 });
  });

  it("reads an MPC decision, stance and next meeting", () => {
    const html = `<p>Minutes of the Monetary Policy Committee Meeting, October 5 to 7, 2026</p><p>the MPC voted unanimously to increase the policy repo rate under the liquidity adjustment facility (LAF) by 25 bps to 5.50 per cent. The MPC also decided to change the stance to calibrated tightening. CPI inflation is projected at 5.2 per cent. The next meeting of the MPC is scheduled for December 2 to 4, 2026.</p>`;
    expect(parseMpcRelease(html)).toMatchObject({ decision: "hike", bps: 25, stance: "calibrated tightening", meeting: "October 5 to 7, 2026", inflation: "5.2 per cent", next: { decisionDate: "2026-12-04" } });
    expect(parseMpcRelease("<p>decided to keep the policy repo rate unchanged at 6.50 per cent and remain focused on withdrawal of accommodation</p>").decision).toBe("hold");
    expect(parseMpcRelease("<p>decided to reduce the policy repo rate by 50 basis points to 5.50 per cent</p>")).toMatchObject({ decision: "cut", bps: 50 });
  });

  it("handles meetings that cross a month", () => {
    expect(parseMeeting("September 29 to October 1, 2026")?.decisionDate).toBe("2026-10-01");
  });

  it("reads the Fed's rate and calendar", () => {
    const rate = `<h4>2026</h4><table><tr><th>Date</th><th>Increase</th><th>Decrease</th><th>Level (%)</th></tr><tr><td>September 17</td><td>25</td><td>0</td><td>3.75-4.00</td></tr></table>`;
    expect(parseFedRate(rate)).toEqual({ range: "3.75-4.00", lastChange: { date: "2026-09-17", bps: 25, dir: "hike" } });
    const cal = `<h4>2026 FOMC Meetings</h4> January 27-28 ... December 8-9 <h4>2027 FOMC Meetings</h4> January 26-27 March 16-17 Note: A two-day meeting is scheduled for January 25-26, 2028.`;
    expect(parseFomc(cal).map((m) => m.decisionDate)).toEqual(["2026-01-28", "2026-12-09", "2027-01-27", "2027-03-17"]);
  });

  it("moves rate-sensitive sectors with the RBI's direction; banks are mixed", () => {
    const p = { rbi: { repo: 5.5, source: "" }, lastMpc: { decision: "hike", bps: 25, url: "", title: "" }, direction: "tightening", sample: false } as PolicyReport;
    expect(policyEffect(p, "Realty")?.points).toBe(-2);
    expect(policyEffect(p, "Banks")).toMatchObject({ points: 0, effect: "Mixed" });
    expect(policyEffect(p, "IT")).toBeNull();
    expect(policyEffect({ ...p, direction: "easing" }, "Auto")?.points).toBe(2);
    expect(policyEffect({ ...p, direction: "neutral" }, "Auto")).toBeNull();
  });
});
