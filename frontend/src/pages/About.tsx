import { Link } from "react-router-dom";
import { Award, Briefcase, Building2, Heart, Mail, MapPin, Phone, Rocket, Search, ShoppingBag, Target, Users } from "lucide-react";
import { Ph } from "@/components/LegalPage";

const VALUES = [
  { icon: Target, title: "Local first", body: "Every feature is built around helping people find and be found nearby — not a generic global listing." },
  { icon: ShoppingBag, title: "Simple to use", body: "Posting a business, booking a service, or listing an item to sell should take minutes, not a manual." },
  { icon: Heart, title: "Trust between people", body: "Verified listings, genuine reviews, and direct contact — no black box between a customer and a business." },
];

const TEAM = [
  { role: "Founder & CEO", name: "[Name]" },
  { role: "Co-Founder & CTO", name: "[Name]" },
  { role: "Head of Operations", name: "[Name]" },
  { role: "Head of Business Growth", name: "[Name]" },
];

export default function About() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl bg-gradient-to-r from-ink-900 to-brand-800 px-6 py-8 sm:px-10 sm:py-10">
        <h1 className="text-2xl font-extrabold text-white sm:text-3xl">About Markkito</h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">
          Markkito is a local business directory and marketplace — helping people in India discover trusted
          businesses, book services, shop from local storefronts, and buy and sell new or used items nearby.
        </p>
      </div>

      <div className="card mt-6 p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900">
          <Rocket size={18} className="text-brand-600" /> Our mission
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          We started Markkito to make it as easy to find a trusted plumber, restaurant, or supplier down the road
          as it is to search the entire internet for one on the other side of the world. Local commerce in India
          runs on word of mouth and WhatsApp forwards — Markkito puts that same trust online, with verified
          listings, real reviews, and a direct line between a business and its customers.
        </p>
      </div>

      <div className="card mt-4 p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900">
          <Search size={18} className="text-brand-600" /> What we offer
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Building2 size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Business directory</p>
              <p className="text-xs text-ink-500">Search, compare, and contact local businesses across categories and cities.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Briefcase size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">B2B directory</p>
              <p className="text-xs text-ink-500">The same directory, filtered to suppliers and wholesalers serving other businesses.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <ShoppingBag size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Classifieds marketplace</p>
              <p className="text-xs text-ink-500">Buy and sell new or used items locally — mobiles, vehicles, furniture, and more.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Award size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Bookings, storefronts &amp; reviews</p>
              <p className="text-xs text-ink-500">A business can take bookings, sell products, and build trust with genuine reviews.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-4 p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900">
          <Target size={18} className="text-brand-600" /> What we believe in
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title}>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <v.icon size={16} />
              </span>
              <p className="mt-2 text-sm font-semibold text-ink-900">{v.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{v.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-4 p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900">
          <Users size={18} className="text-brand-600" /> Our team
        </h2>
        <p className="mt-1 text-xs text-ink-500">Placeholder entries — replace with your real team before publishing.</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {TEAM.map((m) => (
            <div key={m.role} className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-ink-400">
                <Users size={22} />
              </div>
              <p className="mt-2 text-sm font-semibold text-ink-900">
                <Ph>{m.name}</Ph>
              </p>
              <p className="text-xs text-ink-500">{m.role}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-4 p-6 sm:p-8">
        <h2 className="text-lg font-bold text-ink-900">Get in touch</h2>
        <div className="mt-3 space-y-2 text-sm text-ink-700">
          <p className="flex items-center gap-2">
            <Mail size={14} className="text-ink-400" />
            <Ph>[support email]</Ph>
          </p>
          <p className="flex items-center gap-2">
            <Phone size={14} className="text-ink-400" />
            <Ph>[support phone]</Ph>
          </p>
          <p className="flex items-center gap-2">
            <MapPin size={14} className="text-ink-400" />
            <Ph>[Registered/head office address]</Ph>
          </p>
        </div>
        <p className="mt-4 text-xs text-ink-500">
          See also our <Link to="/terms" className="text-brand-600 hover:underline">Terms of Use</Link>,{" "}
          <Link to="/privacy" className="text-brand-600 hover:underline">Privacy Policy</Link>, and{" "}
          <Link to="/grievance" className="text-brand-600 hover:underline">Grievance Redressal</Link> pages.
        </p>
      </div>
    </div>
  );
}
