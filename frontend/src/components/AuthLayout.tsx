import { Link } from "react-router-dom";
import { Building2, CalendarCheck2, SearchCheck, ShieldCheck, Star } from "lucide-react";

const HIGHLIGHTS = [
  { icon: SearchCheck, text: "Search thousands of trusted local businesses" },
  { icon: CalendarCheck2, text: "Book services and appointments in real time" },
  { icon: ShieldCheck, text: "Read verified reviews before you decide" },
];

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 rounded-2xl overflow-hidden shadow-card border border-gray-200 bg-white">
        {/* Brand panel */}
        <div className="relative hidden lg:flex flex-col justify-between p-8 bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 text-white overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none [background-image:radial-gradient(circle_at_20%_20%,white,transparent_35%),radial-gradient(circle_at_80%_75%,white,transparent_30%)]" />

          <Link to="/" className="relative flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
              <Building2 size={20} strokeWidth={2.25} />
            </span>
            <span className="text-xl font-extrabold tracking-tight">Markkito</span>
          </Link>

          <div className="relative">
            <h2 className="text-2xl font-extrabold leading-snug">
              Everything local, in one place.
            </h2>
            <ul className="mt-6 space-y-3">
              {HIGHLIGHTS.map((h) => (
                <li key={h.text} className="flex items-start gap-3 text-sm text-brand-50/95">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
                    <h.icon size={15} />
                  </span>
                  <span className="pt-1">{h.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative rounded-xl bg-white/10 backdrop-blur-sm p-4">
            <div className="flex items-center gap-0.5 text-gold-400 mb-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} fill="currentColor" strokeWidth={0} />
              ))}
            </div>
            <p className="text-sm text-brand-50/95 leading-relaxed">
              “Found and booked a great electrician in minutes. So much easier than searching around.”
            </p>
            <p className="text-xs text-brand-100/80 mt-2">— A happy Markkito customer</p>
          </div>
        </div>

        {/* Form panel */}
        <div className="p-6 sm:p-8 flex flex-col justify-center">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Building2 size={20} strokeWidth={2.25} />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-ink-900">
              Mark<span className="text-brand-600">kito</span>
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-ink-900">{title}</h1>
          <p className="text-sm text-ink-500 mt-1 mb-6">{subtitle}</p>

          {children}

          <div className="mt-5 text-sm text-ink-500 text-center">{footer}</div>
        </div>
      </div>
    </div>
  );
}
