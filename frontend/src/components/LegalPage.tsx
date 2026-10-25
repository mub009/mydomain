import { Link } from "react-router-dom";

// Every field that needs a real, entity-specific value (legal name, GSTIN,
// registered address, grievance officer contact, effective date) renders
// through this instead of being silently baked into the prose, so it's
// impossible to publish this content without noticing what's still a
// placeholder.
export function Ph({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[13px] font-semibold text-amber-800">
      {children}
    </mark>
  );
}

const LEGAL_LINKS = [
  { to: "/terms", label: "Terms of Use" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/refund-policy", label: "Refund & Cancellation" },
  { to: "/shipping-policy", label: "Shipping & Delivery" },
  { to: "/grievance", label: "Grievance Redressal" },
  { to: "/about", label: "About Us" },
];

export default function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold text-ink-900">{title}</h1>
        <p className="mt-1 text-xs text-ink-500">Effective date: {effectiveDate}</p>
        <div className="legal-content mt-6">{children}</div>
      </div>

      <div className="card mt-4 p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">More policies</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="text-sm font-medium text-brand-600 hover:underline">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
