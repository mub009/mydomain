"""Technical indicators computed from daily OHLCV data (pandas DataFrame with
columns Open, High, Low, Close, Volume)."""
from __future__ import annotations

import pandas as pd


def sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n).mean()


def ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False).mean()


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    rs = gain / loss.replace(0, 1e-9)
    return 100 - 100 / (1 + rs)


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    line = ema(close, fast) - ema(close, slow)
    sig = ema(line, signal)
    return line, sig, line - sig


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    prev = df["Close"].shift(1)
    tr = pd.concat(
        [df["High"] - df["Low"], (df["High"] - prev).abs(), (df["Low"] - prev).abs()],
        axis=1,
    ).max(axis=1)
    return tr.ewm(alpha=1 / n, adjust=False).mean()


def pct_return(close: pd.Series, days: int) -> float:
    if len(close) <= days:
        return 0.0
    return float(close.iloc[-1] / close.iloc[-1 - days] - 1) * 100


def snapshot(df: pd.DataFrame) -> dict:
    """All the numbers the agents need, for the latest bar."""
    c = df["Close"]
    m_line, m_sig, m_hist = macd(c)
    a = atr(df)
    vol20 = df["Volume"].rolling(20).mean()
    return {
        "close": float(c.iloc[-1]),
        "rsi": float(rsi(c).iloc[-1]),
        "ema9": float(ema(c, 9).iloc[-1]),
        "ema21": float(ema(c, 21).iloc[-1]),
        "sma20": float(sma(c, 20).iloc[-1]),
        "sma50": float(sma(c, 50).iloc[-1]),
        "sma200": float(sma(c, 200).iloc[-1]) if len(c) >= 200 else float("nan"),
        "macd": float(m_line.iloc[-1]),
        "macd_signal": float(m_sig.iloc[-1]),
        "macd_hist": float(m_hist.iloc[-1]),
        "macd_hist_prev": float(m_hist.iloc[-2]),
        "atr": float(a.iloc[-1]),
        "atr_pct": float(a.iloc[-1] / c.iloc[-1] * 100),
        "vol_ratio": float(df["Volume"].iloc[-1] / vol20.iloc[-1]) if vol20.iloc[-1] else 1.0,
        "high_20": float(df["High"].iloc[-21:-1].max()),
        "low_20": float(df["Low"].iloc[-21:-1].min()),
        "high_52w": float(df["High"].iloc[-252:].max()),
        "ret_1d": pct_return(c, 1),
        "ret_5d": pct_return(c, 5),
        "ret_21d": pct_return(c, 21),
        "ret_63d": pct_return(c, 63),
        "volatility_21d": float(c.pct_change().iloc[-21:].std() * (252**0.5) * 100),
    }
