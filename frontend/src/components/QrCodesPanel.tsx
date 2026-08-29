import { useEffect, useState } from "react";
import { Download, Plus, Printer, QrCode as QrIcon, Search, Unlink } from "lucide-react";
import { adminApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { CHANNEL_LABELS, ReviewChannel, ReviewQrCode, ReviewQrStatus } from "@/types";
import { ListSkeleton } from "@/components/Loading";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import { boardHeadline, boardUrl, downloadDataUrl, renderQrDataUrl } from "@/lib/qrBoard";

const STATUS_TINT: Record<ReviewQrStatus, string> = {
  UNASSIGNED: "bg-gray-100 text-gray-600",
  ASSIGNED: "bg-emerald-50 text-emerald-700",
  DISABLED: "bg-red-50 text-red-700",
};

// A printable sheet of boards, each showing its QR and the code beneath it so
// a shop can still type it in if the camera struggles.
function PrintSheet({
  codes,
  purpose,
  onClose,
}: {
  codes: string[];
  purpose?: ReviewChannel | null;
  onClose: () => void;
}) {
  const [images, setImages] = useState<{ code: string; dataUrl: string }[]>([]);

  useEffect(() => {
    Promise.all(
      codes.map((code) => renderQrDataUrl(boardUrl(code), 320).then((dataUrl) => ({ code, dataUrl }))),
    )
      .then(setImages)
      .catch(() => setImages([]));
  }, [codes]);

  return (
    <Modal title={`${codes.length} QR ${codes.length === 1 ? "board" : "boards"} ready to print`} onClose={onClose}>
      <p className="mb-3 text-sm text-ink-600">
        Print these and hand them out. A shop scans one, confirms the code, and attaches it to their listing.
      </p>
      <div id="qr-board" className="grid grid-cols-2 gap-4">
        {images.map((item) => (
          <div key={item.code} className="rounded-xl border-2 border-dashed border-gray-200 p-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-widest text-brand-600">Loved your visit?</p>
            <p className="text-[11px] font-semibold text-ink-700">{boardHeadline(purpose)}</p>
            <img src={item.dataUrl} alt={item.code} className="mx-auto my-1.5 h-28 w-28" />
            <p className="font-mono text-xs font-bold text-ink-900">{item.code}</p>
            <p className="text-[8px] uppercase tracking-wider text-ink-400">Powered by Markkito</p>
          </div>
        ))}
        {images.length === 0 && <p className="col-span-2 py-6 text-center text-sm text-ink-500">Rendering codes…</p>}
      </div>
      <button onClick={() => window.print()} className="btn-primary mt-4 w-full py-2.5">
        <Printer size={15} /> Print sheet
      </button>
    </Modal>
  );
}

export default function QrCodesPanel() {
  const [codes, setCodes] = useState<ReviewQrCode[]>([]);
  const [summary, setSummary] = useState({ unassigned: 0, assigned: 0 });
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [generating, setGenerating] = useState(false);
  const [batchForm, setBatchForm] = useState({ count: "20", batchLabel: "" });
  const [showGenerate, setShowGenerate] = useState(false);
  const [printJob, setPrintJob] = useState<{ codes: string[]; purpose?: ReviewChannel | null } | null>(null);

  function load() {
    setLoading(true);
    adminApi
      .qrCodes({ search: search || undefined, status: statusFilter || undefined, page })
      .then((r) => {
        setCodes(r.data);
        setTotalPages(r.meta.totalPages);
        setTotal(r.meta.total);
        setSummary(r.summary);
      })
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      // No purpose is set here: a blank board works for any shop, and what it
      // points at is chosen by the dealer or shop when they attach it.
      const result = await adminApi.generateQrBatch(Number(batchForm.count), batchForm.batchLabel || undefined);
      setNotice(`Generated ${result.created} new QR boards.`);
      setShowGenerate(false);
      setPrintJob({ codes: result.codes, purpose: null });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  async function detach(qr: ReviewQrCode) {
    try {
      await adminApi.updateQrCode(qr.id, { businessId: null });
      setNotice(`${qr.code} released back to the unassigned pool.`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function setStatus(qr: ReviewQrCode, status: ReviewQrStatus) {
    try {
      await adminApi.updateQrCode(qr.id, { status });
      setNotice(`${qr.code} marked ${status.toLowerCase()}.`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-2xl font-extrabold leading-none text-ink-900">{total}</p>
          <p className="mt-1 text-xs text-ink-500">Boards issued</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-extrabold leading-none text-emerald-700">{summary.assigned}</p>
          <p className="mt-1 text-xs text-ink-500">Attached to a shop</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-extrabold leading-none text-ink-900">{summary.unassigned}</p>
          <p className="mt-1 text-xs text-ink-500">Awaiting activation</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
          <Search size={16} className="text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or shop…"
            className="w-full py-2.5 text-sm focus:outline-none"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-48">
          <option value="">All statuses</option>
          <option value="UNASSIGNED">Unassigned</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="DISABLED">Disabled</option>
        </select>
        <button onClick={() => setShowGenerate(true)} className="btn-primary whitespace-nowrap px-4 py-2.5">
          <Plus size={16} /> Generate boards
        </button>
      </div>

      {notice && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading && <ListSkeleton rows={5} />}

      {!loading && (
        <div className="card divide-y divide-gray-100">
          {codes.map((qr) => (
            <div key={qr.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono font-bold text-ink-900">{qr.code}</p>
                  <span className={`badge ${STATUS_TINT[qr.status]}`}>{qr.status.toLowerCase()}</span>
                  <span className="badge bg-brand-50 text-brand-700">
                    {qr.channel ? CHANNEL_LABELS[qr.channel] : "Shop default"}
                  </span>
                  {qr.scanCount > 0 && <span className="text-xs text-ink-400">{qr.scanCount} scans</span>}
                </div>
                {qr.business ? (
                  <p className="mt-0.5 truncate text-xs text-ink-600">
                    {qr.business.name} · {qr.business.city}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-ink-400">Not attached yet</p>
                )}
                {qr.batchLabel && <p className="mt-0.5 text-[11px] text-ink-400">Batch: {qr.batchLabel}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <button onClick={() => setPrintJob({ codes: [qr.code], purpose: qr.channel })} className="btn-secondary px-3 py-1.5 text-sm">
                  <QrIcon size={14} /> View
                </button>
                <button
                  onClick={() =>
                    renderQrDataUrl(boardUrl(qr.code))
                      .then((d) => downloadDataUrl(d, `${qr.code}-qr.png`))
                      .catch(() => setError("Could not generate that QR image."))
                  }
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  <Download size={14} /> PNG
                </button>
                {qr.status === "ASSIGNED" && (
                  <button onClick={() => detach(qr)} className="btn-secondary px-3 py-1.5 text-sm">
                    <Unlink size={14} /> Detach
                  </button>
                )}
                {qr.status !== "DISABLED" ? (
                  <button onClick={() => setStatus(qr, "DISABLED")} className="btn-secondary px-3 py-1.5 text-sm">
                    Disable
                  </button>
                ) : (
                  <button onClick={() => setStatus(qr, "UNASSIGNED")} className="btn-secondary px-3 py-1.5 text-sm">
                    Re-enable
                  </button>
                )}
              </div>
            </div>
          ))}
          {codes.length === 0 && (
            <div className="p-8 text-center text-sm text-ink-500">
              No QR boards yet — click “Generate boards” to issue your first batch.
            </div>
          )}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {showGenerate && (
        <Modal title="Generate QR boards" onClose={() => setShowGenerate(false)}>
          <form onSubmit={generate} className="space-y-3">
            <p className="text-sm text-ink-600">
              Each board gets a unique code. Print them and hand them out — the dealer or shop chooses what the board
              points at when they attach it to a listing.
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">How many boards? (max 500)</label>
              <input
                required
                type="number"
                min="1"
                max="500"
                className="input"
                value={batchForm.count}
                onChange={(e) => setBatchForm({ ...batchForm, count: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">Batch label (optional)</label>
              <input
                className="input"
                placeholder="e.g. Kochi run 1"
                value={batchForm.batchLabel}
                onChange={(e) => setBatchForm({ ...batchForm, batchLabel: e.target.value })}
              />
            </div>
            <button disabled={generating} className="btn-primary w-full py-2.5">
              {generating ? "Generating…" : `Generate ${batchForm.count || 0} boards`}
            </button>
          </form>
        </Modal>
      )}

      {printJob && <PrintSheet codes={printJob.codes} purpose={printJob.purpose} onClose={() => setPrintJob(null)} />}
    </div>
  );
}
