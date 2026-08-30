import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Briefcase,
  Building2,
  CalendarCheck2,
  Facebook,
  Instagram,
  LayoutDashboard,
  Linkedin,
  LogIn,
  LogOut,
  Menu,
  SearchCheck,
  Shield,
  ShieldCheck,
  Store,
  Twitter,
  User,
  UserPlus,
  X,
  Youtube,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";

const SOCIAL_LINKS = [
  { label: "Facebook", icon: Facebook, className: "bg-[#1877F2]" },
  { label: "YouTube", icon: Youtube, className: "bg-[#FF0000]" },
  { label: "Instagram", icon: Instagram, className: "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]" },
  { label: "LinkedIn", icon: Linkedin, className: "bg-[#0A66C2]" },
  { label: "X (Twitter)", icon: Twitter, className: "bg-ink-900" },
];

const SERVICE_HIGHLIGHTS = [
  {
    icon: SearchCheck,
    title: "Local search & discovery",
    description: "Find nearby businesses by category, city, or live location, and compare verified ratings before you reach out.",
  },
  {
    icon: Briefcase,
    title: "B2B directory",
    description: "Browse verified suppliers and wholesalers directly — the same search and listing pages, filtered to businesses that serve other businesses.",
  },
  {
    icon: CalendarCheck2,
    title: "Bookings & appointments",
    description: "Check real-time availability and book services directly with local businesses, no phone tag required.",
  },
  {
    icon: ShieldCheck,
    title: "Verified reviews & ratings",
    description: "Every review comes from a real customer, so you can trust what you're reading before you decide.",
  },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 shrink-0">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
        <Building2 size={20} strokeWidth={2.25} />
      </span>
      <span className="text-xl font-extrabold tracking-tight text-ink-900">
        Mark<span className="text-brand-600">kito</span>
      </span>
    </Link>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { to: "/", label: "Search" },
    { to: "/b2b", label: "B2B Directory" },
    { to: "/classifieds", label: "Buy & Sell" },
    ...(user ? [{ to: "/my-listings", label: "My Listings" }, { to: "/favorites", label: "Favorites" }] : []),
    ...(user?.role === "BUSINESS_OWNER" || user?.role === "DEALER" ? [{ to: "/dashboard", label: "My Business" }] : []),
    ...(user?.role === "ADMIN" ? [{ to: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Logo />

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="px-3 py-2 rounded-md text-sm font-medium text-ink-700 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-sm text-ink-700">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                    <User size={14} />
                  </span>
                  {user.firstName}
                </span>
                <button
                  onClick={() => {
                    clearAuth();
                    navigate("/");
                  }}
                  className="btn-ghost text-sm px-2.5 py-1.5"
                >
                  <LogOut size={15} />
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-ghost text-sm px-3 py-1.5">
                  <LogIn size={15} /> Log in
                </Link>
                <Link to="/register" className="btn-primary text-sm px-4 py-1.5">
                  <UserPlus size={15} /> Sign up
                </Link>
              </div>
            )}
          </div>

          <button
            className="md:hidden p-2 -mr-2 text-ink-700"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="container-page py-3 flex flex-col gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 rounded-md text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-600"
                >
                  {l.label}
                </Link>
              ))}
              <div className="h-px bg-gray-200 my-1" />
              {user ? (
                <button
                  onClick={() => {
                    clearAuth();
                    setMenuOpen(false);
                    navigate("/");
                  }}
                  className="px-3 py-2.5 rounded-md text-sm font-medium text-left text-ink-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <LogOut size={15} /> Log out
                </button>
              ) : (
                <div className="flex gap-2 px-3 pt-1">
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-secondary flex-1 py-2.5 text-sm">
                    <LogIn size={15} /> Log in
                  </Link>
                  <Link to="/register" onClick={() => setMenuOpen(false)} className="btn-primary flex-1 py-2.5 text-sm">
                    <UserPlus size={15} /> Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 container-page py-6 sm:py-8">{children}</main>

      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="container-page py-4 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-ink-900">Follow us on</span>
            <div className="flex items-center gap-2">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  title={s.label}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-white hover:opacity-90 transition-opacity ${s.className}`}
                >
                  <s.icon size={15} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="container-page py-10">
          <h2 className="text-xl font-bold text-ink-900 mb-4">
            Your one-stop platform for local businesses, services &amp; stores
          </h2>
          <div className="space-y-3 text-sm text-ink-600 leading-relaxed max-w-4xl">
            <p>
              Markkito helps you discover, compare, and connect with local businesses in your area — from
              restaurants and home services to healthcare, wellness, and professional suppliers. Search by
              category or location, check verified ratings and reviews, and reach out directly for quotes,
              bookings, or more information.
            </p>
            <p>
              We list businesses across categories including restaurants, home services, healthcare, beauty
              and wellness, events, and B2B suppliers, with more added as our community of business owners
              grows across cities and towns.
            </p>
            <p>
              List your business for free to start receiving leads, manage bookings and appointments in real
              time, and grow with genuine customer reviews. Sourcing at scale? Browse our B2B directory to find
              and contact verified suppliers and wholesalers directly.
            </p>
          </div>

          <h3 className="text-base font-bold text-ink-900 mt-8 mb-5">
            Some of our services that will prove useful to you
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICE_HIGHLIGHTS.map((s) => (
              <div key={s.title}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <s.icon size={16} />
                  </span>
                  <h4 className="font-semibold text-ink-900 text-sm">{s.title}</h4>
                </div>
                <p className="text-xs text-ink-500 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="container-page py-10 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
                <Building2 size={16} />
              </span>
              <span className="font-bold text-ink-900">Markkito</span>
            </div>
            <p className="text-ink-500 text-xs leading-relaxed">
              Find, book, and review local businesses — B2C and B2B, in one directory.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-ink-900 mb-3 flex items-center gap-1.5">
              <Store size={14} /> For customers
            </h4>
            <ul className="space-y-2 text-ink-500">
              <li><Link to="/" className="hover:text-brand-600">Search businesses</Link></li>
              <li><Link to="/b2b" className="hover:text-brand-600">Browse B2B suppliers</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-ink-900 mb-3 flex items-center gap-1.5">
              <LayoutDashboard size={14} /> For businesses
            </h4>
            <ul className="space-y-2 text-ink-500">
              <li><Link to="/dashboard" className="hover:text-brand-600">Owner dashboard</Link></li>
              <li><Link to="/register" className="hover:text-brand-600">List your business</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-ink-900 mb-3 flex items-center gap-1.5">
              <Shield size={14} /> Platform
            </h4>
            <ul className="space-y-2 text-ink-500">
              <li><Link to="/admin" className="hover:text-brand-600">Admin console</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-100 py-4 text-center text-xs text-ink-500">
          Markkito — Local Business Directory &amp; Marketplace
        </div>
      </footer>
    </div>
  );
}
