import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Download, Facebook, Instagram, Link2, Printer, QrCode, Star } from "lucide-react";
import { businessesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, ReviewChannel, ReviewLinks } from "@/types";
import { Spinner } from "@/components/Loading";

const CHANNELS: { value: ReviewChannel; label: string; icon: typeof Star; tint: string }[] = [
  { value: "GOOGLE", label: "Google", icon: Star, tint: "text-amber-600" },
  { value: "INSTAGRAM", label: "Instagram", icon: Instagram, tint: "text-pink-600" },
  { value: "FACEBOOK", label: "Facebook", icon: Facebook, tint: "text-blue-600" },
];

// The printed board points here; the server resolves the right platform and
// records the scan before redirecting the customer's phone.
function scanUrl(slug: string, channel?: ReviewChannel): string {
  const base = `${window.location.origin}/r/${slug}`;
  return channel ? `${base}?c=${channel.toLowerCase()}` : base;
}

export default function ReviewQrBoard({ business }: { business: Business }) {
  const [links, setLinks] = useState<ReviewLinks | null>(null);
  const [form, setForm] = useState({
    googlePlaceId: "",
    googleReviewUrl: "",
    instagramUsername: "",
    facebookPageUrl: "",
    preferredReviewChannel: "" as ReviewChannel | "",
  });
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrChannel, setQrChannel] = useState<ReviewChannel | "">("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  function hydrate(data: ReviewLinks) {
    setLinks(data);
    setForm({
      googlePlaceId: data.googlePlaceId ?? "",
      googleReviewUrl: data.googleReviewUrl ?? "",
      instagramUsername: data.instagramUsername ?? "",
      facebookPageUrl: data.facebookPageUrl ?? "",
      preferredReviewChannel: data.preferredReviewChannel ?? "",
    });
  }

  useEffect(() => {
    setLoading(true);
    businessesApi
      .reviewLinks(business.id)
      .then(hydrate)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [business.id]);

  const target = useMemo(
    () => scanUrl(business.slug, qrChannel || undefined),
    [business.slug, qrChannel],
  );

  // Regenerate the QR whenever the target changes. High error correction so
  // the code still scans if the printed board gets scuffed.
  useEffect(() => {
    QRCode.toDataURL(target, { errorCorrectionLevel: "H", margin: 1, width: 512, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [target]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await businessesApi.updateReviewLinks(business.id, {
        googlePlaceId: form.googlePlaceId,
        googleReviewUrl: form.googleReviewUrl,
        instagramUsername: form.instagramUsername,
        facebookPageUrl: form.facebookPageUrl,
        preferredReviewChannel: form.preferredReviewChannel || null,
      });
      hydrate(updated);
      setNotice("Review links saved. Your QR board is ready to print.");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function downloadQr() {
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${business.slug}-review-qr.png`;
    link.click();
  }

  if (loading) return <Spinner label="Loading review settings…" />;

  const configured = links ? CHANNELS.filter((c) => links.resolved[c.value]) : [];

  return (
    <div className="space-y-6">
      {notice && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Platform IDs */}
        <form onSubmit={save} className="card space-y-3 p-5">
          <div>
            <h3 className="flex items-center gap-1.5 font-bold text-ink-900">
              <Link2 size={16} className="text-brand-600" /> Connect your review pages
            </h3>
            <p className="mt-0.5 text-xs text-ink-500">
              Customers who scan your QR board land straight on the page you choose.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">Google Place ID</label>
            <input
              className="input"
              placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
              value={form.googlePlaceId}
              onChange={(e) => setForm({ ...form, googlePlaceId: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-ink-400">
              Find it at{" "}
              <a
                href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline"
              >
                Google's Place ID finder
              </a>
              . We build the “write a review” link from it.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">Google review link (optional override)</label>
            <input
              className="input"
              placeholder="https://g.page/r/…/review"
              value={form.googleReviewUrl}
              onChange={(e) => setForm({ ...form, googleReviewUrl: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">Instagram username</label>
            <input
              className="input"
              placeholder="@yourshop"
              value={form.instagramUsername}
              onChange={(e) => setForm({ ...form, instagramUsername: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">Facebook page</label>
            <input
              className="input"
              placeholder="yourshop or https://facebook.com/yourshop"
              value={form.facebookPageUrl}
              onChange={(e) => setForm({ ...form, facebookPageUrl: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">Default channel for the QR board</label>
            <select
              className="input"
              value={form.preferredReviewChannel}
              onChange={(e) => setForm({ ...form, preferredReviewChannel: e.target.value as ReviewChannel | "" })}
            >
              <option value="">First configured platform</option>
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <button disabled={saving} className="btn-primary w-full py-2.5">
            {saving ? "Saving…" : "Save review links"}
          </button>
        </form>

        {/* QR board preview */}
        <div className="space-y-3">
          <div className="card p-5">
            <h3 className="flex items-center gap-1.5 font-bold text-ink-900">
              <QrCode size={16} className="text-brand-600" /> Your QR board
            </h3>
            <p className="mt-0.5 text-xs text-ink-500">
              Print this and place it at your counter. Scanning opens the review page automatically.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setQrChannel("")}
                className={`badge ${qrChannel === "" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"}`}
              >
                Default
              </button>
              {configured.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setQrChannel(c.value)}
                  className={`badge ${qrChannel === c.value ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* The printable board */}
            <div id="qr-board" className="mt-4 rounded-xl border-2 border-dashed border-gray-200 bg-white p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
              <h4 className="mt-1 text-xl font-extrabold text-ink-900">{business.name}</h4>
              <p className="mt-0.5 text-sm text-ink-500">Scan to leave us a review</p>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Review QR code" className="mx-auto mt-3 h-48 w-48" />
              ) : (
                <div className="mx-auto mt-3 flex h-48 w-48 items-center justify-center rounded bg-gray-100 text-gray-400">
                  <QrCode size={40} />
                </div>
              )}
              <p className="mt-2 text-xs text-ink-400">Point your camera at the code</p>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Powered by Markkito</p>
            </div>

            <p className="mt-2 break-all text-[11px] text-ink-400">{target}</p>

            <div className="mt-3 flex gap-2">
              <button type="button" onClick={downloadQr} disabled={!qrDataUrl} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
                <Download size={15} /> Download PNG
              </button>
              <button type="button" onClick={() => window.print()} className="btn-secondary flex-1 py-2.5">
                <Printer size={15} /> Print
              </button>
            </div>
          </div>

          {/* Scan analytics */}
          {links && links.totalScans > 0 && (
            <div className="card p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-500">QR scans</p>
              <p className="mt-1 text-2xl font-extrabold text-ink-900">{links.totalScans}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CHANNELS.map((c) =>
                  links.scanCounts[c.value] ? (
                    <span key={c.value} className="badge bg-gray-100 text-gray-600">
                      <c.icon size={11} className={c.tint} /> {c.label}: {links.scanCounts[c.value]}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          )}

          {links && configured.length === 0 && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No review pages connected yet — scans will open your Markkito listing until you add one above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
