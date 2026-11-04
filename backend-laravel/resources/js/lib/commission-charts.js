import { $, $$, esc } from "./ui";

// Commission charts (pages/partials/commission-charts.blade.php): bar charts of
// what was collected, the commission on it, and the commission received, per
// day (30 days), week (12) or month (12). Plain SVG, redrawn on resize, with a
// tooltip on every period and a table view. Data: App\Support\Commission::timeline.

// Fixed by entity, not by position: Collected is always blue, Commission
// orange, Received aqua (validated colourblind-safe as a set).
const SERIES = {
  collected: { label: "Collected", color: "#2a78d6" },
  commission: { label: "Commission", color: "#eb6834" },
  received: { label: "Received", color: "#1baf7a" },
};
const PERIOD_LABELS = { daily: "Last 30 days", weekly: "Last 12 weeks", monthly: "Last 12 months" };

const inr = (v) => `${v < 0 ? "−" : ""}₹${Math.abs(v).toLocaleString("en-IN")}`;
// Axis ticks: ₹1.2k, ₹3.4L, ₹1.1Cr.
function inrShort(v) {
  const a = Math.abs(v);
  const s = v < 0 ? "−" : "";
  if (a >= 1e7) return `${s}₹${+(a / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${s}₹${+(a / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${s}₹${+(a / 1e3).toFixed(1)}k`;
  return `${s}₹${a}`;
}
function niceStep(range, ticks = 4) {
  const raw = range / ticks || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}

// A bar whose data end (away from the baseline) is rounded 4px.
function barPath(x, yBase, yTop, w) {
  const h = Math.abs(yBase - yTop);
  if (h < 0.5) return "";
  const r = Math.min(4, w / 2, h);
  if (yTop < yBase) {
    return `M${x},${yBase}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yBase}Z`;
  }
  return `M${x},${yBase}V${yTop - r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop - r}V${yBase}Z`;
}

function drawBars(holder, buckets, keys, tooltip) {
  const width = Math.max(280, holder.clientWidth);
  const height = 220;
  const m = { top: 12, right: 8, bottom: 26, left: 52 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;

  const values = buckets.flatMap((b) => keys.map((k) => b[k]));
  let max = Math.max(0, ...values);
  let min = Math.min(0, ...values);
  if (max === 0 && min === 0) max = 1000;
  const step = niceStep(max - min);
  max = Math.ceil(max / step) * step;
  min = Math.floor(min / step) * step;
  const y = (v) => m.top + plotH - ((v - min) / (max - min)) * plotH;

  const band = plotW / buckets.length;
  const groupW = Math.min(band * 0.72, keys.length * 26);
  const gap = keys.length > 1 ? 2 : 0;
  const barW = (groupW - gap * (keys.length - 1)) / keys.length;
  const labelEvery = Math.max(1, Math.ceil(52 / band));

  let grid = "";
  for (let v = min; v <= max + step / 2; v += step) {
    grid += `<line x1="${m.left}" x2="${width - m.right}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? "#cbd5e1" : "#eef2f6"}" stroke-width="1" />
      <text x="${m.left - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#6b7280">${esc(inrShort(v))}</text>`;
  }
  let bars = "";
  let hits = "";
  buckets.forEach((b, i) => {
    const x0 = m.left + band * i + (band - groupW) / 2;
    keys.forEach((k, j) => {
      bars += `<path d="${barPath(x0 + j * (barW + gap), y(0), y(b[k]), barW)}" fill="${SERIES[k].color}" />`;
    });
    if (i % labelEvery === 0) {
      bars += `<text x="${m.left + band * (i + 0.5)}" y="${height - 8}" text-anchor="middle" font-size="11" fill="#6b7280">${esc(b.label)}</text>`;
    }
    // The hover target is the whole period column, wider than its bars.
    hits += `<rect data-i="${i}" x="${m.left + band * i}" y="${m.top}" width="${band}" height="${plotH}" fill="transparent" tabindex="0"
      aria-label="${esc(`${b.title}: ${keys.map((k) => `${SERIES[k].label} ${inr(b[k])}`).join(", ")}`)}" />`;
  });

  holder.innerHTML = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" class="block overflow-visible">
    <g>${grid}</g><rect data-hover x="0" y="${m.top}" width="${band}" height="${plotH}" fill="#f1f5f9" opacity="0" rx="4" /><g>${bars}</g><g>${hits}</g></svg>`;

  const hover = $("[data-hover]", holder);
  const show = (rect) => {
    const i = Number(rect.dataset.i);
    const b = buckets[i];
    hover.setAttribute("x", m.left + band * i);
    hover.setAttribute("opacity", "1");
    tooltip.innerHTML = `<p class="mb-1 text-xs font-semibold text-ink-900">${esc(b.title)}</p>${keys
      .map(
        (k) => `<p class="flex items-center justify-between gap-4 text-xs"><span class="flex items-center gap-1.5 text-ink-500">
          <span class="h-2.5 w-2.5 rounded-sm" style="background:${SERIES[k].color}"></span>${SERIES[k].label}</span>
          <span class="font-semibold tabular-nums text-ink-900">${esc(inr(b[k]))}</span></p>`,
      )
      .join("")}`;
    tooltip.hidden = false;
    const box = holder.getBoundingClientRect();
    const left = m.left + band * (i + 0.5);
    const tipW = tooltip.offsetWidth;
    tooltip.style.left = `${Math.min(Math.max(0, left - tipW / 2), box.width - tipW)}px`;
    tooltip.style.top = `${Math.max(0, y(Math.max(0, ...keys.map((k) => b[k]))) - tooltip.offsetHeight - 8)}px`;
  };
  const hide = () => {
    hover.setAttribute("opacity", "0");
    tooltip.hidden = true;
  };
  $$("[data-i]", holder).forEach((rect) => {
    rect.addEventListener("pointerenter", () => show(rect));
    rect.addEventListener("pointerdown", () => show(rect));
    rect.addEventListener("focus", () => show(rect));
    rect.addEventListener("blur", hide);
  });
  $("svg", holder).addEventListener("pointerleave", hide);
}

export function initCommissionCharts(root = document) {
  $$("[data-commission-charts]", root).forEach((wrap) => {
    const timeline = JSON.parse($("script[type='application/json']", wrap).textContent);
    let period = "monthly";

    const render = () => {
      const buckets = timeline[period] ?? [];
      const totals = Object.fromEntries(Object.keys(SERIES).map((k) => [k, buckets.reduce((s, b) => s + b[k], 0)]));
      $("[data-range]", wrap).textContent = PERIOD_LABELS[period];
      $$("[data-total]", wrap).forEach((el) => (el.textContent = inr(totals[el.dataset.total])));
      $$("[data-chart]", wrap).forEach((slot) => {
        const keys = slot.dataset.chart.split(",");
        drawBars($("[data-plot]", slot), buckets, keys, $("[data-tooltip]", slot));
      });
      $("[data-table]", wrap).innerHTML = `<table class="w-full min-w-[420px] text-sm">
        <thead><tr class="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          <th class="py-1.5 pr-3">Period</th>${Object.values(SERIES).map((s) => `<th class="py-1.5 pr-3 text-right">${s.label}</th>`).join("")}</tr></thead>
        <tbody class="divide-y divide-gray-100">${buckets
          .map(
            (b) => `<tr><td class="py-1.5 pr-3 text-ink-700">${esc(b.title)}</td>${Object.keys(SERIES)
              .map((k) => `<td class="py-1.5 pr-3 text-right tabular-nums text-ink-900">${esc(inr(b[k]))}</td>`)
              .join("")}</tr>`,
          )
          .join("")}</tbody></table>`;
      $$("[data-period]", wrap).forEach((b) => {
        const on = b.dataset.period === period;
        b.setAttribute("aria-pressed", String(on));
        b.className = `rounded-md px-3 py-1.5 text-xs font-semibold transition ${on ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900"}`;
      });
    };

    $$("[data-period]", wrap).forEach((b) =>
      b.addEventListener("click", () => {
        period = b.dataset.period;
        render();
      }),
    );
    let frame;
    new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    }).observe(wrap);
    render();
  });
}
