# Indian Stock AI Trading Agents (NSE)

Four AI agents analyse Indian stocks, talk to each other, and agree on a final list of good stocks.

```
 Lotappi  (short-term, 1-10 days) ──┐
                                    ├──> Mubashir (analyst) ──> Final Decision ──> GOOD STOCKS
 Mayavi   (short-month, ~1 month) ──┘          ▲                    │
                                               └──── questions ─────┘
```

| # | Agent | Job | What it looks at |
|---|-------|-----|------------------|
| 1 | **Lotappi** | Finds **short-term** swing trades (1-10 days) | EMA 9/21 cross, RSI momentum zone, 20-day breakout, volume spike, MACD histogram, 5-day return |
| 2 | **Mayavi** | Finds **1-month** positional stocks | Price vs SMA20/50/200, 1-month return, relative strength vs Nifty 50, MACD, RSI, distance from 52-week high |
| 3 | **Mubashir** | **Analyses** the reports from Lotappi and Mayavi | Combines the scores, checks where they agree or conflict, rates risk (ATR, volatility, overbought), picks the horizon and works out entry, stop-loss and target (2:1 reward-to-risk) |
| 4 | **Final Decision** | **Decides** | Asks Mubashir about any conflicts, then gives STRONG BUY / BUY / WATCH / AVOID and the final top picks (plus quantity if you give your capital) |

Every message between the agents is recorded and shown in the console and in the HTML report.

## Setup

```bash
cd stock_trading_agent
pip install -r requirements.txt
```

## Run

```bash
# Real NSE data (Yahoo Finance), all Nifty 50 stocks, top 5 picks
python -m stock_agents

# Your own list of stocks, with ₹2,00,000 capital and 1% risk per trade
python -m stock_agents --symbols RELIANCE,TCS,INFY,SBIN,TATAMOTORS --capital 200000 --risk 1

# No internet? Try it with synthetic demo data (NOT real prices)
python -m stock_agents --demo
```

Options: `--top N`, `--quiet` (hide the conversation), `--no-llm`, `--out folder`.

Each run saves `reports/report_<time>.html` (picks table, all stocks, full agent conversation) and `reports/picks_<time>.json`.

## AI commentary with Claude (optional)

Set an Anthropic API key and each agent also explains its findings in plain language:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export STOCK_AGENT_MODEL=claude-opus-5-5   # optional, this is the default
python -m stock_agents
```

The scores and final picks always come from the fixed rules, so results are the same with or without the AI. Claude only adds explanations.

## Tests

```bash
python -m pytest -q
```

## Disclaimer

This is an educational research tool, not investment advice. The rules are simple technical signals and have not been backtested. Stock markets carry risk. Do your own research or consult a SEBI-registered investment adviser before trading.
