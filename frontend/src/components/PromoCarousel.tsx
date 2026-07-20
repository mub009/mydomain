import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, CalendarCheck2, ChevronRight, ShieldCheck, Store } from "lucide-react";

const SLIDES = [
  {
    title: "Discover trusted local businesses",
    subtitle: "Compare ratings, read reviews, and connect in minutes.",
    cta: "Explore now",
    to: "/",
    seed: "storefront-street",
  },
  {
    title: "Book services in a few taps",
    subtitle: "Real-time availability, instant confirmation.",
    cta: "Browse services",
    to: "/",
    seed: "service-calendar",
  },
  {
    title: "Grow your business with us",
    subtitle: "List your business and start receiving leads today.",
    cta: "List your business",
    to: "/register",
    seed: "small-business-owner",
  },
];

const PROMO_TILES = [
  {
    label: "B2B Marketplace",
    subtitle: "Quick quotes",
    icon: Briefcase,
    to: "/b2b",
    className: "from-sky-900/90 via-sky-800/60",
    seed: "warehouse-logistics",
  },
  {
    label: "Book a service",
    subtitle: "Instant scheduling",
    icon: CalendarCheck2,
    to: "/",
    className: "from-violet-900/90 via-violet-800/60",
    seed: "technician-repair",
  },
  {
    label: "Verified businesses",
    subtitle: "Ratings you can trust",
    icon: ShieldCheck,
    to: "/",
    className: "from-amber-900/90 via-amber-800/60",
    seed: "modern-office-building",
  },
  {
    label: "List your business",
    subtitle: "Reach new customers",
    icon: Store,
    to: "/register",
    className: "from-brand-900/90 via-brand-800/60",
    seed: "shopkeeper-storefront",
  },
];

function BgPhoto({ seed, alt }: { seed: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={`https://picsum.photos/seed/${seed}/500/300`}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

export default function PromoCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((v) => (v + 1) % SLIDES.length), 4500);
    return () => clearInterval(id);
  }, []);

  const slide = SLIDES[active];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 mb-8">
      <Link
        to={slide.to}
        className="col-span-2 sm:col-span-3 relative overflow-hidden rounded-xl2 bg-brand-700 p-6 flex flex-col justify-between min-h-[160px] group"
      >
        <BgPhoto key={slide.seed} seed={slide.seed} alt={slide.title} />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-900/90 via-brand-800/50 to-transparent" />
        <div className="relative">
          <h3 className="text-white text-xl font-extrabold leading-snug max-w-xs drop-shadow-sm">{slide.title}</h3>
          <p className="text-white/85 text-sm mt-1.5 max-w-xs drop-shadow-sm">{slide.subtitle}</p>
        </div>
        <span className="relative inline-flex items-center gap-1.5 text-sm font-semibold bg-white text-brand-700 rounded-lg px-3.5 py-2 w-fit group-hover:gap-2.5 transition-all">
          {slide.cta} <ArrowRight size={15} />
        </span>
        <div className="relative flex gap-1.5 mt-3">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
            />
          ))}
        </div>
      </Link>

      {PROMO_TILES.map((tile) => (
        <Link
          key={tile.label}
          to={tile.to}
          className="relative overflow-hidden rounded-xl2 bg-ink-900 p-4 flex flex-col justify-between min-h-[160px] group"
        >
          <BgPhoto seed={tile.seed} alt={tile.label} />
          <div className={`absolute inset-0 bg-gradient-to-t ${tile.className} to-transparent`} />
          <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-white backdrop-blur-sm">
            <tile.icon size={18} />
          </span>
          <div className="relative">
            <p className="text-white font-bold text-sm leading-tight drop-shadow-sm">{tile.label}</p>
            <p className="text-white/85 text-xs mt-0.5 drop-shadow-sm">{tile.subtitle}</p>
          </div>
          <ChevronRight size={16} className="relative self-end text-white/80 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      ))}
    </div>
  );
}
