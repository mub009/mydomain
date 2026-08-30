import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, ChevronRight, ShieldCheck, Store, Tag } from "lucide-react";

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
    label: "B2B Directory",
    subtitle: "Find suppliers",
    icon: Briefcase,
    to: "/b2b",
    className: "from-sky-900/90 via-sky-800/60",
    seed: "warehouse-logistics",
  },
  {
    label: "Buy & Sell",
    subtitle: "New & used items",
    icon: Tag,
    to: "/classifieds",
    className: "from-violet-900/90 via-violet-800/60",
    seed: "flea-market-items",
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

function BgPhoto({ seed, alt, className }: { seed: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={`https://picsum.photos/seed/${seed}/500/300`}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`absolute inset-0 h-full w-full object-cover ${className ?? ""}`}
    />
  );
}

export default function PromoCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((v) => (v + 1) % SLIDES.length), 4500);
    return () => clearInterval(id);
  }, [paused]);

  const slide = SLIDES[active];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 mb-8">
      <Link
        to={slide.to}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="col-span-2 sm:col-span-3 relative overflow-hidden rounded-xl2 bg-brand-700 p-6 flex flex-col justify-between min-h-[160px] group"
      >
        {/* Crossfading, slowly-panning backgrounds */}
        {SLIDES.map((s, i) => (
          <div
            key={s.seed}
            aria-hidden
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
          >
            <BgPhoto seed={s.seed} alt="" className="animate-kenburns" />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-900/90 via-brand-800/50 to-transparent" />

        {/* Text re-mounts on slide change to replay the fade-up */}
        <div key={active} className="relative animate-slide-fade-up">
          <h3 className="text-white text-xl font-extrabold leading-snug max-w-xs drop-shadow-sm">{slide.title}</h3>
          <p className="text-white/85 text-sm mt-1.5 max-w-xs drop-shadow-sm">{slide.subtitle}</p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold bg-white text-brand-700 rounded-lg px-3.5 py-2 w-fit group-hover:gap-2.5 transition-all">
            {slide.cta} <ArrowRight size={15} />
          </span>
        </div>

        <div className="relative flex gap-1.5 mt-3">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={(e) => {
                e.preventDefault();
                setActive(i);
              }}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`}
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
          <BgPhoto
            seed={tile.seed}
            alt={tile.label}
            className="transition-transform duration-500 group-hover:scale-110"
          />
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
