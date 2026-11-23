"use client";

/**
 * Full price chart for the stock modal (TradingView lightweight-charts).
 * Candles, bars or line; volume underneath; 20/50 moving averages; the
 * Research Agent's entry, stop-loss, target and buy zone as price lines.
 * Bar size and range can be changed; the default is daily bars over 1 year.
 */
import {
  AreaSeries, BarSeries, CandlestickSeries, ColorType, createChart, CrosshairMode, HistogramSeries, LineSeries, LineStyle,
  type IChartApi, type ISeriesApi, type SeriesType, type Time, type UTCTimestamp,
} from "lightweight-charts";
import { BarChart3, CandlestickChart, LineChart, Loader2, RefreshCw } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  allowed, type ChartBar, type ChartInterval, type ChartRange, type ChartResponse, INTERVAL_LABEL, INTERVALS, intervalFor, isIntraday,
  RANGE_LABEL, RANGES, rangeFor,
} from "@/lib/market/chart-data";
import { cn } from "@/lib/utils";

export interface ChartLevels { entry?: number; stop?: number; target?: number; zoneLow?: number; zoneHigh?: number }
type Style = "candles" | "bars" | "line";

const IST = 19800;
const toTime = (b: ChartBar): Time => (typeof b.t === "number" ? ((b.t + IST) as UTCTimestamp) : (b.t as Time));
const fmt = (n?: number) => (n === undefined ? "–" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const vol = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(2)} L` : n.toLocaleString("en-IN"));

function sma(bars: ChartBar[], n: number) {
  const out: { time: Time; value: number }[] = [];
  let sum = 0;
  bars.forEach((b, i) => {
    sum += b.c;
    if (i >= n) sum -= bars[i - n].c;
    if (i >= n - 1) out.push({ time: toTime(b), value: sum / n });
  });
  return out;
}

function Pills<T extends string>({ items, value, label, onPick, isOff, labelOf }: {
  items: readonly T[]; value: T; label: string; onPick: (v: T) => void; isOff?: (v: T) => boolean; labelOf: (v: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="well inline-flex h-9 max-w-full items-center gap-0.5 overflow-x-auto rounded-xl p-1 scroll-thin">
      {items.map((v) => (
        <button key={v} type="button" role="radio" aria-checked={v === value} onClick={() => onPick(v)}
          title={isOff?.(v) ? "Not available for this range; the range will change" : undefined}
          className={cn("h-full shrink-0 rounded-lg px-2 text-[12.5px] font-medium tnum transition-all",
            v === value ? "raised -translate-y-px font-semibold text-foreground" : "text-muted-foreground hover:text-foreground", isOff?.(v) && v !== value && "opacity-60")}>
          {labelOf(v)}
        </button>
      ))}
    </div>
  );
}

export function StockChart({ symbol, levels, className, fill }: { symbol: string; levels?: ChartLevels; className?: string; /** grow to the parent's height (phone tab) */ fill?: boolean }) {
  const [interval, setInterval_] = useState<ChartInterval>("1d");
  const [range, setRange] = useState<ChartRange>("1y");
  const [style, setStyle] = useState<Style>("candles");
  const [showMA, setShowMA] = useState(true);
  const [showLevels, setShowLevels] = useState(true);
  const [data, setData] = useState<ChartResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<ChartBar | null>(null);
  const [reload, setReload] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { resolvedTheme } = useTheme();

  // fetch
  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true); setError(null);
    fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&interval=${interval}&range=${range}`, { signal: ctl.signal })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`); return j as ChartResponse; })
      .then((j) => { setData(j); setHover(null); })
      .catch((e) => { if (e.name !== "AbortError") { setError(e.message); setData(null); } })
      .finally(() => { if (!ctl.signal.aborted) setLoading(false); });
    return () => ctl.abort();
  }, [symbol, interval, range, reload]);

  const byTime = useMemo(() => new Map((data?.bars ?? []).map((b) => [String(toTime(b)), b])), [data]);

  // draw
  useEffect(() => {
    const el = box.current;
    if (!el || !data?.bars.length) return;
    const css = getComputedStyle(document.documentElement);
    const v = (n: string) => css.getPropertyValue(n).trim();
    const up = v("--pos") || "#16a34a", down = v("--neg") || "#dc2626";
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: v("--muted-foreground"), fontFamily: "Inter, system-ui, sans-serif", fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: v("--border") }, horzLines: { color: v("--border") } },
      rightPriceScale: { borderColor: v("--border"), scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: v("--border"), timeVisible: isIntraday(interval), secondsVisible: false, rightOffset: 4 },
      crosshair: { mode: CrosshairMode.Normal },
      // Phones: a vertical swipe scrolls the window instead of panning the chart.
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      localization: { priceFormatter: (p: number) => `₹${p.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` },
    });
    chartRef.current = chart;
    const bars = data.bars;
    let main: ISeriesApi<SeriesType>;
    if (style === "line") {
      main = chart.addSeries(AreaSeries, { lineColor: v("--primary"), topColor: `${v("--primary")}55`, bottomColor: `${v("--primary")}05`, lineWidth: 2 });
      main.setData(bars.map((b) => ({ time: toTime(b), value: b.c })));
    } else {
      main = style === "bars"
        ? chart.addSeries(BarSeries, { upColor: up, downColor: down, thinBars: false })
        : chart.addSeries(CandlestickSeries, { upColor: up, downColor: down, borderVisible: false, wickUpColor: up, wickDownColor: down });
      main.setData(bars.map((b) => ({ time: toTime(b), open: b.o, high: b.h, low: b.l, close: b.c })));
    }
    const volume = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volume.setData(bars.map((b) => ({ time: toTime(b), value: b.v, color: b.c >= b.o ? `${up}66` : `${down}66` })));
    if (showMA) {
      for (const [n, color] of [[20, "#f59e0b"], [50, "#8b5cf6"]] as const) {
        if (bars.length > n) chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(sma(bars, n));
      }
    }
    if (showLevels && levels) {
      const line = (price: number | undefined, color: string, title: string, style = LineStyle.Dashed) =>
        price && main.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title });
      line(levels.target, up, "Target");
      line(levels.entry, v("--primary"), "Entry", LineStyle.Solid);
      line(levels.stop, down, "Stop-loss");
      line(levels.zoneHigh, "#14b8a6", "Buy zone", LineStyle.Dotted);
      line(levels.zoneLow, "#14b8a6", "", LineStyle.Dotted);
    }
    chart.timeScale().fitContent();
    chart.subscribeCrosshairMove((p) => setHover(p.time ? byTime.get(String(p.time)) ?? null : null));
    return () => { chart.remove(); chartRef.current = null; };
  }, [data, style, showMA, showLevels, levels, interval, resolvedTheme, byTime]);

  const pickRange = useCallback((r: ChartRange) => { setRange(r); setInterval_((i) => intervalFor(r, i)); }, []);
  const pickInterval = useCallback((i: ChartInterval) => { setInterval_(i); setRange((r) => rangeFor(i, r)); }, []);

  const bars = data?.bars ?? [];
  const shown = hover ?? bars[bars.length - 1];
  const first = bars[0], last = bars[bars.length - 1];
  const change = first && last ? ((last.c - first.o) / first.o) * 100 : undefined;

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Pills label="Range" items={RANGES} value={range} onPick={pickRange} labelOf={(r) => RANGE_LABEL[r]} />
        <Pills label="Bar size" items={INTERVALS} value={interval} onPick={pickInterval} labelOf={(i) => INTERVAL_LABEL[i]} isOff={(i) => !allowed(i, range)} />
        <div role="radiogroup" aria-label="Chart style" className="well inline-flex h-9 items-center gap-0.5 rounded-xl p-1">
          {([["candles", CandlestickChart, "Candles"], ["bars", BarChart3, "Bars"], ["line", LineChart, "Line"]] as const).map(([k, I, l]) => (
            <button key={k} type="button" role="radio" aria-checked={style === k} onClick={() => setStyle(k)} title={l}
              className={cn("flex h-full items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium", style === k ? "raised -translate-y-px text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <I className="size-3.5" />{l}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><input type="checkbox" checked={showMA} onChange={(e) => setShowMA(e.target.checked)} className="accent-[var(--primary)]" />MA 20 · 50</label>
        {levels && <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><input type="checkbox" checked={showLevels} onChange={(e) => setShowLevels(e.target.checked)} className="accent-[var(--primary)]" />Entry · stop · target</label>}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12px] tnum" aria-live="polite">
        {shown ? (
          <>
            <span className="font-semibold">{typeof shown.t === "number" ? new Date((shown.t + IST) * 1000).toISOString().slice(0, 16).replace("T", " ") + " IST" : shown.t}</span>
            <span>O <b>{fmt(shown.o)}</b></span><span>H <b>{fmt(shown.h)}</b></span><span>L <b>{fmt(shown.l)}</b></span>
            <span>C <b className={shown.c >= shown.o ? "text-pos" : "text-neg"}>{fmt(shown.c)}</b></span>
            <span>Vol <b>{vol(shown.v)}</b></span>
            {change !== undefined && <span className="text-muted-foreground">· {RANGE_LABEL[range]} change <b className={change >= 0 ? "text-pos" : "text-neg"}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</b></span>}
            {showMA && <span className="text-muted-foreground"><i className="mr-1 inline-block h-0.5 w-3 bg-[#f59e0b] align-middle" />MA20 <i className="ml-2 mr-1 inline-block h-0.5 w-3 bg-[#8b5cf6] align-middle" />MA50</span>}
          </>
        ) : <span className="text-muted-foreground">{loading ? "Loading chart…" : " "}</span>}
      </div>

      <div className={cn("relative overflow-hidden rounded-xl border border-[var(--edge)] bg-card/40", fill ? "min-h-[240px] flex-1" : "h-[42vh] min-h-[260px] sm:h-[52vh] sm:min-h-[300px] lg:h-auto lg:min-h-[320px] lg:flex-1")}>
        <div ref={box} className="absolute inset-0" />
        {loading && <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-card/90 px-2 py-1 text-[12px] text-muted-foreground shadow"><Loader2 className="size-3.5 animate-spin" />Loading</div>}
        {error && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              <p className="text-[13.5px] font-semibold">The chart couldn&apos;t load</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{error}</p>
              <button type="button" onClick={() => setReload((n) => n + 1)} className="btn-3d mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold"><RefreshCw className="size-3.5" />Try again</button>
            </div>
          </div>
        )}
        {!loading && !error && data && !bars.length && <div className="absolute inset-0 grid place-items-center text-[13px] text-muted-foreground">No trades in this period.</div>}
      </div>
      <p className="text-[11px] text-muted-foreground">{data?.source ?? "Yahoo Finance"} · times in IST · scroll to zoom, drag to pan</p>
    </div>
  );
}
