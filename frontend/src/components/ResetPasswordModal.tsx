import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import Modal from "@/components/Modal";
import { usersApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";

// A readable, reasonably strong default password that can be handed over.
export function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  let out = pick(upper) + pick(lower) + pick(digits);
  for (let i = 0; i < 7; i++) out += pick(all);
  return out
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  }
  return (
    <div>
      <label className="block text-[11px] font-medium text-emerald-700/80 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-mono text-ink-900">
          {value}
        </code>
        <button type="button" onClick={copy} className="btn-secondary px-3 py-2 text-sm whitespace-nowrap">
          {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

interface TargetUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

// Reset a user's password on their behalf (admin: anyone; dealer: accounts
// they created). Shows the new login to hand over after a successful reset.
export default function ResetPasswordModal({ user, onClose }: { user: TargetUser; onClose: () => void }) {
  const [password, setPassword] = useState(generatePassword());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await usersApi.resetPassword(user.id, password);
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Reset password — ${user.firstName} ${user.lastName}`} onClose={onClose}>
      {done ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2">
            Password reset. Their old sessions are signed out — share the new login below. The password won't be shown
            again.
          </p>
          <CopyField label="Username (email)" value={user.email} />
          <CopyField label="New password" value={password} />
          <button onClick={onClose} className="btn-primary w-full py-2.5">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{error}</p>}
          <p className="text-sm text-ink-600">
            Set a new login password for <span className="font-semibold text-ink-900">{user.email}</span>. Their current
            password stops working immediately.
          </p>
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">New password (min 8 chars)</label>
            <div className="flex gap-2">
              <input
                required
                minLength={8}
                type="text"
                className="input font-mono"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                className="btn-secondary px-3 py-2 text-sm whitespace-nowrap"
              >
                <RefreshCw size={14} /> Generate
              </button>
            </div>
          </div>
          <button disabled={saving} className="btn-primary w-full py-2.5">
            {saving ? "Resetting…" : "Reset password"}
          </button>
        </form>
      )}
    </Modal>
  );
}
