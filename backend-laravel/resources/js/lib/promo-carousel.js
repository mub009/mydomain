import { $$ } from "./ui";

const INTERVAL_MS = 4500;

// The home page's rotating promo card: crossfading backgrounds, a text
// block per slide, and dots. Pauses while hovered.
export function initPromoCarousel(root) {
  const backgrounds = $$("[data-promo-bg]", root);
  const texts = $$("[data-promo-text]", root);
  const dots = $$("[data-promo-dot]", root);
  let active = 0;
  let timer = null;

  function show(index) {
    active = index;
    backgrounds.forEach((bg, i) => {
      bg.classList.toggle("opacity-100", i === index);
      bg.classList.toggle("opacity-0", i !== index);
    });
    texts.forEach((t, i) => (t.hidden = i !== index));
    dots.forEach((d, i) => {
      d.className = `h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`;
    });
    root.setAttribute("href", texts[index].dataset.to);
  }

  const start = () => {
    stop();
    timer = setInterval(() => show((active + 1) % texts.length), INTERVAL_MS);
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  dots.forEach((dot, i) =>
    dot.addEventListener("click", (e) => {
      e.preventDefault();
      show(i);
    }),
  );
  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);
  start();
}
