import { useEffect, useState } from "react";
import { Download, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { BusinessPoster, businessPostersApi, GeneratedPoster } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business } from "@/types";
import { ListSkeleton } from "@/components/Loading";
import Modal from "@/components/Modal";
import { downloadGeneratedPng, downloadGeneratedSvg, isSvgDataUrl } from "@/lib/posterFile";

/**
 * The shop's side of the Poster Studio.
 *
 * An admin publishes one master template; each shop asks for its own copy of
 * it, carrying that shop's logo, name, number and QR. The copy is kept once
 * made, so opening a poster a second time is instant and — when an image model
 * is doing the drawing — free. "Make a new one" is the way to spend that again.
 */
export default function PostersForBusiness({ business }: { business: Business }) {
  const [designs, setDesigns] = useState<BusinessPoster[]>([]);
  const [hasLogo, setHasLogo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [working, setWorking] = useState("");
  const [open, setOpen] = useState<{ design: BusinessPoster; poster: GeneratedPoster } | null>(null);
  const [saving, setSaving] = useState("");

  function load() {
    setLoading(true);
    businessPostersApi
      .list(business.id)
      .then((result) => {
        setDesigns(result.designs);
        setHasLogo(result.business.hasLogo);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [business.id]);

  async function generate(design: BusinessPoster, regenerate = false) {
    setWorking(regenerate ? "again" : design.id);
    setError("");
    try {
      const poster = await businessPostersApi.generate(business.id, design.id, regenerate);
      setOpen({ design, poster });
      if (!poster.reused) load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setWorking("");
    }
  }

  // Counted only when the file is actually saved, so the report reflects use
  // rather than curiosity.
  async function save(design: BusinessPoster, poster: GeneratedPoster, format: "png" | "svg") {
    setSaving(format);
    setError("");
    try {
      const base = `${slug(design.name)}-${slug(business.name)}`;
      if (format === "png") {
        await downloadGeneratedPng(poster.image, poster.dimensions.width, poster.dimensions.height, `${base}.png`);
      } else {
        downloadGeneratedSvg(poster.image, `${base}.svg`);
      }
      await businessPostersApi.countDownload(business.id, design.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : apiErrorMessage(err));
    } finally {
      setSaving("");
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="font-bold text-ink-900">Ready-made posters</h3>
        <p className="mt-0.5 text-sm text-ink-600">
          Designs from Markkito. Make your own copy of one — it comes out with your name, logo, phone number and QR
          code on it, ready to share on WhatsApp or Instagram.
        </p>
      </div>

      {!hasLogo && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your listing has no logo yet, so posters will show your initials instead. Add one under
          <span className="font-semibold"> Details</span> for a finished look.
        </p>
      )}

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading && <ListSkeleton rows={3} />}

      {!loading && designs.length === 0 && (
        <div className="card p-8 text-center text-sm text-ink-500">
          No posters have been published for your category yet. Check back — new ones appear around festivals and
          sale seasons.
        </div>
      )}

      {!loading && designs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((design) => (
            <div key={design.id} className="card flex flex-col p-4">
              <p className="font-semibold text-ink-900">{design.name}</p>
              {design.description && <p className="mt-0.5 text-xs text-ink-600">{design.description}</p>}
              <p className="mt-1 text-[11px] text-ink-400">
                {design.dimensions.label} · {design.dimensions.hint}
              </p>
              {design.downloads > 0 && (
                <p className="mt-0.5 text-[11px] text-emerald-700">
                  Downloaded {design.downloads} {design.downloads === 1 ? "time" : "times"}
                </p>
              )}
              <button
                onClick={() => generate(design)}
                disabled={working !== ""}
                className="btn-primary mt-3 w-full py-2"
              >
                {working === design.id ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                {working === design.id ? "Making yours…" : design.generatedAt ? "Open my poster" : "Make my poster"}
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal title={open.design.name} onClose={() => setOpen(null)}>
          <img
            src={open.poster.image}
            alt={open.design.name}
            className="mx-auto w-full rounded-lg border border-gray-200"
          />

          {open.poster.note && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{open.poster.note}</p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => save(open.design, open.poster, "png")}
              disabled={saving !== ""}
              className="btn-primary flex-1 py-2.5"
            >
              {saving === "png" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {saving === "png" ? "Saving…" : "Download PNG"}
            </button>
            {/* Only the local engine makes a vector file; an image model returns
                pixels, and offering "SVG" for those would be a lie. */}
            {isSvgDataUrl(open.poster.image) && (
              <button
                onClick={() => save(open.design, open.poster, "svg")}
                disabled={saving !== ""}
                className="btn-secondary flex-1 py-2.5"
              >
                <Download size={15} /> Download SVG
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-ink-400">
            <span>Made {new Date(open.poster.generatedAt).toLocaleDateString()}</span>
            <button
              onClick={() => generate(open.design, true)}
              disabled={working !== ""}
              className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline disabled:opacity-50"
            >
              {working === "again" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {working === "again" ? "Making a new one…" : "Make a new one"}
            </button>
          </div>

          <p className="mt-2 text-center text-[11px] text-ink-400">
            PNG for WhatsApp and Instagram.
            {isSvgDataUrl(open.poster.image) && " SVG if a printer asks for it — it stays sharp at any size."}
          </p>
        </Modal>
      )}
    </div>
  );
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "poster"
  );
}
