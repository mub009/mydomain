// "Where the colour goes": a full-screen editor for marking the parts of the
// card image the colour should change. Each area is drawn freehand, with the
// pen (point by point, like a pen tool), as a square/rectangle, a circle or an
// oval; the eraser draws the same shapes to take the colour away again — on
// its own it starts from the whole card ("colour everywhere except here"). Areas apply in order, so a later one wins where
// they overlap. Nothing marked = the colour covers the whole card.
//
// Stored with the colour as areas: [{ erase, points: [[x, y], ...] }] in
// percent of the image (App\Support\Cards\ImageColour::areas).

import { applyToImage } from "./card-colour";
import { icon } from "./icons";
import { esc } from "./ui";

const MAX_AREAS = 40;
const MAX_POINTS = 160;
const MIN_SIZE = 1.5; // percent: smaller shapes are a slip of the finger

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r2 = (v) => Math.round(v * 100) / 100;
const around = (n, f) => Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2));

// A freehand line, thinned to at most MAX_POINTS points.
function thin(points) {
  const kept = [];
  for (const p of points) {
    const last = kept[kept.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= 0.6) kept.push(p);
  }
  const step = Math.ceil(kept.length / MAX_POINTS);
  return kept.filter((_, i) => i % step === 0);
}

const tooSmall = (pts) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return pts.length < 3 || Math.max(...xs) - Math.min(...xs) < MIN_SIZE || Math.max(...ys) - Math.min(...ys) < MIN_SIZE;
};

/**
 * @param {{ imageUrl: string, ratio: number, colour: object, onDone: (areas: Array) => void }} options
 *   ratio: the image's width / height.
 */
export function openColourAreas({ imageUrl, ratio, colour, onDone }) {
  let areas = (colour.areas || []).map((a) => ({ erase: !!a.erase, points: a.points.map((p) => [...p]) }));
  let erase = false;
  let shape = "free"; // free | pen | rect | circle | oval
  let pen = []; // the pen's points so far, until the shape is closed
  let problem = "";

  const el = document.createElement("div");
  el.className = "fixed inset-0 z-[1000] flex flex-col bg-gray-950/95 text-white";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Where the colour goes");
  el.innerHTML = `
    <div data-head class="border-b border-white/10 px-4 py-2.5"></div>
    <div data-tools class="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2 text-xs"></div>
    <div data-scroll class="flex min-h-0 flex-1 overflow-auto p-4">
      <div data-canvas class="relative m-auto shrink-0 touch-none select-none" style="cursor:crosshair">
        <img src="${esc(imageUrl)}" alt="Your card" draggable="false" class="pointer-events-none block h-auto w-full rounded" data-base />
        <svg data-lines viewBox="0 0 100 100" preserveAspectRatio="none" class="pointer-events-none absolute inset-0 h-full w-full overflow-visible"></svg>
      </div>
    </div>`;
  document.body.appendChild(el);
  const head = el.querySelector("[data-head]");
  const tools = el.querySelector("[data-tools]");
  const scroll = el.querySelector("[data-scroll]");
  const canvas = el.querySelector("[data-canvas]");
  const base = el.querySelector("[data-base]");
  const lines = el.querySelector("[data-lines]");
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const fit = () => {
    const r = scroll.getBoundingClientRect();
    canvas.style.width = `${Math.max(160, Math.min(r.width - 32, (r.height - 32) * (ratio || 0.6)))}px`;
  };
  fit();
  window.addEventListener("resize", fit);

  function close() {
    el.remove();
    document.body.style.overflow = prevOverflow;
    window.removeEventListener("resize", fit);
    document.removeEventListener("keydown", onKey, true);
  }

  const btn = (attr, on, inner, extra = "") =>
    `<button type="button" ${attr} ${extra} class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
      on ? "border-white bg-white text-gray-900" : "border-white/30 text-white hover:bg-white/10"
    }">${inner}</button>`;

  function render() {
    head.innerHTML = `
      <div class="flex flex-wrap items-center gap-3">
        <div class="min-w-0 flex-1">
          <p class="font-bold">Where the colour goes</p>
          <p class="text-xs text-white/70">${
            shape === "pen"
              ? "Pen: click point by point around the part. Click the first point (or double-click, or press Enter) to close it."
              : erase
                ? "Eraser: draw over the parts that should keep their own colour."
                : "Draw around the parts the colour should change. Nothing marked = the whole card."
          }</p>
          ${problem ? `<p class="mt-0.5 text-xs font-semibold text-red-300">${esc(problem)}</p>` : ""}
        </div>
        <button type="button" data-x="cancel" class="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10">Cancel</button>
        <button type="button" data-x="done" class="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">Done</button>
      </div>`;
    tools.innerHTML = `
      <div class="flex gap-1.5" role="group" aria-label="Colour or erase">
        ${btn('data-x="paint"', !erase, `${icon("paintbrush", { size: 14 })} Colour here`)}
        ${btn('data-x="erase"', erase, `${icon("eraser", { size: 14 })} Eraser`)}
      </div>
      <span class="mx-1 h-6 w-px bg-white/20"></span>
      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Shape">
        ${btn('data-shape="free"', shape === "free", `${icon("pencil", { size: 14 })} Freehand`)}
        ${btn('data-shape="pen"', shape === "pen", `${icon("pen-tool", { size: 14 })} Pen`)}
        ${btn('data-shape="rect"', shape === "rect", `<span class="inline-block h-3 w-3 rounded-[2px] border-2 border-current"></span> Square`)}
        ${btn('data-shape="circle"', shape === "circle", `<span class="inline-block h-3.5 w-3.5 rounded-full border-2 border-current"></span> Round`)}
        ${btn('data-shape="oval"', shape === "oval", `<span class="inline-block h-3 w-4 rounded-[50%] border-2 border-current"></span> Oval`)}
      </div>
      ${
        // Shown as soon as the pen is picked (greyed until used), so the card never jumps while drawing.
        shape === "pen"
          ? `<span class="mx-1 h-6 w-px bg-white/20"></span>
             ${btn('data-x="pen-close"', false, `${icon("check", { size: 14 })} Close shape`, pen.length >= 3 ? "" : "disabled")}
             ${btn('data-x="pen-back"', false, "Remove last point", pen.length ? "" : "disabled")}
             ${btn('data-x="pen-cancel"', false, `${icon("x", { size: 14 })} Cancel shape`, pen.length ? "" : "disabled")}`
          : ""
      }
      <span class="mx-1 h-6 w-px bg-white/20"></span>
      ${btn('data-x="undo"', false, "Undo", areas.length ? "" : "disabled")}
      ${btn('data-x="clear"', false, "Clear all", areas.length ? "" : "disabled")}
      <span class="text-white/60">${areas.length ? `${areas.filter((a) => !a.erase).length} marked, ${areas.filter((a) => a.erase).length} erased` : "Nothing marked yet"}</span>`;
    paint();
  }

  // The card as it will look: coloured inside the areas (or uncoloured while
  // nothing is marked — the whole card takes it once you're done), with the
  // outlines on top: dashed white for colour, red for the eraser.
  function paint() {
    applyToImage(base, { ...colour, areas: areas.length ? areas : [{ erase: false, points: [[0, 0], [0, 0], [0, 0]] }] });
    lines.innerHTML =
      areas
        .map(
          (a) =>
            `<polygon points="${a.points.map((p) => p.join(",")).join(" ")}" fill="${a.erase ? "rgba(239,68,68,.15)" : "none"}" stroke="${
              a.erase ? "#f87171" : "#fff"
            }" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" />`,
        )
        .join("") +
      `<polygon data-draft points="" fill="${erase ? "rgba(239,68,68,.2)" : "rgba(255,255,255,.2)"}" stroke="${erase ? "#f87171" : "#38bdf8"}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />` +
      (pen.length
        ? `<polyline points="${pen.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${erase ? "#f87171" : "#38bdf8"}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />` +
          `<polyline data-pen-next points="" fill="none" stroke="${erase ? "#f87171" : "#38bdf8"}" stroke-width="1.5" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" />`
        : "");
    // The pen's points as dots of a fixed size (the SVG is stretched, so they are drawn as HTML).
    canvas.querySelectorAll("[data-pen-dot]").forEach((d) => d.remove());
    pen.forEach(([x, y], i) => {
      const d = document.createElement("span");
      d.dataset.penDot = "";
      d.className = `pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${i === 0 ? "h-3.5 w-3.5 bg-sky-400" : "h-2.5 w-2.5 bg-sky-500"}`;
      d.style.left = `${x}%`;
      d.style.top = `${y}%`;
      canvas.appendChild(d);
    });
  }

  function closePen() {
    if (pen.length < 3) return;
    const pts = pen;
    pen = [];
    add(pts);
  }

  function add(points) {
    if (tooSmall(points)) {
      problem = "That's too small — draw it a little bigger.";
      return render();
    }
    if (areas.length >= MAX_AREAS) {
      problem = `Up to ${MAX_AREAS} shapes. Undo or clear some first.`;
      return render();
    }
    // Erasing with nothing marked yet: the colour starts from the whole card, minus this.
    if (erase && !areas.some((a) => !a.erase)) {
      if (areas.length + 2 > MAX_AREAS) {
        problem = `Up to ${MAX_AREAS} shapes. Undo or clear some first.`;
        return render();
      }
      areas.push({ erase: false, points: [[0, 0], [100, 0], [100, 100], [0, 100]] });
    }
    problem = "";
    areas.push({ erase, points: points.map(([x, y]) => [r2(x), r2(y)]) });
    render();
  }

  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-x], [data-shape]");
    if (!b) return;
    problem = "";
    if (b.dataset.shape) {
      shape = b.dataset.shape;
      pen = [];
    }
    const x = b.dataset.x;
    if (x === "cancel") return close();
    if (x === "done") {
      // A pen shape still open is kept, as if closed.
      if (pen.length >= 3) closePen();
      pen = [];
      close();
      return onDone(areas);
    }
    if (x === "paint") erase = false;
    if (x === "erase") erase = true;
    if (x === "pen-close") return closePen();
    if (x === "pen-back") pen.pop();
    if (x === "pen-cancel") pen = [];
    if (x === "undo") areas.pop();
    if (x === "clear") areas = [];
    render();
  });

  const at = (ev) => {
    const r = canvas.getBoundingClientRect();
    return [clamp(((ev.clientX - r.left) / r.width) * 100, 0, 100), clamp(((ev.clientY - r.top) / r.height) * 100, 0, 100)];
  };
  // The pen: each click adds a point; clicking the first point closes the shape.
  canvas.addEventListener("pointermove", (e) => {
    if (shape !== "pen" || !pen.length) return;
    const next = lines.querySelector("[data-pen-next]");
    next?.setAttribute("points", [pen[pen.length - 1], at(e)].map((p) => p.join(",")).join(" "));
  });
  canvas.addEventListener("dblclick", (e) => {
    if (shape !== "pen") return;
    e.preventDefault();
    // The double-click's second click added a point at the same spot: drop it.
    if (pen.length > 3) pen.pop();
    closePen();
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    if (shape === "pen") {
      const p = at(e);
      const r = canvas.getBoundingClientRect();
      const first = pen[0];
      // Within ~12px of the first point: close the shape.
      if (first && pen.length >= 3 && Math.hypot(((p[0] - first[0]) * r.width) / 100, ((p[1] - first[1]) * r.height) / 100) < 12) {
        return closePen();
      }
      problem = "";
      pen.push(p);
      return render();
    }
    canvas.setPointerCapture(e.pointerId);
    const draft = lines.querySelector("[data-draft]");
    const start = at(e);
    const r = canvas.getBoundingClientRect();
    const hPerW = r.width / (r.height || 1); // a circle's height in % for each % of width
    let pts = [start];
    const show = () => draft.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
    const move = (ev) => {
      const end = at(ev);
      if (shape === "free") {
        pts.push(end);
        return show();
      }
      let w = end[0] - start[0];
      let h = end[1] - start[1];
      if (shape === "circle") {
        const size = Math.max(Math.abs(w), Math.abs(h) / hPerW);
        w = Math.sign(w || 1) * size;
        h = Math.sign(h || 1) * size * hPerW;
      }
      const x0 = clamp(Math.min(start[0], start[0] + w), 0, 100);
      const y0 = clamp(Math.min(start[1], start[1] + h), 0, 100);
      const x1 = clamp(Math.max(start[0], start[0] + w), 0, 100);
      const y1 = clamp(Math.max(start[1], start[1] + h), 0, 100);
      pts =
        shape === "rect"
          ? [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
          : around(48, (t) => [x0 + ((x1 - x0) * (1 + Math.cos(t))) / 2, y0 + ((y1 - y0) * (1 + Math.sin(t))) / 2]);
      show();
    };
    const up = () => {
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      add(shape === "free" ? thin(pts) : pts);
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
  });

  function onKey(e) {
    // While drawing with the pen: Enter closes the shape, Backspace removes the last point, Escape drops it.
    if (pen.length) {
      if (e.key === "Enter") {
        e.preventDefault();
        return closePen();
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        pen.pop();
        return render();
      }
      if (e.key === "Escape") {
        e.stopPropagation();
        pen = [];
        return render();
      }
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && areas.length) {
      e.preventDefault();
      areas.pop();
      render();
    }
  }
  document.addEventListener("keydown", onKey, true);
  render();
}
