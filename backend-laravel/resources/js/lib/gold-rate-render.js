// Draws a gold-rate poster: the master PNG untouched as the background, with
// the logo and the visible rates laid over it. The editor's live view, its
// preview and the downloaded PNG all come from drawPoster(), so what the
// admin sees is what they download. Every coordinate is in the master's own
// pixels — see App\Support\GoldRates\TemplateLayout for the layout shape.

import QRCode from "qrcode";

export const PURITIES = ["24K", "22K", "21K", "18K"];

// Business detail boxes (TemplateLayout::DETAILS); "qr" is the QR code.
export const DETAILS = ["name", "phone", "address", "website", "page", "instagram", "facebook", "tagline", "hours"];

const rateFormat = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

// "{label}: {currency}{rate}" -> "22K Gold: ₹6,850". A rate not entered yet
// shows as a dash rather than a zero.
export function rateText(purity, field, rate) {
  const value = rate === null || rate === undefined || rate === "" || Number.isNaN(Number(rate)) ? "—" : rateFormat.format(Number(rate));
  return (field.text ?? "")
    .replaceAll("{label}", field.label ?? "")
    .replaceAll("{currency}", field.currency ?? "")
    .replaceAll("{rate}", value)
    .replaceAll("{purity}", purity);
}

// "10:00" -> "10 AM", "13:30" -> "1:30 PM"
function clock(time) {
  const [h, m] = String(time).split(":").map(Number);
  if (Number.isNaN(h)) return String(time);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

// Today's opening hours from the business's week (dayOfWeek 0 = Sunday).
export function todayHours(hours, date = new Date()) {
  const today = (hours ?? []).find((h) => Number(h.dayOfWeek) === date.getDay());
  if (!today) return "";
  return today.isClosed ? "Closed today" : `Open today ${clock(today.openTime)} – ${clock(today.closeTime)}`;
}

// A business detail box's text: "Call {phone}" -> "Call 98765 43210". Empty
// when no business is linked, so nothing is drawn.
export function detailText(field, card) {
  if (!card) return "";
  const vars = { ...card.vars, hours: todayHours(card.hours), label: field.label ?? "" };
  return (field.text ?? "").replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] ?? "" : match)).trim();
}

function fontSpec(field, size) {
  return `${field.fontWeight} ${size}px "${field.fontFamily}"`;
}

// The style keys a rate box may leave out (layouts saved before they
// existed). Matches TemplateLayout::FIELD_DEFAULTS on the server.
//   design "plain": one line of text across the box.
//   design "split": the label in the left part (splitRatio of the width,
//   with its own labelColor/labelBackground) and the text in the rest.
//   shape "rect" (corners rounded by radius), "ribbon" (V-notched ends) or
//   "chamfer" (corners cut off by radius).
//   gradientDirection applies to both background and label gradients.
//   glowColor puts a soft glow behind the text; uppercase capitalises it.
export const FIELD_DEFAULTS = {
  design: "plain",
  radius: 0,
  borderColor: null,
  borderWidth: 0,
  background2: null,
  shadow: false,
  labelColor: null,
  labelBackground: null,
  splitRatio: 0.45,
  shape: "rect",
  gradientDirection: "vertical",
  labelBackground2: null,
  glowColor: null,
  uppercase: false,
};

export function fieldWithDefaults(field) {
  const f = { ...FIELD_DEFAULTS, ...field };
  f.labelColor ??= f.color;
  return f;
}

// Web fonts only load once something asks for them; a canvas won't wait, so
// ask first. Passing the text pulls in the right subset (₹, Malayalam, …).
export async function ensureFonts(layout, rates) {
  if (!document.fonts?.load) return;
  const loads = PURITIES.filter((p) => layout.fields[p]?.visible).map((p) =>
    document.fonts
      .load(fontSpec(layout.fields[p], 32), `${layout.fields[p].label ?? ""} ${rateText(p, layout.fields[p], rates?.[p])}`)
      .catch(() => undefined),
  );
  await Promise.all(loads);
}

// The same, for the visible business detail boxes.
async function ensureDetailFonts(layout, card) {
  if (!document.fonts?.load || !card) return;
  await Promise.all(
    DETAILS.filter((k) => layout.details?.[k]?.visible).map((k) =>
      document.fonts.load(fontSpec(layout.details[k], 32), `${layout.details[k].label ?? ""} ${detailText(layout.details[k], card)}`).catch(() => undefined),
    ),
  );
}

// How deep a ribbon's notches cut in, and how far a chamfer's corners are
// cut off.
const notchDepth = (w, h) => Math.min(h * 0.35, w * 0.15);
const chamferSize = (w, h, r) => Math.min(r > 0 ? r : h * 0.25, w / 2, h / 2);

// The box's outline in its shape.
function shapePath(ctx, shape, x, y, w, h, r) {
  ctx.beginPath();
  if (shape === "ribbon") {
    const d = notchDepth(w, h);
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - d, y + h / 2);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + d, y + h / 2);
    ctx.closePath();
  } else if (shape === "chamfer") {
    const c = chamferSize(w, h, r);
    ctx.moveTo(x + c, y);
    ctx.lineTo(x + w - c, y);
    ctx.lineTo(x + w, y + c);
    ctx.lineTo(x + w, y + h - c);
    ctx.lineTo(x + w - c, y + h);
    ctx.lineTo(x + c, y + h);
    ctx.lineTo(x, y + h - c);
    ctx.lineTo(x, y + c);
    ctx.closePath();
  } else if (r <= 0) {
    ctx.rect(x, y, w, h);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

// A flat colour, or a gradient across the given area.
function paint(ctx, from, to, direction, x, y, w, h) {
  if (!to) return from;
  const g =
    direction === "horizontal"
      ? ctx.createLinearGradient(x, 0, x + w, 0)
      : direction === "diagonal"
        ? ctx.createLinearGradient(x, y, x + w, y + h)
        : ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  return g;
}

function softShadow(ctx, height) {
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = height * 0.18;
  ctx.shadowOffsetY = height * 0.06;
}

function glow(ctx, color, height) {
  ctx.shadowColor = color;
  ctx.shadowBlur = height * 0.3;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

// Text in a slot of the box, shrunk to fit if it would overflow, centred
// vertically on the glyphs actually drawn.
function drawText(ctx, text, field, color, left, width, align, top, height) {
  if (!text) return;
  if (field.uppercase) text = text.toLocaleUpperCase();
  let size = field.fontSize;
  ctx.font = fontSpec(field, size);
  const pad = Math.min(size, height) * 0.15;
  const room = Math.max(1, width - pad * 2);
  const measured = ctx.measureText(text).width;
  if (measured > room) {
    size = Math.max(1, size * (room / measured));
    ctx.font = fontSpec(field, size);
  }

  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent ?? size * 0.75;
  const descent = metrics.actualBoundingBoxDescent ?? size * 0.25;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = align;
  const tx = align === "left" ? left + pad : align === "right" ? left + width - pad : left + width / 2;
  ctx.fillText(text, tx, top + height / 2 + (ascent - descent) / 2);
}

// One rate box.
export function drawField(ctx, purity, field, rate) {
  drawBox(ctx, field, rateText(purity, field, rate));
}

// One business detail box.
export function drawDetail(ctx, field, card) {
  const text = detailText(field, card);
  if (text) drawBox(ctx, field, text);
}

// A text box: background (flat or a gradient, in its shape, with an
// optional soft shadow), the label part of a split design, the border,
// then the text (with an optional glow).
export function drawBox(ctx, rawField, text) {
  const f = fieldWithDefaults(rawField);
  const { x, y, width: w, height: h } = f;
  const r = Math.min(Math.max(f.radius, 0), w / 2, h / 2);
  const outline = (ix, iy, iw, ih, ir) => shapePath(ctx, f.shape, ix, iy, iw, ih, ir);

  if (f.background) {
    ctx.save();
    if (f.shadow) softShadow(ctx, h);
    outline(x, y, w, h, r);
    ctx.fillStyle = paint(ctx, f.background, f.background2, f.gradientDirection, x, y, w, h);
    ctx.fill();
    ctx.restore();
  }
  const split = f.design === "split";
  const labelWidth = w * Math.min(Math.max(f.splitRatio, 0.15), 0.85);
  if (split && f.labelBackground) {
    ctx.save();
    outline(x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = paint(ctx, f.labelBackground, f.labelBackground2, f.gradientDirection, x, y, labelWidth, h);
    ctx.fillRect(x, y, labelWidth, h);
    ctx.restore();
  }
  const bw = f.borderColor && f.borderWidth > 0 ? Math.min(f.borderWidth, w / 2, h / 2) : 0;
  if (bw) {
    ctx.save();
    outline(x + bw / 2, y + bw / 2, w - bw, h - bw, Math.max(0, r - bw / 2));
    ctx.lineWidth = bw;
    ctx.lineJoin = "round";
    ctx.strokeStyle = f.borderColor;
    ctx.stroke();
    ctx.restore();
  }

  // Text keeps clear of the border, rounded corners, notches and cut corners.
  const edge = f.shape === "ribbon" ? notchDepth(w, h) : f.shape === "chamfer" ? chamferSize(w, h, r) * 0.6 : r * 0.3;
  const inset = bw + edge;
  ctx.save();
  if (f.glowColor) glow(ctx, f.glowColor, h);
  // Without a background, the shadow goes on the text instead.
  else if (f.shadow && !f.background) softShadow(ctx, h);
  if (split) {
    drawText(ctx, f.label, f, f.labelColor, x + inset, labelWidth - inset, "center", y, h);
    drawText(ctx, text, f, f.color, x + labelWidth, w - labelWidth - inset, f.align, y, h);
  } else {
    drawText(ctx, text, f, f.color, x + inset, w - inset * 2, f.align, y, h);
  }
  ctx.restore();
}

// Where a QR code leads: the business's website if chosen and it has one,
// otherwise its Markkito page.
export function qrTarget(qr, card) {
  return qr.target === "website" && card?.websiteUrl ? card.websiteUrl : card?.pageUrl ?? "";
}

// A square QR code, as large as fits its box, drawn module by module so it
// stays sharp at any size. The light margin around it is the background.
export function drawQr(ctx, qr, card) {
  const url = qrTarget(qr, card);
  if (!url) return;
  const modules = QRCode.create(url, { errorCorrectionLevel: "M" }).modules;
  const quiet = qr.background ? 2 : 0;
  const side = Math.min(qr.width, qr.height);
  const left = qr.x + (qr.width - side) / 2;
  const top = qr.y + (qr.height - side) / 2;
  const cell = side / (modules.size + quiet * 2);
  // Whole-pixel edges, so neighbouring modules leave no hairline gaps.
  const at = (start, i) => Math.round(start + (i + quiet) * cell);
  if (qr.background) {
    ctx.fillStyle = qr.background;
    ctx.fillRect(left, top, side, side);
  }
  ctx.fillStyle = qr.color;
  for (let r = 0; r < modules.size; r++) {
    for (let c = 0; c < modules.size; c++) {
      if (modules.get(r, c)) ctx.fillRect(at(left, c), at(top, r), at(left, c + 1) - at(left, c), at(top, r + 1) - at(top, r));
    }
  }
}

// The logo fitted inside its box without stretching, centred.
export function logoRect(box, logo) {
  const scale = Math.min(box.width / logo.naturalWidth, box.height / logo.naturalHeight);
  const w = logo.naturalWidth * scale;
  const h = logo.naturalHeight * scale;
  return { x: box.x + (box.width - w) / 2, y: box.y + (box.height - h) / 2, width: w, height: h };
}

// Draws onto a context whose canvas is the master's exact size.
export function drawPoster(ctx, { background, logo, layout, rates, business }) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(background, 0, 0, width, height);

  if (logo && layout.logo.visible) {
    const r = logoRect(layout.logo, logo);
    ctx.drawImage(logo, r.x, r.y, r.width, r.height);
  }
  for (const purity of PURITIES) {
    const field = layout.fields[purity];
    if (field?.visible) drawField(ctx, purity, field, rates?.[purity]);
  }
  if (business) {
    for (const key of DETAILS) {
      const detail = layout.details?.[key];
      if (detail?.visible) drawDetail(ctx, detail, business);
    }
    if (layout.details?.qr?.visible) drawQr(ctx, layout.details.qr, business);
  }
}

// A fresh canvas at the master's size with the finished poster on it —
// nothing from the editor (handles, outlines) is ever drawn here.
export async function renderPoster({ width, height, background, logo, layout, rates, business }) {
  await Promise.all([ensureFonts(layout, rates), ensureDetailFonts(layout, business)]);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  drawPoster(canvas.getContext("2d"), { background, logo, layout, rates, business });
  return canvas;
}

export function posterBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("This browser could not export an image this large. Try a desktop browser."))),
      "image/png",
    ),
  );
}

// "Kerala Daily" on 26 Oct 2026 -> "kerala-daily-gold-rate-2026-10-26.png"
export function posterFileName(name, date = new Date()) {
  const slug =
    String(name)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "template";
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return `${slug}-gold-rate-${day}.png`;
}

export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Loads a saved template's images and downloads it with today's rates —
// for the template list, without opening the editor.
// The logo a template draws: always its linked business's own.
export function templateLogoUrl(template) {
  return template.businessCard?.logoUrl ?? null;
}

export async function downloadSavedTemplate(template, rates) {
  const logoUrl = templateLogoUrl(template);
  const [background, logo] = await Promise.all([loadImage(template.imageUrl), logoUrl ? loadImage(logoUrl) : null]);
  const canvas = await renderPoster({
    width: template.imageWidth,
    height: template.imageHeight,
    background,
    logo,
    layout: template.layout,
    rates,
    business: template.businessCard,
  });
  saveBlob(await posterBlob(canvas), posterFileName(template.name));
}
