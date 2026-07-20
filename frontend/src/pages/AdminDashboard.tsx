import { useEffect, useState } from "react";
import { adminApi } from "@/api/endpoints";
import { Business } from "@/types";

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
      <h1 className="text-2xl font-bold mb-4">Admin</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="border rounded-md p-3 bg-white text-center">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-semibold mb-3">Pending business approvals</h2>
      <div className="space-y-2">
        {pending.map((b) => (
          <div key={b.id} className="border rounded-md p-3 bg-white flex justify-between items-center">
            <div>
              <p className="font-medium">{b.name}</p>
              <p className="text-sm text-gray-500">
                {b.city}, {b.state}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => approve(b.id)} className="text-sm bg-brand-600 text-white rounded-md px-3 py-1.5">
                Approve
              </button>
              <button onClick={() => reject(b.id)} className="text-sm bg-gray-200 rounded-md px-3 py-1.5">
                Reject
              </button>
            </div>
          </div>
        ))}
        {pending.length === 0 && <p className="text-sm text-gray-500">Nothing pending review.</p>}
      </div>
    </div>
  );
}
