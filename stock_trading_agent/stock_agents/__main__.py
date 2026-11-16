"""Command line:  python -m stock_agents [options]"""
from __future__ import annotations

import argparse

from . import data, pipeline, report


def main() -> None:
    p = argparse.ArgumentParser(description="Four-agent AI stock analyser for the Indian market (NSE)")
    p.add_argument("--symbols", help="Comma-separated NSE symbols, e.g. RELIANCE,TCS,INFY (default: Nifty 50)")
    p.add_argument("--top", type=int, default=5, help="How many final picks to show (default 5)")
    p.add_argument("--demo", action="store_true", help="Use synthetic demo data (no internet needed)")
    p.add_argument("--no-llm", action="store_true", help="Skip Claude commentary even if ANTHROPIC_API_KEY is set")
    p.add_argument("--capital", type=float, help="Your capital in INR, to suggest quantities")
    p.add_argument("--risk", type=float, default=1.0, help="Percent of capital to risk per trade (default 1)")
    p.add_argument("--out", default="reports", help="Folder for JSON/HTML reports")
    p.add_argument("--quiet", action="store_true", help="Hide the agent conversation")
    a = p.parse_args()

    symbols = [s.strip().upper() for s in a.symbols.split(",")] if a.symbols else data.NIFTY50
    result = pipeline.run(symbols, top=a.top, demo=a.demo, use_llm=not a.no_llm,
                          capital=a.capital, risk_per_trade=a.risk, verbose=not a.quiet)
    jpath, hpath = report.save(result, a.out)

    print("\n" + "=" * 78)
    print(f"FINAL GOOD STOCKS  ({result['mode'].upper()} data)")
    print("=" * 78)
    if not result["picks"]:
        print("No stock passed the buy rules today.")
    for d in result["picks"]:
        qty = f"  qty {d['quantity']}" if "quantity" in d else ""
        print(f"{d['verdict']:<10} {d['symbol']:<12} score {d['combined']:5.1f}  entry {d['entry']:>9.2f}  "
              f"SL {d['stop_loss']:>9.2f}  target {d['target']:>9.2f}  risk {d['risk']}{qty}")
    print(f"\nReports saved: {hpath}  |  {jpath}")
    print("Not investment advice. Do your own research before trading.")


if __name__ == "__main__":
    main()
