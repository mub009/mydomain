import { useMemo, useState } from "react";
import type { Decision, Verdict } from "../lib/types";
import { inr, verdictClass } from "./Picks";

type Key = "symbol" | "combined" | "lotappi" | "mayavi" | "rsi" | "ret5d" | "ret21d";
const FILTERS: ("ALL" | Verdict)[] = ["ALL", "STRONG BUY", "BUY", "WATCH", "AVOID"];

export function AllStocks({ rows }: { rows: Decision[] }) {
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
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {th("symbol", "Stock")}<th>Verdict</th>{th("combined", "Combined")}{th("lotappi", "Lotappi")}
              {th("mayavi", "Mayavi")}<th>Risk</th>{th("rsi", "RSI")}{th("ret5d", "5D")}{th("ret21d", "1M")}
              <th>Entry</th><th>Stop-loss</th><th>Target</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {view.map((d) => (
              <tr key={d.symbol}>
                <td><b>{d.symbol}</b></td>
                <td><span className={verdictClass(d.verdict)}>{d.verdict}</span></td>
                <td>{d.combined}</td><td>{d.lotappi}</td><td>{d.mayavi}</td>
                <td className={`risk-${d.risk}`}>{d.risk}</td>
                <td>{d.rsi}</td><td>{pct(d.ret5d)}</td><td>{pct(d.ret21d)}</td>
                <td>{inr(d.entry)}</td><td>{inr(d.stopLoss)}</td><td>{inr(d.target)}</td>
                <td className="notes">{[...d.notes, ...d.warnings.slice(0, 2)].join("; ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
