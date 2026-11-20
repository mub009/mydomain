/**
 * Central Bank Agent (research team): RBI and US Federal Reserve policy.
 *
 *  RBI   current policy rates from rbi.org.in (repo, SDF, MSF, bank rate, CRR,
 *        SLR); the latest Monetary Policy Committee decision, stance, inflation
 *        projection and next meeting from RBI's own MPC press release.
 *  Fed   the federal funds target range and its last change, and the FOMC
 *        meeting calendar, from federalreserve.gov.
 *
 * Effect on stocks: rate-sensitive sectors (NBFCs, realty, autos, capital
 * goods, infrastructure, cement, building materials, consumer durables) get
 * -2 when the RBI is tightening (a hike or a tightening stance) and +2 when it
 * is easing; banks are mixed (wider margins, slower loan growth) and get no
 * points. A policy meeting inside a holding period is reported as an event.
 */
export interface MeetingDate { label: string; decisionDate: string }
export interface PolicyReport {
  rbi: { repo: number; sdf?: number; msf?: number; bankRate?: number; crr?: number; slr?: number; source: string } | null;
  lastMpc?: { decision: "hike" | "cut" | "hold"; bps?: number; stance?: string; meeting?: string; inflation?: string; url: string; title: string };
  nextMpc?: MeetingDate;
  fed?: { range: string; lastChange?: { date: string; bps: number; dir: "hike" | "cut" }; nextMeeting?: MeetingDate; upcoming?: MeetingDate[]; source: string };
  direction: "tightening" | "easing" | "neutral";
  sample: boolean;
}

export const RATE_SENSITIVE = new Set(["Financials", "Realty", "Auto", "Capital Goods", "Infrastructure", "Cement", "Building Materials", "Consumer"]);
export const MIXED = new Set(["Banks"]);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const clean = (html: string) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const pad = (n: number) => String(n).padStart(2, "0");
const num = (s?: string) => (s ? Number(s) : undefined);

/** "Policy Repo Rate : 5.50% Standing Deposit Facility Rate : 5.25% ..." from RBI's home page. */
export function parseRbiRates(html: string): PolicyReport["rbi"] {
  const t = clean(html);
  const g = (label: string) => num(new RegExp(`${label}\\s*:\\s*([\\d.]+)\\s*%`, "i").exec(t)?.[1]);
  const repo = g("Policy Repo Rate");
  if (repo === undefined) return null;
  return { repo, sdf: g("Standing Deposit Facility Rate"), msf: g("Marginal Standing Facility Rate"), bankRate: g("Bank Rate"), crr: g("CRR"), slr: g("SLR"), source: "https://www.rbi.org.in/" };
}

/** "December 2 to 4, 2026" or "September 29 to October 1, 2026": the decision is announced on the last day. */
export function parseMeeting(label: string): MeetingDate | undefined {
  const m = /([A-Z][a-z]+)\s+(\d{1,2})\s*(?:to|-|–)\s*(?:([A-Z][a-z]+)\s+)?(\d{1,2}),?\s*(\d{4})/.exec(label);
  if (!m) return undefined;
  const mon = MONTHS.indexOf(m[3] ?? m[1]);
  if (mon < 0) return undefined;
  return { label: m[0], decisionDate: `${m[5]}-${pad(mon + 1)}-${pad(Number(m[4]))}` };
}

/** Decision, stance, inflation projection and next meeting from an RBI MPC resolution or minutes page. */
export function parseMpcRelease(html: string): Omit<NonNullable<PolicyReport["lastMpc"]>, "url" | "title"> & { next?: MeetingDate } {
  const t = clean(html);
  const raise = /(?:increase|raise|hike)\s+the policy repo rate[^.]*?by\s+(\d+)\s*(?:bps|basis points)/i.exec(t);
  const cut = /(?:reduce|cut|lower)\s+the policy repo rate[^.]*?by\s+(\d+)\s*(?:bps|basis points)/i.exec(t);
  const hold = /(?:keep|kept|leave)\s+the policy repo rate[^.]*?unchanged/i.test(t);
  const decision: "hike" | "cut" | "hold" = raise ? "hike" : cut ? "cut" : hold ? "hold" : "hold";
  const stance = /(?:change|changed)\s+the stance\s+to\s+([a-z ]+?)(?:\s+and|\.|,)/i.exec(t)?.[1] ?? /(?:remain|continue with (?:the|its)?)\s+([a-z]+(?: [a-z]+)?)\s+(?:in its\s+)?stance/i.exec(t)?.[1];
  const meeting = /Meeting,?\s+([A-Z][a-z]+\s+\d{1,2}\s*(?:to|-)\s*(?:[A-Z][a-z]+\s+)?\d{1,2},\s*\d{4})/.exec(t)?.[1];
  const inflation = /CPI inflation (?:for \d{4}-\d{2} )?is projected (?:to be|at)\s+([\d.]+\s*per cent)/i.exec(t)?.[1];
  const nextLabel = /next meeting of the MPC is scheduled (?:for|during|on)\s+([^.]+\d{4})/i.exec(t)?.[1];
  return { decision, bps: num(raise?.[1] ?? cut?.[1]), stance: stance?.trim(), meeting, inflation, next: nextLabel ? parseMeeting(nextLabel) : undefined };
}

/** Federal funds target range and its latest change from federalreserve.gov/monetarypolicy/openmarket.htm. */
export function parseFedRate(html: string): { range: string; lastChange?: { date: string; bps: number; dir: "hike" | "cut" } } | undefined {
  const firstTable = html.search(/<table/i);
  if (firstTable < 0) return undefined;
  const year = [...html.slice(0, firstTable).matchAll(/\b(20\d\d)\b/g)].pop()?.[1];
  const row = [...html.slice(firstTable).matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => clean(r[1]).trim()).find((r) => /\d+\.\d+\s*-\s*\d+\.\d+/.test(r));
  const m = row && /([A-Z][a-z]+)\s+(\d{1,2})\s+(\d+)\s+(\d+)\s+([\d.]+\s*-\s*[\d.]+)/.exec(row);
  if (!m) return undefined;
  const inc = Number(m[3]), dec = Number(m[4]);
  return { range: m[5].replace(/\s/g, ""), lastChange: year ? { date: `${year}-${pad(MONTHS.indexOf(m[1]) + 1)}-${pad(Number(m[2]))}`, bps: inc || dec, dir: inc ? "hike" : "cut" } : undefined };
}

/** FOMC meetings (decision on the last day) from federalreserve.gov/monetarypolicy/fomccalendars.htm. */
export function parseFomc(html: string): MeetingDate[] {
  const t = clean(html);
  const out: MeetingDate[] = [];
  for (const sec of t.matchAll(/(\d{4}) FOMC Meetings([\s\S]*?)(?=\d{4} FOMC Meetings|$)/g)) {
    const year = sec[1];
    const body = sec[2].split(/Note:/)[0]; // footnotes mention other years' meetings
    for (const m of body.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)(?:\/([A-Z][a-z]+))?\s+(\d{1,2})-(\d{1,2})\b/g)) {
      const endMonth = m[2] && MONTHS.includes(m[2]) ? m[2] : m[1];
      out.push({ label: `${m[1]} ${m[3]}-${m[2] ? `${m[2]} ` : ""}${m[4]}, ${year}`, decisionDate: `${year}-${pad(MONTHS.indexOf(endMonth) + 1)}-${pad(Number(m[4]))}` });
    }
  }
  return [...new Map(out.map((x) => [x.decisionDate, x])).values()].sort((a, b) => a.decisionDate.localeCompare(b.decisionDate));
}

const get = async (url: string) => {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

let cache: { at: number; v: PolicyReport } | null = null;

export async function loadPolicy(demo: boolean, today = new Date(Date.now() + 19800_000).toISOString().slice(0, 10)): Promise<PolicyReport | null> {
  if (demo) {
    return {
      rbi: { repo: 6.0, sdf: 5.75, msf: 6.25, bankRate: 6.25, crr: 4, slr: 18, source: "Sample (demo)" },
      lastMpc: { decision: "hold", stance: "neutral", meeting: "sample meeting", url: "", title: "Sample MPC resolution (demo)" },
      nextMpc: { label: "sample", decisionDate: new Date(Date.parse(today) + 20 * 86400_000).toISOString().slice(0, 10) },
      direction: "neutral", sample: true,
    };
  }
  if (cache && Date.now() - cache.at < 3 * 3600_000) return cache.v;
  const [home, fomc, open] = await Promise.allSettled([
    get("https://www.rbi.org.in/"),
    get("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"),
    get("https://www.federalreserve.gov/monetarypolicy/openmarket.htm"),
  ]);
  const homeHtml = home.status === "fulfilled" ? home.value : "";
  const rbi = homeHtml ? parseRbiRates(homeHtml) : null;
  // Latest MPC release linked from RBI's home page (resolution, statement or minutes).
  let lastMpc: PolicyReport["lastMpc"], nextMpc: MeetingDate | undefined;
  const link = [...homeHtml.matchAll(/<a[^>]+href="([^"]*BS_PressReleaseDisplay\.aspx\?prid=\d+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ url: m[1].startsWith("http") ? m[1] : `https://www.rbi.org.in${m[1].startsWith("/") ? "" : "/"}${m[1]}`, title: clean(m[2]).trim() }))
    .find((l) => /monetary policy (?:committee|statement)|resolution of the mpc/i.test(l.title));
  if (link) {
    try {
      const p = parseMpcRelease(await get(link.url));
      lastMpc = { decision: p.decision, bps: p.bps, stance: p.stance, meeting: p.meeting, inflation: p.inflation, url: link.url, title: link.title };
      nextMpc = p.next;
    } catch { /* keep the rates only */ }
  }
  let fed: PolicyReport["fed"];
  const rate = open.status === "fulfilled" ? parseFedRate(open.value) : undefined;
  const meetings = fomc.status === "fulfilled" ? parseFomc(fomc.value) : [];
  if (rate || meetings.length) fed = { range: rate?.range ?? "n/a", lastChange: rate?.lastChange, nextMeeting: meetings.find((m) => m.decisionDate >= today), upcoming: meetings.filter((m) => m.decisionDate >= today).slice(0, 4), source: "https://www.federalreserve.gov/monetarypolicy/" };
  if (!rbi && !fed) return null;
  const tightening = lastMpc?.decision === "hike" || /tighten/i.test(lastMpc?.stance ?? "");
  const easing = lastMpc?.decision === "cut" || /accommodat|eas/i.test(lastMpc?.stance ?? "");
  const v: PolicyReport = { rbi, lastMpc, nextMpc, fed, direction: tightening ? "tightening" : easing ? "easing" : "neutral", sample: false };
  cache = { at: Date.now(), v };
  return v;
}

/** Score effect and a one-line reason for a stock in `sector`. */
export function policyEffect(p: PolicyReport | null, sector: string): { points: number; effect: "Tailwind" | "Headwind" | "Mixed" | "Neutral"; reason: string } | null {
  if (!p || p.direction === "neutral") return null;
  const what = p.direction === "tightening" ? `RBI is tightening${p.lastMpc?.decision === "hike" ? ` (repo raised ${p.lastMpc.bps ?? ""} bps to ${p.rbi?.repo ?? "?"}%)` : ""}` : `RBI is easing${p.lastMpc?.decision === "cut" ? ` (repo cut ${p.lastMpc.bps ?? ""} bps to ${p.rbi?.repo ?? "?"}%)` : ""}`;
  if (RATE_SENSITIVE.has(sector)) {
    const points = p.direction === "tightening" ? -2 : 2;
    return { points, effect: points > 0 ? "Tailwind" : "Headwind", reason: `${what}; ${sector} is rate-sensitive (borrowing costs and loan demand)` };
  }
  if (MIXED.has(sector)) return { points: 0, effect: "Mixed", reason: `${what}; for banks this means ${p.direction === "tightening" ? "wider lending margins but slower loan growth" : "faster loan growth but thinner margins"}` };
  return null;
}
