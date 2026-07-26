import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  Download,
  ExternalLink,
  Facebook,
  Globe,
  Instagram,
  Link2,
  Printer,
  QrCode,
  Star,
  Youtube,
} from "lucide-react";
import { Link } from "react-router-dom";
import { businessesApi, qrCodesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { CHANNEL_LABELS, REVIEW_CHANNELS, Business, ReviewChannel, ReviewLinks, ReviewQrCode } from "@/types";
import { Spinner } from "@/components/Loading";
import BoardPreviewModal from "@/components/BoardPreviewModal";
import { boardUrl, downloadDataUrl, renderQrDataUrl } from "@/lib/qrBoard";

const CHANNELS: { value: ReviewChannel; label: string; icon: typeof Star; tint: string }[] = [
  { value: "GOOGLE", label: "Google", icon: Star, tint: "text-amber-600" },
  { value: "INSTAGRAM", label: "Instagram", icon: Instagram, tint: "text-pink-600" },
  { value: "FACEBOOK", label: "Facebook", icon: Facebook, tint: "text-blue-600" },
  { value: "YOUTUBE", label: "YouTube", icon: Youtube, tint: "text-red-600" },
  { value: "WEBSITE", label: "Website", icon: Globe, tint: "text-brand-600" },
];

// The printed board points here; the server resolves the right platform and
// records the scan before redirecting the customer's phone.
function scanUrl(slug: string, channel?: ReviewChannel): string {
  const base = `${window.location.origin}/r/${slug}`;
  return channel ? `${base}?c=${channel.toLowerCase()}` : base;
}

// Small scannable preview of an issued board, shown in the list.
function BoardThumb({ code }: { code: string }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    renderQrDataUrl(boardUrl(code), 160)
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [code]);

  if (!dataUrl) return <div className="h-14 w-14 animate-pulse rounded bg-gray-100" />;
  return <img src={dataUrl} alt={`QR code ${code}`} className="h-14 w-14" />;
}

export default function ReviewQrBoard({ business }: { business: Business }) {
  const [links, setLinks] = useState<ReviewLinks | null>(null);
  const [attachedBoards, setAttachedBoards] = useState<ReviewQrCode[]>([]);
  const [previewBoard, setPreviewBoard] = useState<ReviewQrCode | null>(null);
  const [form, setForm] = useState({
    googlePlaceId: "",
    googleReviewUrl: "",
    instagramUsername: "",
    facebookPageUrl: "",
    youtubeUrl: "",
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
      youtubeUrl: data.youtubeUrl ?? "",
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
    // Pre-printed boards the shop has already activated.
    qrCodesApi
      .forBusiness(business.id)
      .then(setAttachedBoards)
      .catch(() => undefined);
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
        youtubeUrl: form.youtubeUrl,
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

  // Re-point an issued board at a different platform.
  async function changeBoardChannel(board: ReviewQrCode, channel: ReviewChannel | "") {
    setError("");
    setNotice("");
    try {
      const updated = await qrCodesApi.setChannel(business.id, board.id, channel || null);
      setAttachedBoards((list) => list.map((b) => (b.id === board.id ? { ...b, channel: updated.channel } : b)));
      setNotice(
        `${board.code} now sends people to ${updated.channel ? CHANNEL_LABELS[updated.channel] : "your default channel"}.`,
      );
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function downloadQr() {
    downloadDataUrl(qrDataUrl, `${business.slug}-review-qr.png`);
  }

  // Download an issued board's QR straight from the list.
  async function downloadBoard(board: ReviewQrCode) {
    try {
      downloadDataUrl(await renderQrDataUrl(boardUrl(board.code)), `${board.code}-qr.png`);
    } catch {
      setError("Could not generate that QR image. Try the View option instead.");
    }
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
            <label className="mb-1 block text-xs font-semibold text-ink-700">YouTube channel</label>
            <input
              className="input"
              placeholder="@yourshop or a full YouTube link"
              value={form.youtubeUrl}
              onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })}
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

          {/* Pre-printed boards issued by admin and activated by this shop */}
          <div className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Issued QR boards</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  Boards you received from Markkito and activated by scanning.
                </p>
              </div>
              <Link to="/qr" className="btn-secondary shrink-0 px-3 py-1.5 text-sm">
                <QrCode size={14} /> Activate a board
              </Link>
            </div>
            {attachedBoards.length > 0 ? (
              <div className="mt-3 space-y-2">
                {attachedBoards.map((board) => (
                  <div key={board.id} className="rounded-lg bg-gray-50 p-3">
                    <div className="flex items-start gap-3">
                      {/* Scannable thumbnail — click to open the full board */}
                      <button
                        type="button"
                        onClick={() => setPreviewBoard(board)}
                        title="View, download or print this board"
                        className="shrink-0 rounded-md border border-gray-200 bg-white p-1 transition-colors hover:border-brand-400"
                      >
                        <BoardThumb code={board.code} />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-bold text-ink-900">{board.code}</span>
                          <span className="shrink-0 text-xs text-ink-500">
                            {board.scanCount} {board.scanCount === 1 ? "scan" : "scans"}
                          </span>
                        </div>

                        <div className="mt-1.5 flex items-center gap-2">
                          <label className="shrink-0 text-[11px] font-medium text-ink-600">Sends to</label>
                          <select
                            value={board.channel ?? ""}
                            onChange={(e) => changeBoardChannel(board, e.target.value as ReviewChannel | "")}
                            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
                          >
                            <option value="">My default channel</option>
                            {REVIEW_CHANNELS.map((c) => (
                              <option key={c.value} value={c.value} disabled={!links?.resolved[c.value]}>
                                {c.label}
                                {links?.resolved[c.value] ? "" : " — add link first"}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewBoard(board)}
                            className="btn-secondary px-2.5 py-1 text-xs"
                          >
                            <QrCode size={12} /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadBoard(board)}
                            className="btn-secondary px-2.5 py-1 text-xs"
                          >
                            <Download size={12} /> Download
                          </button>
                          <a
                            href={boardUrl(board.code)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary px-2.5 py-1 text-xs"
                          >
                            <ExternalLink size={12} /> Test scan
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-ink-400">
                None yet. If you have a printed board from us, scan it or enter its code to activate.
              </p>
            )}
          </div>

          {links && configured.length === 0 && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No review pages connected yet — scans will open your Markkito listing until you add one above.
            </p>
          )}
        </div>
      </div>

      {previewBoard && (
        <BoardPreviewModal
          code={previewBoard.code}
          businessName={business.name}
          channel={previewBoard.channel ?? links?.preferredReviewChannel ?? null}
          onClose={() => setPreviewBoard(null)}
        />
      )}
    </div>
  );
}
