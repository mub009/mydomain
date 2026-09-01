"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, LogIn, Menu, UserPlus, X } from "lucide-react";

// Where login, dashboards, classifieds, messaging, and admin still live —
// none of that is SEO-relevant, so it isn't part of this Next.js app. This
// header can't know if a visitor is signed in (that session lives on the
// other origin), so it always shows the logged-out state; anyone already
// signed in there stays signed in once they click through.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

const NAV_LINKS = [
  { href: "/", label: "Search" },
  { href: "/search?businessType=B2B", label: "B2B Directory" },
  { href: `${APP_URL}/classifieds`, label: "Buy & Sell" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
            <Building2 size={20} strokeWidth={2.25} />
          </span>
          <span className="text-xl font-extrabold tracking-tight text-ink-900">
            Mark<span className="text-brand-600">kito</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="px-3 py-2 rounded-md text-sm font-medium text-ink-700 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <a href={`${APP_URL}/login`} className="btn-ghost text-sm px-3 py-1.5">
            <LogIn size={15} /> Log in
          </a>
          <a href={`${APP_URL}/register`} className="btn-primary text-sm px-4 py-1.5">
            <UserPlus size={15} /> Sign up
          </a>
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
            {NAV_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 rounded-md text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-600"
              >
                {l.label}
              </Link>
            ))}
            <div className="h-px bg-gray-200 my-1" />
            <div className="flex gap-2 px-3 pt-1">
              <a href={`${APP_URL}/login`} className="btn-secondary flex-1 py-2.5 text-sm">
                <LogIn size={15} /> Log in
              </a>
              <a href={`${APP_URL}/register`} className="btn-primary flex-1 py-2.5 text-sm">
                <UserPlus size={15} /> Sign up
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
