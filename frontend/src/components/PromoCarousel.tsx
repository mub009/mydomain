import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, CalendarCheck2, ChevronRight, ShieldCheck, Store } from "lucide-react";

const SLIDES = [
  {
    title: "Discover trusted local businesses",
    subtitle: "Compare ratings, read reviews, and connect in minutes.",
    cta: "Explore now",
    to: "/",
  },
  {
    title: "Book services in a few taps",
    subtitle: "Real-time availability, instant confirmation.",
    cta: "Browse services",
    to: "/",
  },
  {
    title: "Grow your business with us",
    subtitle: "List your business and start receiving leads today.",
    cta: "List your business",
    to: "/register",
  },
];

const PROMO_TILES = [
  {
    label: "B2B Marketplace",
    subtitle: "Quick quotes",
    icon: Briefcase,
    to: "/b2b",
    className: "from-sky-600 to-sky-500",
  },
  {
    label: "Book a service",
    subtitle: "Instant scheduling",
    icon: CalendarCheck2,
    to: "/",
    className: "from-violet-600 to-violet-500",
  },
  {
    label: "Verified businesses",
    subtitle: "Ratings you can trust",
    icon: ShieldCheck,
    to: "/",
    className: "from-amber-600 to-amber-500",
  },
  {
    label: "List your business",
    subtitle: "Reach new customers",
    icon: Store,
    to: "/register",
    className: "from-brand-700 to-brand-500",
  },
];

export default function PromoCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((v) => (v + 1) % SLIDES.length), 4500);
    return () => clearInterval(id);
  }, []);

  const slide = SLIDES[active];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
      <Link
        to={slide.to}
        className="col-span-2 sm:col-span-2 lg:col-span-3 relative overflow-hidden rounded-xl2 bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 p-6 flex flex-col justify-between min-h-[160px] group"
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none [background-image:radial-gradient(circle_at_15%_25%,white,transparent_30%),radial-gradient(circle_at_85%_75%,white,transparent_28%)]" />
        <div className="relative">
          <h3 className="text-white text-xl font-extrabold leading-snug max-w-xs">{slide.title}</h3>
          <p className="text-brand-50/90 text-sm mt-1.5 max-w-xs">{slide.subtitle}</p>
        </div>
        <span className="relative inline-flex items-center gap-1.5 text-sm font-semibold bg-white text-brand-700 rounded-lg px-3.5 py-2 w-fit group-hover:gap-2.5 transition-all">
          {slide.cta} <ArrowRight size={15} />
        </span>
        <div className="relative flex gap-1.5 mt-3">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-white" : "w-1.5 bg-white/40"}`}
            />
          ))}
        </div>
      </Link>

      {PROMO_TILES.map((tile) => (
        <Link
          key={tile.label}
          to={tile.to}
          className={`relative overflow-hidden rounded-xl2 bg-gradient-to-br ${tile.className} p-4 flex flex-col justify-between min-h-[160px] group`}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-white">
            <tile.icon size={18} />
          </span>
          <div>
            <p className="text-white font-bold text-sm leading-tight">{tile.label}</p>
            <p className="text-white/80 text-xs mt-0.5">{tile.subtitle}</p>
          </div>
          <ChevronRight size={16} className="absolute bottom-3 right-3 text-white/70 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      ))}
    </div>
  );
}
