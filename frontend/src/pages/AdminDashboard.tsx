import { useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  Calendar,
  Check,
  MessageSquare,
  ShieldCheck,
  Star,
  Users,
  X,
} from "lucide-react";
import { adminApi } from "@/api/endpoints";
import { Business } from "@/types";

const STAT_ICON: Record<string, typeof Users> = {
  userCount: Users,
  businessCount: Building2,
  publishedBusinessCount: ShieldCheck,
  reviewCount: Star,
  leadCount: MessageSquare,
  bookingCount: Calendar,
  openRfqCount: Briefcase,
};

const STAT_LABEL: Record<string, string> = {
  userCount: "Users",
  businessCount: "Businesses",
  publishedBusinessCount: "Published",
  reviewCount: "Reviews",
  leadCount: "Leads",
  bookingCount: "Bookings",
  openRfqCount: "Open RFQs",
};

export default function AdminDashboard() {
  const [pending, setPending] = useState<Business[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});

  function load() {
    adminApi.pendingBusinesses().then((r) => setPending(r.data));
    adminApi.stats().then(setStats);
  }

  useEffect(load, []);

  async function approve(id: string) {
    await adminApi.approve(id);
    load();
  }

  async function reject(id: string) {
    await adminApi.reject(id);
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-ink-900 mb-1">Admin console</h1>
      <p className="text-sm text-ink-500 mb-6">Platform overview and moderation queue.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {Object.entries(stats).map(([key, value]) => {
          const Icon = STAT_ICON[key] ?? Building2;
          return (
            <div key={key} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon size={16} />
                </span>
              </div>
              <p className="text-2xl font-extrabold text-ink-900">{value}</p>
              <p className="text-xs text-ink-500">{STAT_LABEL[key] ?? key}</p>
            </div>
          );
        })}
      </div>

      <h2 className="text-lg font-bold text-ink-900 mb-3">Pending business approvals</h2>
      <div className="space-y-2">
        {pending.map((b) => (
          <div key={b.id} className="card p-3.5 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-ink-900">{b.name}</p>
              <p className="text-sm text-ink-500">
                {b.city}, {b.state}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => approve(b.id)} className="btn-primary text-sm px-3 py-1.5">
                <Check size={14} /> Approve
              </button>
              <button onClick={() => reject(b.id)} className="btn-secondary text-sm px-3 py-1.5">
                <X size={14} /> Reject
              </button>
            </div>
          </div>
        ))}
        {pending.length === 0 && (
          <div className="card p-8 text-center text-sm text-ink-500">Nothing pending review.</div>
        )}
      </div>
    </div>
  );
}
