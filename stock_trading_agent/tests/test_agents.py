import json

from stock_agents import data, pipeline, report
from stock_agents.indicators import rsi, snapshot


def test_rsi_bounds():
    df = data.fetch_demo(["TCS"])["TCS"]
    r = rsi(df["Close"]).dropna()
    assert ((r >= 0) & (r <= 100)).all()


def test_snapshot_fields():
    s = snapshot(data.fetch_demo(["INFY"])["INFY"])
    for key in ("close", "rsi", "sma50", "atr", "ret_21d", "vol_ratio"):
        assert key in s


def test_full_pipeline_demo(tmp_path):
    res = pipeline.run(data.NIFTY50[:15], top=3, demo=True, use_llm=False,
                       capital=100000, verbose=False)
    assert res["mode"] == "demo"
    assert len(res["all"]) == 15
    assert len(res["picks"]) <= 3
    for d in res["all"]:
        assert d["verdict"] in {"STRONG BUY", "BUY", "WATCH", "AVOID"}
        assert d["stop_loss"] < d["entry"] < d["target"]
        assert d["investment"] <= 100000 * 0.2 + d["entry"]
    for p in res["picks"]:
        assert p["verdict"] in {"STRONG BUY", "BUY"}
    senders = [m["sender"] for m in res["conversation"]]
    for agent in ("Lotappi", "Mayavi", "Mubashir", "FinalDecision"):
        assert agent in senders
    jpath, hpath = report.save(res, tmp_path)
    assert json.loads(jpath.read_text())["mode"] == "demo"
    assert "Final picks" in hpath.read_text()
