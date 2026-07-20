import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Building2, LayoutDashboard, LogOut, Menu, Shield, Store, User, X } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 shrink-0">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
        <Building2 size={20} strokeWidth={2.25} />
      </span>
      <span className="text-xl font-extrabold tracking-tight text-ink-900">
        My<span className="text-brand-600">Domain</span>
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
    { to: "/b2b", label: "B2B Marketplace" },
    ...(user?.role === "BUSINESS_OWNER" ? [{ to: "/dashboard", label: "My Business" }] : []),
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
                  Log in
                </Link>
                <Link to="/register" className="btn-primary text-sm px-4 py-1.5">
                  Sign up
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
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-secondary text-sm flex-1">
                    Log in
                  </Link>
                  <Link to="/register" onClick={() => setMenuOpen(false)} className="btn-primary text-sm flex-1">
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 container-page py-6 sm:py-8">{children}</main>

      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="container-page py-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
                <Building2 size={16} />
              </span>
              <span className="font-bold text-ink-900">MyDomain</span>
            </div>
            <p className="text-ink-500 text-xs leading-relaxed">
              Find, book, and review local businesses — plus a B2B marketplace for bulk sourcing.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-ink-900 mb-3 flex items-center gap-1.5">
              <Store size={14} /> For customers
            </h4>
            <ul className="space-y-2 text-ink-500">
              <li><Link to="/" className="hover:text-brand-600">Search businesses</Link></li>
              <li><Link to="/b2b" className="hover:text-brand-600">Post an RFQ</Link></li>
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
          MyDomain — Local Business Directory &amp; Marketplace
        </div>
      </footer>
    </div>
  );
}
