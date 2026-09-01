import Link from "next/link";
import { Briefcase, Building2, CalendarCheck2, Facebook, FileText, Instagram, LayoutDashboard, Linkedin, SearchCheck, Shield, ShieldCheck, Store, Twitter, Youtube } from "lucide-react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

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

export default function Footer() {
  return (
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
        <h2 className="text-xl font-bold text-ink-900 mb-4">Your one-stop platform for local businesses, services &amp; stores</h2>
        <div className="space-y-3 text-sm text-ink-600 leading-relaxed max-w-4xl">
          <p>
            Markkito helps you discover, compare, and connect with local businesses in your area — from restaurants
            and home services to healthcare, wellness, and professional suppliers. Search by category or location,
            check verified ratings and reviews, and reach out directly for quotes, bookings, or more information.
          </p>
          <p>
            We list businesses across categories including restaurants, home services, healthcare, beauty and
            wellness, events, and B2B suppliers, with more added as our community of business owners grows across
            cities and towns.
          </p>
          <p>
            List your business for free to start receiving leads, manage bookings and appointments in real time, and
            grow with genuine customer reviews. Sourcing at scale? Browse our B2B directory to find and contact
            verified suppliers and wholesalers directly.
          </p>
        </div>

        <h3 className="text-base font-bold text-ink-900 mt-8 mb-5">Some of our services that will prove useful to you</h3>
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

      <div className="container-page py-10 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 text-sm">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
              <Building2 size={16} />
            </span>
            <span className="font-bold text-ink-900">Markkito</span>
          </div>
          <p className="text-ink-500 text-xs leading-relaxed">Find, book, and review local businesses — B2C and B2B, in one directory.</p>
        </div>
        <div>
          <h4 className="font-semibold text-ink-900 mb-3 flex items-center gap-1.5">
            <Store size={14} /> For customers
          </h4>
          <ul className="space-y-2 text-ink-500">
            <li><Link href="/" className="hover:text-brand-600">Search businesses</Link></li>
            <li><Link href="/search?businessType=B2B" className="hover:text-brand-600">Browse B2B suppliers</Link></li>
            <li><a href={`${APP_URL}/classifieds`} className="hover:text-brand-600">Buy &amp; sell</a></li>
            <li><a href={`${APP_URL}/favorites`} className="hover:text-brand-600">Saved items</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-ink-900 mb-3 flex items-center gap-1.5">
            <LayoutDashboard size={14} /> For businesses
          </h4>
          <ul className="space-y-2 text-ink-500">
            <li><a href={`${APP_URL}/dashboard`} className="hover:text-brand-600">Owner dashboard</a></li>
            <li><a href={`${APP_URL}/register`} className="hover:text-brand-600">List your business</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-ink-900 mb-3 flex items-center gap-1.5">
            <Shield size={14} /> Platform
          </h4>
          <ul className="space-y-2 text-ink-500">
            <li><Link href="/about" className="hover:text-brand-600">About us</Link></li>
            <li><a href={`${APP_URL}/admin`} className="hover:text-brand-600">Admin console</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-ink-900 mb-3 flex items-center gap-1.5">
            <FileText size={14} /> Legal
          </h4>
          <ul className="space-y-2 text-ink-500">
            <li><Link href="/terms" className="hover:text-brand-600">Terms of Use</Link></li>
            <li><Link href="/privacy" className="hover:text-brand-600">Privacy Policy</Link></li>
            <li><Link href="/refund-policy" className="hover:text-brand-600">Refund &amp; Cancellation</Link></li>
            <li><Link href="/shipping-policy" className="hover:text-brand-600">Shipping &amp; Delivery</Link></li>
            <li><Link href="/grievance" className="hover:text-brand-600">Grievance Redressal</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-100 py-4 text-center text-xs text-ink-500">Markkito — Local Business Directory &amp; Marketplace</div>
    </footer>
  );
}
