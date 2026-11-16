"""Save the result as JSON and as a simple HTML report."""
from __future__ import annotations

import html
import json
from datetime import datetime
from pathlib import Path

COLORS = {"STRONG BUY": "#0a7d32", "BUY": "#2e9d4f", "WATCH": "#b7791f", "AVOID": "#b23b3b"}


def save(result: dict, out_dir: str = "reports") -> tuple[Path, Path]:
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    jpath = Path(out_dir) / f"picks_{stamp}.json"
    hpath = Path(out_dir) / f"report_{stamp}.html"
    jpath.write_text(json.dumps(result, indent=2, default=str))
    hpath.write_text(to_html(result))
    return jpath, hpath


def _row(d: dict) -> str:
    c = COLORS[d["verdict"]]
    qty = f"<td>{d.get('quantity', '')}</td>" if "quantity" in d else ""
    return (f"<tr><td><b>{html.escape(d['symbol'])}</b></td>"
            f"<td><span class=tag style='background:{c}'>{d['verdict']}</span></td>"
            f"<td>{d['combined']}</td><td>{d['lotappi']}</td><td>{d['mayavi']}</td><td>{d['risk']}</td>"
            f"<td>{d['entry']}</td><td>{d['stop_loss']}</td><td>{d['target']}</td>{qty}"
            f"<td>{html.escape(d['horizon'])}</td>"
            f"<td class=small>{html.escape('; '.join(d['reasons'][:4]))}</td></tr>")


def to_html(result: dict) -> str:
    rows = result["all"]
    has_qty = rows and "quantity" in rows[0]
    head = ("<tr><th>Stock</th><th>Verdict</th><th>Combined</th><th>Lotappi</th><th>Mayavi</th>"
            "<th>Risk</th><th>Entry</th><th>Stop-loss</th><th>Target</th>"
            + ("<th>Qty</th>" if has_qty else "") + "<th>Horizon</th><th>Why</th></tr>")
    convo = "".join(
        f"<div class=msg><div class=who>{html.escape(m['sender'])} &rarr; {html.escape(m['to'])}"
        f" &middot; {html.escape(m['subject'])}</div><pre>{html.escape(m['text'])}</pre></div>"
        for m in result["conversation"])
    banner = ("<p class=warn>DEMO DATA - synthetic prices, not real market data.</p>"
              if result["mode"] == "demo" else "")
    return f"""<!doctype html><html><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1"><title>Stock Agent Report</title>
<style>
body{{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#f6f7f9;color:#1b1f24}}
h1{{margin:0 0 4px}} .sub{{color:#666;margin:0 0 16px}} .warn{{background:#fff3cd;padding:8px 12px;border-radius:6px}}
.wrap{{overflow-x:auto;background:#fff;border-radius:8px;box-shadow:0 1px 3px #0002}}
table{{border-collapse:collapse;width:100%;font-size:14px}} th,td{{padding:8px;border-bottom:1px solid #eee;text-align:left;white-space:nowrap}}
td.small{{white-space:normal;font-size:12px;color:#555;min-width:240px}}
.tag{{color:#fff;padding:2px 8px;border-radius:10px;font-size:12px}}
.msg{{background:#fff;border-radius:8px;padding:10px 14px;margin:10px 0;box-shadow:0 1px 3px #0002}}
.who{{font-weight:600;color:#334}} pre{{white-space:pre-wrap;margin:6px 0 0;font-size:13px}}
.disc{{color:#777;font-size:12px;margin-top:24px}}
</style></head><body>
<h1>Indian Stock AI Agents</h1>
<p class=sub>Lotappi (short-term) &middot; Mayavi (1-month) &middot; Mubashir (analyst) &middot; Final Decision
&middot; generated {datetime.now():%d %b %Y %H:%M} &middot; Nifty 1M {result['index_ret_21d']:+}%</p>
{banner}
<h2>Final picks</h2><div class=wrap><table>{head}{''.join(_row(d) for d in result['picks']) or '<tr><td colspan=12>No buy today</td></tr>'}</table></div>
<h2>All stocks</h2><div class=wrap><table>{head}{''.join(_row(d) for d in rows)}</table></div>
<h2>Agent conversation</h2>{convo}
<p class=disc>Educational research tool only. Not investment advice. Markets carry risk; do your own research
or consult a SEBI-registered adviser before trading.</p>
</body></html>"""
