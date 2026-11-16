import { useMemo, useState } from "react";
import type { Decision, Verdict } from "../lib/types";
import { Sparkline } from "../components/Sparkline";
import { inr, VerdictBadge } from "../components/ui";

type Key = "symbol" | "combined" | "lotappi" | "mayavi" | "rsi" | "ret5d" | "ret21d";
const FILTERS: ("ALL" | Verdict)[] = ["ALL", "STRONG BUY", "BUY", "WATCH", "AVOID"];

export function Screener({ rows }: { rows: Decision[] }) {
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: "combined", desc: true });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");

  const view = useMemo(() => {
    const r = filter === "ALL" ? rows : rows.filter((d) => d.verdict === filter);
    return [...r].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
      return sort.desc ? -c : c;
    });
  }, [rows, sort, filter]);

  const th = (key: Key, label: string) => (
    <th onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))}
      className={sort.key === key ? "sorted" : ""}>
      {label}{sort.key === key ? (sort.desc ? " ↓" : " ↑") : ""}
    </th>
  );
  const pct = (n: number) => <span className={n >= 0 ? "pos" : "neg"}>{n >= 0 ? "+" : ""}{n.toFixed(1)}%</span>;

  return (
    <>
      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
            {f} ({f === "ALL" ? rows.length : rows.filter((d) => d.verdict === f).length})
          </button>
        ))}
      </div>
      <div className="table-wrap screener-wrap">
        <table className="data">
          <thead>
            <tr>
              {th("symbol", "Stock")}<th>Verdict</th>{th("combined", "Combined")}{th("lotappi", "Lotappi")}
              {th("mayavi", "Mayavi")}<th>Risk</th><th>60-day trend</th>{th("rsi", "RSI")}{th("ret5d", "5D")}{th("ret21d", "1M")}
              <th>Entry</th><th>Stop-loss</th><th>Target</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {view.map((d) => (
              <tr key={d.symbol}>
                <td><b>{d.symbol}</b></td>
                <td><VerdictBadge v={d.verdict} /></td>
                <td className="num"><b>{d.combined}</b></td><td className="num">{d.lotappi}</td><td className="num">{d.mayavi}</td>
                <td className={`risk-${d.risk}`}>{d.risk.toLowerCase()}</td>
                <td><Sparkline data={d.spark} width={80} height={24} /></td>
                <td className="num">{d.rsi}</td><td className="num">{pct(d.ret5d)}</td><td className="num">{pct(d.ret21d)}</td>
                <td className="num">{inr(d.entry)}</td><td className="num">{inr(d.stopLoss)}</td><td className="num">{inr(d.target)}</td>
                <td className="notes">{[...d.notes, ...d.warnings.slice(0, 2)].join("; ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
