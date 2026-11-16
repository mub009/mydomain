import type { Decision } from "../lib/types";

export const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const verdictClass = (v: string) => "verdict v-" + v.replace(" ", "-").toLowerCase();

export function Picks({ picks }: { picks: Decision[] }) {
  if (!picks.length)
    return <div className="empty">No stock passes the buy rules today. Staying in cash is a valid decision.</div>;
  return (
    <div className="picks">
      {picks.map((d, i) => (
        <article key={d.symbol} className="pick">
          <header>
            <span className="rank">#{i + 1}</span>
            <h3>{d.symbol}</h3>
            <span className={verdictClass(d.verdict)}>{d.verdict}</span>
          </header>
          <div className="levels">
            <div><span>Entry</span><b>{inr(d.entry)}</b></div>
            <div><span>Stop-loss</span><b className="neg">{inr(d.stopLoss)}</b></div>
            <div><span>Target</span><b className="pos">{inr(d.target)}</b></div>
          </div>
          <div className="scores">
            <span>Combined <b>{d.combined}</b></span>
            <span>Lotappi <b>{d.lotappi}</b></span>
            <span>Mayavi <b>{d.mayavi}</b></span>
            <span>Risk <b className={`risk-${d.risk}`}>{d.risk}</b></span>
          </div>
          <p className="horizon">{d.horizon}</p>
          {d.quantity !== undefined && (
            <p className="qty">Suggested: <b>{d.quantity} shares</b> ({inr(d.investment ?? 0)})</p>
          )}
          <ul className="reasons">{d.reasons.slice(0, 4).map((r) => <li key={r}>{r}</li>)}</ul>
          {d.clarification && <p className="clar">Mubashir: {d.clarification}</p>}
        </article>
      ))}
    </div>
  );
}
