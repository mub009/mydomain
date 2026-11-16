"""Market data for NSE stocks.

Live mode uses Yahoo Finance via `yfinance` (NSE tickers get the `.NS` suffix).
Demo mode generates realistic random price series so the agents can be tried
without internet access. Demo data is NOT real market data.
"""
from __future__ import annotations

import hashlib

import numpy as np
import pandas as pd

NIFTY50 = [
    "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "BHARTIARTL", "ITC", "SBIN",
    "LT", "HINDUNILVR", "BAJFINANCE", "KOTAKBANK", "AXISBANK", "MARUTI", "SUNPHARMA",
    "HCLTECH", "TITAN", "ULTRACEMCO", "NTPC", "ASIANPAINT", "M&M", "POWERGRID",
    "TATAMOTORS", "WIPRO", "ONGC", "NESTLEIND", "JSWSTEEL", "TATASTEEL", "ADANIPORTS",
    "COALINDIA", "BAJAJFINSV", "TECHM", "GRASIM", "HINDALCO", "CIPLA", "DRREDDY",
    "BRITANNIA", "EICHERMOT", "APOLLOHOSP", "HEROMOTOCO", "DIVISLAB", "TATACONSUM",
    "SBILIFE", "HDFCLIFE", "BPCL", "INDUSINDBK", "ADANIENT", "BAJAJ-AUTO", "SHRIRAMFIN",
    "TRENT",
]

INDEX_SYMBOL = "^NSEI"  # Nifty 50 index on Yahoo


def _yahoo(symbol: str) -> str:
    return symbol if symbol.startswith("^") or symbol.endswith((".NS", ".BO")) else f"{symbol}.NS"


def fetch_live(symbols: list[str], period: str = "1y") -> dict[str, pd.DataFrame]:
    import yfinance as yf

    out: dict[str, pd.DataFrame] = {}
    for sym in symbols:
        try:
            df = yf.Ticker(_yahoo(sym)).history(period=period, interval="1d", auto_adjust=True)
        except Exception as exc:  # network / bad ticker
            print(f"  ! {sym}: could not download ({exc})")
            continue
        df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()
        if len(df) >= 60:
            out[sym] = df
        else:
            print(f"  ! {sym}: not enough history, skipped")
    return out


def fetch_demo(symbols: list[str], days: int = 260) -> dict[str, pd.DataFrame]:
    """Deterministic synthetic OHLCV per symbol (same symbol -> same series)."""
    idx = pd.bdate_range(end=pd.Timestamp("2026-11-13"), periods=days)
    out = {}
    for sym in symbols:
        seed = int(hashlib.md5(sym.encode()).hexdigest()[:8], 16)
        rng = np.random.default_rng(seed)
        drift = rng.normal(0.0002, 0.0006)
        vol = rng.uniform(0.010, 0.022)
        rets = rng.normal(drift, vol, days)
        # give some stocks a recent regime change so agents disagree sometimes
        rets[-25:] += rng.normal(0, 0.0025)
        rets[-5:] += rng.normal(0, 0.004)
        close = rng.uniform(150, 4000) * np.exp(np.cumsum(rets))
        opn = close * (1 + rng.normal(0, vol / 3, days))
        high = np.maximum(opn, close) * (1 + np.abs(rng.normal(0, vol / 2, days)))
        low = np.minimum(opn, close) * (1 - np.abs(rng.normal(0, vol / 2, days)))
        volume = rng.lognormal(14, 0.35, days)
        volume[-1] *= rng.uniform(0.7, 2.5)
        out[sym] = pd.DataFrame(
            {"Open": opn, "High": high, "Low": low, "Close": close, "Volume": volume}, index=idx
        )
    return out


def load(symbols: list[str], demo: bool) -> tuple[dict[str, pd.DataFrame], pd.DataFrame | None, str]:
    """Return (stock data, index data, mode). Falls back to demo if live fails."""
    if not demo:
        data = fetch_live(symbols)
        if data:
            idx = fetch_live([INDEX_SYMBOL]).get(INDEX_SYMBOL)
            return data, idx, "live"
        print("  ! Live data unavailable - falling back to DEMO data (not real prices).")
    data = fetch_demo(symbols)
    # demo index = equal-weight average of the demo stocks (normalised to 100)
    norm = pd.concat([df["Close"] / df["Close"].iloc[0] * 100 for df in data.values()], axis=1)
    index = pd.DataFrame({"Close": norm.mean(axis=1)})
    return data, index, "demo"
