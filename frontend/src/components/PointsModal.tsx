import { useEffect, useState } from "react";
import { Coins, Minus, Plus } from "lucide-react";
import Modal from "@/components/Modal";
import { adminApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { AdminUser, PointTransaction } from "@/types";

const QUICK_AMOUNTS = [5, 10, 25, 50];

function typeLabel(type: PointTransaction["type"]): { label: string; tint: string } {
  const map: Record<PointTransaction["type"], { label: string; tint: string }> = {
    ADMIN_GRANT: { label: "Granted", tint: "bg-emerald-50 text-emerald-700" },
    ADMIN_DEDUCTION: { label: "Deducted", tint: "bg-red-50 text-red-700" },
    BUSINESS_CREATED: { label: "Business registered", tint: "bg-brand-50 text-brand-700" },
  };
  return map[type];
}

// Admin tops up (or deducts) a dealer's registration points and reviews the
// ledger of past movements.
export default function PointsModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: (points: number) => void;
}) {
  const [balance, setBalance] = useState(user.points ?? 0);
  const [amount, setAmount] = useState("10");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"grant" | "deduct">("grant");
  const [history, setHistory] = useState<PointTransaction[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function loadHistory() {
    adminApi
      .pointTransactions(user.id, { pageSize: 8 })
      .then((r) => setHistory(r.data))
      .catch(() => undefined);
  }

  useEffect(loadHistory, [user.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a number greater than zero");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await adminApi.adjustPoints(user.id, mode === "grant" ? value : -value, note || undefined);
      const next = updated.points ?? 0;
      setBalance(next);
      setNote("");
      onSaved(next);
      loadHistory();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Points — ${user.firstName} ${user.lastName}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-4 text-white">
          <p className="text-white/80 text-xs flex items-center gap-1.5">
            <Coins size={14} /> Current balance
          </p>
          <p className="text-3xl font-extrabold mt-0.5">{balance}</p>
          <p className="text-white/80 text-xs mt-1">
            Can register {balance} more {balance === 1 ? "business" : "businesses"} (1 point each).
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("grant")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                mode === "grant" ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-300 text-ink-600 hover:bg-gray-50"
              }`}
            >
              <Plus size={14} className="inline -mt-0.5 mr-1" /> Add points
            </button>
            <button
              type="button"
              onClick={() => setMode("deduct")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                mode === "deduct" ? "bg-red-600 text-white border-red-600" : "border-gray-300 text-ink-600 hover:bg-gray-50"
              }`}
            >
              <Minus size={14} className="inline -mt-0.5 mr-1" /> Deduct
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">Amount</label>
            <input
              required
              type="number"
              min="1"
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className="badge bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700"
                >
                  {mode === "grant" ? "+" : "−"}
                  {q}
                </button>
              ))}
            </div>
          </div>

          <input
            className="input"
            placeholder="Note (optional, e.g. payment received)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <button disabled={saving} className="btn-primary w-full py-2.5">
            {saving ? "Saving…" : mode === "grant" ? `Add ${amount || 0} points` : `Deduct ${amount || 0} points`}
          </button>
        </form>

        {history.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">Recent activity</p>
            <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
              {history.map((t) => {
                const meta = typeLabel(t.type);
                return (
                  <div key={t.id} className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className={`badge ${meta.tint}`}>{meta.label}</span>
                      {t.note && <p className="text-xs text-ink-500 truncate mt-1">{t.note}</p>}
                      <p className="text-[11px] text-ink-400">{new Date(t.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-sm ${t.amount > 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {t.amount > 0 ? `+${t.amount}` : t.amount}
                      </p>
                      <p className="text-[11px] text-ink-400">bal {t.balanceAfter}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
