import { useEffect, useState } from "react";
import { Download, FileImage, Loader2 } from "lucide-react";
import { BusinessPoster, businessPostersApi, RenderedPoster } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business } from "@/types";
import { ListSkeleton } from "@/components/Loading";
import Modal from "@/components/Modal";
import { downloadPng, downloadSvg, svgToDataUrl } from "@/lib/posterFile";

/**
 * The shop's side of the Poster Studio: designs an admin published, already
 * rendered with this shop's own logo, name and number. Nothing to edit — just
 * pick one and save it.
 */
export default function PostersForBusiness({ business }: { business: Business }) {
  const [designs, setDesigns] = useState<BusinessPoster[]>([]);
  const [hasLogo, setHasLogo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [opening, setOpening] = useState("");
  const [open, setOpen] = useState<{ design: BusinessPoster; rendered: RenderedPoster } | null>(null);
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

  async function preview(design: BusinessPoster) {
    setOpening(design.id);
    setError("");
    try {
      setOpen({ design, rendered: await businessPostersApi.render(business.id, design.id) });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setOpening("");
    }
  }

  // Counted only when the file is actually saved, so the report reflects use
  // rather than curiosity.
  async function save(rendered: RenderedPoster, format: "png" | "svg") {
    setSaving(format);
    setError("");
    try {
      if (format === "png") {
        await downloadPng(rendered.svg, rendered.width, rendered.height, rendered.fileName);
      } else {
        downloadSvg(rendered.svg, rendered.fileName);
      }
      await businessPostersApi.countDownload(business.id, rendered.designId);
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
          Designs from Markkito, already filled in with your name, logo and phone number. Save one and share it on
          WhatsApp or Instagram.
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
                onClick={() => preview(design)}
                disabled={opening === design.id}
                className="btn-primary mt-3 w-full py-2"
              >
                {opening === design.id ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <FileImage size={15} />
                )}
                {opening === design.id ? "Preparing…" : "Preview & download"}
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal title={open.design.name} onClose={() => setOpen(null)}>
          <img
            src={svgToDataUrl(open.rendered.svg)}
            alt={open.design.name}
            className="mx-auto w-full rounded-lg border border-gray-200"
          />
          {!open.rendered.logoEmbedded && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Your logo could not be loaded, so this poster shows your initials. Check the logo URL under Details.
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => save(open.rendered, "png")}
              disabled={saving !== ""}
              className="btn-primary flex-1 py-2.5"
            >
              {saving === "png" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {saving === "png" ? "Saving…" : "Download PNG"}
            </button>
            <button
              onClick={() => save(open.rendered, "svg")}
              disabled={saving !== ""}
              className="btn-secondary flex-1 py-2.5"
            >
              <Download size={15} /> Download SVG
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-400">
            PNG for WhatsApp and Instagram. SVG if a printer asks for it — it stays sharp at any size.
          </p>
        </Modal>
      )}
    </div>
  );
}
