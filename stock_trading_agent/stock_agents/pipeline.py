"""Runs the four agents in order: Lotappi + Mayavi -> Mubashir -> Final Decision."""
from __future__ import annotations

from . import data as market
from .agents import FinalDecision, Lotappi, Mayavi, Mubashir
from .bus import MessageBus
from .indicators import pct_return, snapshot
from .llm import LLM


def run(symbols: list[str], top: int = 5, demo: bool = False, use_llm: bool = True,
        capital: float | None = None, risk_per_trade: float = 1.0, verbose: bool = True) -> dict:
    bus = MessageBus(verbose=verbose)
    llm = LLM(enabled=use_llm)

    frames, index_df, mode = market.load(symbols, demo)
    snaps = {sym: snapshot(df) for sym, df in frames.items()}
    index_ret = pct_return(index_df["Close"], 21) if index_df is not None else 0.0
    bus.send("System", "ALL", "Start",
             f"Data mode: {mode.upper()} | stocks: {len(snaps)} | LLM commentary: "
             f"{'on (' + llm.model + ')' if llm.active else 'off'}")

    Lotappi(bus, llm).run(snaps)
    Mayavi(bus, llm).run(snaps, index_ret)
    mubashir = Mubashir(bus, llm)
    mubashir.run(snaps)
    result = FinalDecision(bus, llm).run(mubashir, top, capital, risk_per_trade)

    result["mode"] = mode
    result["index_ret_21d"] = round(index_ret, 2)
    result["conversation"] = bus.transcript()
    return result
