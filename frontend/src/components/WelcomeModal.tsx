import { useEffect, useState } from "react";
import { visitorsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { useLocationStore } from "@/store/locationStore";

const STORAGE_KEY = "markkito-visitor";
const DISMISS_KEY = "markkito-visitor-dismissed";

interface StoredVisitor {
  id: string;
  phone: string;
}

export function getStoredVisitor(): StoredVisitor | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredVisitor) : null;
  } catch {
    return null;
  }
}

// Ask the browser for coordinates. Resolves to null if the visitor declines
// or the device can't provide a fix — we never block on it.
function requestPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 300000 },
    );
  });
}

// One-time welcome popup that captures a visitor's mobile number (with
// explicit consent) and, if they allow it, their location. Once submitted or
// dismissed it never asks again on this device.
export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const setGeo = useLocationStore((s) => s.setGeo);

  useEffect(() => {
    // Already captured, or explicitly dismissed — stay out of the way.
    if (getStoredVisitor() || localStorage.getItem(DISMISS_KEY)) return;
    const timer = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Close on Escape, same as dismissing.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    if (!agreed) {
      setError("Please accept the terms to continue");
      return;
    }

    setSaving(true);
    setError("");
    try {
      // Ask for location first so it can be saved with the number in one go.
      // The browser shows its own permission prompt; declining is fine.
      const position = await requestPosition();
      const visitor = await visitorsApi.capture({
        phone: digits,
        consent: true,
        latitude: position?.lat,
        longitude: position?.lng,
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: visitor.id, phone: visitor.phone }));
      if (position) setGeo(position); // personalise results straight away
      setOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl">
        {/* Brand + welcome */}
        <div className="flex items-center gap-4">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-brand-600">Mark</span>
            <span className="text-gold-500">kito</span>
          </span>
          <span className="h-10 w-px bg-gray-200" />
          <div>
            <h2 id="welcome-title" className="text-lg font-bold text-ink-900">
              Welcome
            </h2>
            <p className="text-sm text-ink-600">Enter your number for a seamless experience</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex items-stretch overflow-hidden rounded-xl border border-gray-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
            <span className="flex items-center border-r border-gray-200 px-4 text-base font-medium text-ink-600">
              +91
            </span>
            <input
              autoFocus
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter Mobile Number"
              aria-label="Mobile number"
              className="w-full px-4 py-3.5 text-base focus:outline-none"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I agree to the Terms and Conditions, and to sharing my number and location so nearby businesses can be
              shown and can contact me.
            </span>
          </label>

          <p className="text-center">
            <a href="/terms" className="text-xs text-ink-500 underline hover:text-brand-600">
              T&amp;C's Privacy Policy
            </a>
          </p>

          <button
            disabled={saving || !agreed}
            className="w-full rounded-xl bg-brand-600 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Please wait…" : "Continue"}
          </button>

          <button type="button" onClick={dismiss} className="w-full text-sm text-ink-500 hover:text-ink-800">
            Maybe Later
          </button>
        </form>
      </div>
    </div>
  );
}
