// The DOM types come from xmldom itself: this runs in Node, where the
// built-in `Element` of a browser does not exist.
import { Document, DOMParser, Element, Node, XMLSerializer } from "@xmldom/xmldom";
import { AppError } from "@/common/errors";
import { escapeXml, initials } from "./text";
import {
  fillPlaceholders,
  IMAGE_TOKENS,
  PosterSubject,
  stripPlaceholders,
  tokenIn,
  unknownPlaceholders,
} from "./placeholders";

/**
 * Filling a designer's own slots.
 *
 * A finished poster arrives with the variable parts marked in it —
 * `@CLINIC_NAME@` where the shop's name goes, a dashed box labelled `@LOGO@`,
 * another labelled `@QR_CODE@`. In a PNG those marks are pixels: there is no
 * way to find them without reading the picture, which is why compositing can
 * only lay its own strips over the top and leave the designer's labels showing
 * underneath.
 *
 * In an SVG they are elements. `@CLINIC_NAME@` is a text node with a position,
 * a font and a size chosen by the designer, so the shop's name can be put
 * exactly where it was meant to go, looking the way it was meant to look. That
 * is the whole reason this module exists: the same artwork, delivered as SVG
 * instead of PNG, turns an approximation into an exact fill — with no image
 * model, no per-poster cost and no drift from the published design.
 *
 * SVG is also a document that can carry script, and this one is served from
 * the platform's own origin, so nothing is used until it has been through
 * `sanitizeSvg`.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Elements with no place in artwork, each of which can run something or reach
 * off the page. `<a>` is kept — a link is harmless once its href is filtered —
 * but the animation elements are not, because they can rewrite an attribute
 * after the sanitiser has approved it.
 */
const FORBIDDEN_ELEMENTS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "embed",
  "object",
  "audio",
  "video",
  "animate",
  "animatetransform",
  "animatemotion",
  "set",
  "handler",
  "listener",
]);

/** A reference that stays inside this document, or carries its own bytes. */
function safeReference(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("#") || /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(trimmed);
}

/** Strips `url(...)` that points anywhere but this document, and @import. */
function safeCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (match, _quote, target: string) =>
      safeReference(target) ? match : "none",
    );
}

interface Removal {
  what: string;
}

function scrub(node: Element, removed: Removal[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== 1) continue;
    const element = child as Element;
    const name = (element.localName ?? element.nodeName).toLowerCase();

    if (FORBIDDEN_ELEMENTS.has(name)) {
      node.removeChild(child);
      removed.push({ what: `<${name}>` });
      continue;
    }

    for (const attribute of Array.from(element.attributes ?? [])) {
      const attributeName = attribute.name.toLowerCase();
      const value = attribute.value ?? "";

      // Event handlers are the obvious one; `javascript:` anywhere at all is
      // the one that hides in attributes nobody thinks to check.
      if (attributeName.startsWith("on") || /javascript:/i.test(value)) {
        element.removeAttribute(attribute.name);
        removed.push({ what: attributeName });
        continue;
      }

      if (attributeName === "href" || attributeName === "xlink:href" || attributeName === "src") {
        if (!safeReference(value)) {
          element.removeAttribute(attribute.name);
          removed.push({ what: `${attributeName} to ${value.slice(0, 40)}` });
        }
        continue;
      }

      if (attributeName === "style") element.setAttribute(attribute.name, safeCss(value));
    }

    // A <style> block reaches every element at once, so its text gets the same
    // treatment as an inline style attribute.
    if (name === "style" && element.textContent) element.textContent = safeCss(element.textContent);

    scrub(element, removed);
  }
}

export interface SanitizedSvg {
  svg: string;
  /** What was taken out, so an admin is told rather than left guessing. */
  removed: string[];
}

/** Parses an uploaded SVG and returns it with everything executable removed. */
export function sanitizeSvg(source: string): SanitizedSvg {
  let document;
  try {
    document = new DOMParser({ onError: () => {} }).parseFromString(source, "image/svg+xml");
  } catch {
    throw AppError.badRequest("That file could not be read as an SVG");
  }

  const root = document.documentElement as Element | null;
  if (!root || (root.localName ?? root.nodeName).toLowerCase() !== "svg") {
    throw AppError.badRequest("That file is not an SVG drawing");
  }

  const removed: Removal[] = [];
  // The root carries attributes too, and a handler on <svg> runs like any
  // other. Scrubbing from a wrapper covers it without a special case.
  const wrapper = document.createElement("g");
  wrapper.appendChild(root.cloneNode(true));
  scrub(wrapper, removed);

  const cleaned = wrapper.firstChild;
  if (!cleaned) throw AppError.badRequest("That SVG has nothing in it");

  return {
    svg: new XMLSerializer().serializeToString(cleaned),
    removed: [...new Set(removed.map((r) => r.what))],
  };
}

/** The drawing's own size, from its width/height or its viewBox. */
export function svgDimensions(svg: string): { width: number; height: number } | null {
  const number = (raw: string | undefined): number | null => {
    if (!raw) return null;
    // Units are dropped: the poster is drawn in the document's own units, and
    // "1080px" and "1080" describe the same canvas.
    const value = Number.parseFloat(raw.replace(/[a-z%]+$/i, ""));
    return Number.isFinite(value) && value > 0 ? value : null;
  };

  const attribute = (name: string) => svg.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"))?.[1];

  const width = number(attribute("width"));
  const height = number(attribute("height"));
  if (width && height) return { width: Math.round(width), height: Math.round(height) };

  const viewBox = attribute("viewBox")?.trim().split(/[\s,]+/);
  if (viewBox?.length === 4) {
    const w = number(viewBox[2]);
    const h = number(viewBox[3]);
    if (w && h) return { width: Math.round(w), height: Math.round(h) };
  }
  return null;
}

/** Every element that can hold a slot's label. */
function textElements(root: Element): Element[] {
  const found: Element[] = [];
  const walk = (node: Element) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== 1) continue;
      const element = child as Element;
      const name = (element.localName ?? element.nodeName).toLowerCase();
      if (name === "text" || name === "tspan") found.push(element);
      walk(element);
    }
  };
  walk(root);
  return found;
}

/**
 * Which slots a template has, named canonically.
 *
 * Reported back to the admin on upload, because "we found @CLINIC_NAME@ and
 * @PHONE@ but no @QR_CODE@" is the difference between noticing a mistyped slot
 * now and discovering it on a hundred shops' posters later.
 */
export interface TemplateSlots {
  /** Slots this fills with the shop's own details. */
  known: string[];
  /** Slots nothing fills. They are blanked on the poster rather than printed,
   *  so the only place they can be caught is here. */
  unknown: string[];
}

export function svgSlots(svg: string): TemplateSlots {
  const document = new DOMParser({ onError: () => {} }).parseFromString(svg, "image/svg+xml");
  const root = document.documentElement as Element;
  const known = new Set<string>();
  const unknown = new Set<string>();

  for (const element of textElements(root)) {
    const content = element.textContent ?? "";
    const token = tokenIn(content);
    if (!token) continue;
    for (const name of unknownPlaceholders(content)) unknown.add(name);
    if (unknownPlaceholders(content).length === 0) known.add(token);
  }
  return { known: [...known], unknown: [...unknown] };
}

interface SlotBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The area an image slot covers.
 *
 * A designer marks one by drawing a box and labelling it, so the box is what
 * to look for: a rectangle beside the label, inside the same group. Only a
 * *dashed* rectangle is treated as a marker and removed — a solid one is more
 * likely to be part of the design (the white plate a QR needs for contrast is
 * exactly that), and deleting it would take a piece of the poster with it.
 *
 * With no rectangle to go on, the label's own type size sets the scale. That
 * is a guess, and a poster is worth more than a guess, so the size is reported
 * to the admin as having been inferred.
 */
function slotBox(label: Element): { box: SlotBox; marker: Element | null; inferred: boolean } {
  const parent = label.parentNode as Element | null;
  const number = (element: Element, name: string) => Number.parseFloat(element.getAttribute(name) ?? "");

  if (parent) {
    for (const sibling of Array.from(parent.childNodes)) {
      if (sibling.nodeType !== 1) continue;
      const element = sibling as Element;
      if ((element.localName ?? element.nodeName).toLowerCase() !== "rect") continue;

      const box = {
        x: number(element, "x") || 0,
        y: number(element, "y") || 0,
        width: number(element, "width"),
        height: number(element, "height"),
      };
      if (!(box.width > 0 && box.height > 0)) continue;

      const dashed = element.hasAttribute("stroke-dasharray");
      return { box, marker: dashed ? element : null, inferred: false };
    }
  }

  const x = number(label, "x") || 0;
  const y = number(label, "y") || 0;
  const fontSize = number(label, "font-size") || 16;
  const side = fontSize * 4;
  // Anchored on the text's baseline, so the image sits where the words did.
  return { box: { x, y: y - side * 0.8, width: side, height: side }, marker: null, inferred: true };
}

export interface FillOptions {
  /** Data URI for the shop's logo, or null when it has none. */
  logoHref: string | null;
  /** Data URI for the shop's QR, or null when the design does not want one. */
  qrHref: string | null;
}

export interface FilledTemplate {
  svg: string;
  /** Slots that were filled, and slots left as they were and why. */
  filled: string[];
  unfilled: string[];
}

/**
 * Puts one shop's details into a template's slots.
 *
 * Text slots become that shop's words in the designer's own type. Image slots
 * become an `<image>` covering the marked area, always with `meet` so nothing
 * is cropped or stretched — a squashed logo is bad and a squashed QR does not
 * scan at all.
 */
export function fillSvgTemplate(svg: string, subject: PosterSubject, options: FillOptions): FilledTemplate {
  const document = new DOMParser({ onError: () => {} }).parseFromString(svg, "image/svg+xml");
  const root = document.documentElement as Element;

  const filled = new Set<string>();
  const unfilled = new Set<string>();

  for (const label of textElements(root)) {
    const content = label.textContent ?? "";
    const token = tokenIn(content);

    if (!token || !IMAGE_TOKENS.has(token)) continue;

    const href = token === "logo" ? options.logoHref : options.qrHref;
    const { box, marker } = slotBox(label);

    if (!href) {
      unfilled.add(token);
      // Held before the label is detached — afterwards it has no parent to
      // put anything back into.
      const parent = label.parentNode;
      // The label goes, and so does the guide box drawn around it — a dashed
      // rectangle is instruction to the designer, not part of the poster, and
      // printing it is worse than an empty corner.
      label.parentNode?.removeChild(label);
      marker?.parentNode?.removeChild(marker);

      // A shop with no logo gets its initials, which is what the dashboard
      // tells it will happen. There is no equivalent for a QR: a monogram
      // where a code should be does not scan, it just misleads.
      if (token === "logo" && parent) monogram(document, parent, label, box, subject);
      continue;
    }

    const image = document.createElementNS(SVG_NS, "image");
    image.setAttribute("href", href);
    image.setAttribute("x", String(box.x));
    image.setAttribute("y", String(box.y));
    image.setAttribute("width", String(box.width));
    image.setAttribute("height", String(box.height));
    image.setAttribute("preserveAspectRatio", "xMidYMid meet");

    label.parentNode?.replaceChild(image, label);
    marker?.parentNode?.removeChild(marker);
    filled.add(token);
  }

  // Text slots afterwards, so an image slot's label is long gone by the time
  // the string substitution runs and cannot be half-replaced by it.
  for (const element of textElements(root)) {
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType !== 3) continue;
      const before = child.nodeValue ?? "";
      const token = tokenIn(before);
      if (!token) continue;

      // Anything left over after the fill is a slot nothing knows about, and
      // it is wiped rather than printed — see `stripPlaceholders`.
      const after = stripPlaceholders(fillPlaceholders(before, subject));
      if (unknownPlaceholders(before).length > 0) unfilled.add(token);
      if (after === before) continue;
      // Replaced rather than assigned: this parser's `nodeValue` setter is a
      // no-op on a text node, so writing to it silently changes nothing.
      element.replaceChild(document.createTextNode(after), child);
      filled.add(token);
    }
  }

  return {
    svg: new XMLSerializer().serializeToString(root),
    filled: [...filled],
    unfilled: [...unfilled],
  };
}

/**
 * Initials in the logo's slot, for a shop that has not uploaded one.
 *
 * Drawn in the colour the designer gave the label, because that is a colour
 * they already chose to be readable against whatever is behind it — a fixed
 * dark or light would disappear on half the templates.
 */
function monogram(
  document: Document,
  parent: Node,
  label: Element,
  box: SlotBox,
  subject: PosterSubject,
): void {
  const colour = label.getAttribute("fill") || "#1f2937";
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = Math.min(box.width, box.height) / 2;

  const group = document.createElementNS(SVG_NS, "g");

  const ring = document.createElementNS(SVG_NS, "circle");
  ring.setAttribute("cx", String(cx));
  ring.setAttribute("cy", String(cy));
  ring.setAttribute("r", String(r));
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", colour);
  ring.setAttribute("stroke-width", String(Math.max(2, r * 0.07)));
  group.appendChild(ring);

  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(cx));
  // Nudged below centre so the letters sit optically centred, not baseline-centred.
  text.setAttribute("y", String(cy + r * 0.34));
  text.setAttribute("font-family", label.getAttribute("font-family") || "Arial, Helvetica, sans-serif");
  text.setAttribute("font-size", String(r * 0.9));
  text.setAttribute("font-weight", "700");
  text.setAttribute("fill", colour);
  text.setAttribute("text-anchor", "middle");
  text.appendChild(document.createTextNode(initials(subject.name)));
  group.appendChild(text);

  parent.appendChild(group);
}

/** True for a data URI holding an SVG — the only artwork with fillable slots. */
export function isSvgDataUri(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith("data:image/svg+xml"));
}

/** The SVG inside a data URI, base64 or percent-encoded. */
export function svgFromDataUri(dataUri: string): string {
  const comma = dataUri.indexOf(",");
  const body = dataUri.slice(comma + 1);
  return dataUri.slice(0, comma).includes(";base64")
    ? Buffer.from(body, "base64").toString("utf8")
    : decodeURIComponent(body);
}

/** A template as a data URI, for storing on the design row. */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

export { escapeXml };
