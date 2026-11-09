// The card image's recolouring — tint, hue, brightness, saturation — as one
// colour matrix. The same maths as App\Support\Cards\ImageColour, so what the
// editor shows is what the public card and the PDF draw.

export const COLOUR_DEFAULTS = { tint: null, strength: 50, hue: 0, brightness: 100, saturation: 100 };

const mul = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));

// Whether the settings change the image at all.
export function isChanged(c) {
  return (!!c.tint && c.strength > 0) || c.hue !== 0 || c.brightness !== 100 || c.saturation !== 100;
}

// Rows = output R, G, B. Saturation, then hue, then tint, then brightness.
export function colourMatrix(c) {
  const s = c.saturation / 100;
  const sat = [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ];
  const a = (c.hue * Math.PI) / 180;
  const [cos, sin] = [Math.cos(a), Math.sin(a)];
  const hue = [
    [0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928],
    [0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283],
    [0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072],
  ];
  let tint = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  if (c.tint && c.strength > 0) {
    const rgb = [1, 3, 5].map((i) => parseInt(c.tint.slice(i, i + 2), 16) / 255);
    const lum = Math.max(0.05, 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]);
    const k = c.strength / 100;
    tint = [0, 1, 2].map((i) => {
      const f = rgb[i] / lum;
      return [(1 - k) * (i === 0 ? 1 : 0) + k * f * 0.2126, (1 - k) * (i === 1 ? 1 : 0) + k * f * 0.7152, (1 - k) * (i === 2 ? 1 : 0) + k * f * 0.0722];
    });
  }
  const b = c.brightness / 100;
  const bright = [
    [b, 0, 0],
    [0, b, 0],
    [0, 0, b],
  ];
  return mul(bright, mul(tint, mul(hue, sat)));
}

export function svgValues(c) {
  return `${colourMatrix(c)
    .map((row) => `${row.map((v) => +v.toFixed(4)).join(" ")} 0 0`)
    .join(" ")} 0 0 0 1 0`;
}

// Whether the colour is limited to marked areas (else it covers the whole image).
export const isPartial = (c) => Array.isArray(c?.areas) && c.areas.length > 0;

// The areas as an SVG image for a CSS mask: opaque where the colour shows.
// Drawn in order, so an eraser takes the colour away from the areas before
// it. The same as App\Support\Cards\ImageColour::mask.
export function maskUrl(areas) {
  const shapes = areas
    .map((a) => `<polygon points="${a.points.map(([x, y]) => `${+x},${+y}`).join(" ")}" fill="${a.erase ? "black" : "white"}"/>`)
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">` +
    `<defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="black"/>${shapes}</mask></defs>` +
    `<rect width="100" height="100" fill="white" mask="url(#m)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Applies the settings to an <img> on this page, through one shared SVG filter.
// With areas, the image itself stays as it is and a recoloured copy laid over
// it (in the image's own box: its parent) shows only inside them. Anything
// that isn't an <img> (the editor's layer of boxes) takes the colour only
// when it covers the whole image.
export function applyToImage(img, c) {
  ensureFilter(c);
  const partial = isPartial(c) && isChanged(c);
  const parent = img.parentElement;
  let layer = parent?.querySelector(":scope > img[data-colour-layer]");
  if (img.tagName === "IMG" && partial) {
    if (!layer) {
      layer = document.createElement("img");
      layer.dataset.colourLayer = "";
      layer.alt = "";
      layer.setAttribute("aria-hidden", "true");
      layer.draggable = false;
      layer.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;max-width:none";
      img.after(layer);
      if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
    }
    if (layer.getAttribute("src") !== img.getAttribute("src")) layer.src = img.getAttribute("src");
    layer.hidden = img.classList.contains("hidden");
    layer.style.filter = "url(#card-colour-live)";
    const mask = maskUrl(c.areas);
    layer.style.webkitMask = `${mask} 0 0/100% 100% no-repeat`;
    layer.style.mask = `${mask} 0 0/100% 100% no-repeat`;
    img.style.filter = "";
    return;
  }
  layer?.remove();
  img.style.filter = isChanged(c) && !partial ? "url(#card-colour-live)" : "";
}

function ensureFilter(c) {
  let svg = document.getElementById("card-colour-svg");
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "card-colour-svg";
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.innerHTML = `<filter id="card-colour-live" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" color-interpolation-filters="sRGB" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" /></filter>`;
    document.body.appendChild(svg);
  }
  svg.querySelector("feColorMatrix").setAttribute("values", svgValues(c));
}
