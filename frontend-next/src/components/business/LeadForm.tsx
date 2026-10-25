"use client";

import { useState } from "react";

// Posts through the "/api/..." rewrite proxy (see next.config.ts) so this
// stays same-origin from the browser's point of view — no CORS needed even
// though the real Laravel API lives on a different host in production.
// Public/optional-auth endpoint: an anonymous visitor from Google can send
// an enquiry without signing in.
export default function LeadForm({ businessId }: { businessId: string }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch(`/api/v1/businesses/${businessId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "BUSINESS_PROFILE" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not send your enquiry.");
      }
      setStatus("sent");
      setForm({ name: "", phone: "", email: "", message: "" });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not send your enquiry.");
    }
  }

  if (status === "sent") {
    return (
      <div className="card p-5">
        <h3 className="font-bold text-ink-900">Send an enquiry</h3>
        <p className="mt-2 text-sm text-brand-700 bg-brand-50 rounded-md px-3 py-2">Thanks! The business will contact you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-3">
      <h3 className="font-bold text-ink-900">Send an enquiry</h3>
      <p className="text-xs text-ink-500 -mt-2">The business will contact you directly.</p>
      <input
        required
        placeholder="Your name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="input"
      />
      <input
        required
        placeholder="Phone number"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        className="input"
      />
      <input
        placeholder="Email (optional)"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="input"
      />
      <textarea
        placeholder="Message"
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        className="input min-h-20"
      />
      {status === "error" && <p className="text-xs text-red-600">{error}</p>}
      <button disabled={status === "sending"} className="btn-primary w-full py-2.5">
        {status === "sending" ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}
