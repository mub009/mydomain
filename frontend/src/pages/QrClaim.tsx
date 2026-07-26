import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, QrCode, Store } from "lucide-react";
import { businessesApi, qrCodesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, QrClaimResult, QrLookup } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { Spinner } from "@/components/Loading";

// Where a shop lands after scanning a pre-printed board that isn't attached to
// a business yet: confirm the code, pick the business, activate.
export default function QrClaim() {
  const { code: codeParam } = useParams<{ code: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [code, setCode] = useState(codeParam ?? "");
  const [lookup, setLookup] = useState<QrLookup | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [claimed, setClaimed] = useState<QrClaimResult | null>(null);
  const [loading, setLoading] = useState(!!codeParam);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(params.get("unknown") ? "That QR board was not recognised." : "");

  const canClaim = user && (user.role === "BUSINESS_OWNER" || user.role === "DEALER" || user.role === "ADMIN");

  function runLookup(raw: string) {
    if (!raw.trim()) return;
    setLoading(true);
    setError("");
    setLookup(null);
    qrCodesApi
      .lookup(raw)
      .then(setLookup)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (codeParam) runLookup(codeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  // Only owners/dealers/admins can attach a board, so only they need the list.
  useEffect(() => {
    if (!canClaim) return;
    businessesApi
      .mine({ pageSize: 50 })
      .then((r) => {
        setBusinesses(r.data);
        if (r.data.length === 1) setBusinessId(r.data[0].id);
      })
      .catch(() => undefined);
  }, [canClaim]);

  async function claim() {
    if (!businessId) {
      setError("Choose which business this board belongs to");
      return;
    }
    setSaving(true);
    setError("");
    try {
      setClaimed(await qrCodesApi.claim(lookup?.code ?? code, businessId));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // ---- Success ----------------------------------------------------------
  if (claimed) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card p-7 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={30} />
          </span>
          <h1 className="mt-4 text-xl font-extrabold text-ink-900">QR board activated</h1>
          <p className="mt-1 text-sm text-ink-600">
            <span className="font-mono font-semibold">{claimed.code}</span> is now attached to{" "}
            <span className="font-semibold text-ink-900">{claimed.business?.name}</span>.
          </p>

          {claimed.needsReviewLinks ? (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-left">
              <p className="flex items-center gap-1.5 text-sm font-bold text-amber-800">
                <AlertTriangle size={15} /> One step left
              </p>
              <p className="mt-1 text-xs text-amber-800/90">
                Add your Google, Instagram or Facebook review page so scans land on the right place. Until then, scans
                open your Markkito listing.
              </p>
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Customers scanning this board will now be taken straight to your review page.
            </p>
          )}

          <div className="mt-5 flex gap-2">
            <button onClick={() => navigate("/dashboard")} className="btn-primary flex-1 py-2.5">
              Go to dashboard
            </button>
            <button
              onClick={() => {
                setClaimed(null);
                setLookup(null);
                setCode("");
                navigate("/qr", { replace: true });
              }}
              className="btn-secondary flex-1 py-2.5"
            >
              Activate another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-7">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <QrCode size={30} />
        </span>
        <h1 className="mt-4 text-center text-xl font-extrabold text-ink-900">Activate your review QR board</h1>
        <p className="mt-1 text-center text-sm text-ink-600">
          Scan the board with your camera, or type the code printed on it.
        </p>

        {/* Code entry ------------------------------------------------------ */}
        <div className="mt-5">
          <label className="mb-1 block text-xs font-semibold text-ink-700">Board code</label>
          <div className="flex gap-2">
            <input
              className="input font-mono uppercase"
              placeholder="MK-XXXXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runLookup(code);
                }
              }}
            />
            <button type="button" onClick={() => runLookup(code)} className="btn-secondary whitespace-nowrap px-3 py-2">
              Check
            </button>
          </div>
        </div>

        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {loading && <Spinner label="Checking code…" />}

        {/* Confirmation --------------------------------------------------- */}
        {lookup && !loading && (
          <div className="mt-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-ink-500">Board code</p>
              <p className="font-mono text-lg font-bold text-ink-900">{lookup.code}</p>
              {lookup.batchLabel && <p className="mt-0.5 text-xs text-ink-400">Batch: {lookup.batchLabel}</p>}
            </div>

            {lookup.status === "ASSIGNED" && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                This board is already attached to <span className="font-semibold">{lookup.business?.name}</span>. Contact
                the admin if it needs to be moved.
              </p>
            )}

            {lookup.status === "DISABLED" && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                This board has been disabled. Please ask the admin for a replacement.
              </p>
            )}

            {lookup.status === "UNASSIGNED" && (
              <>
                {!canClaim ? (
                  <div className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">
                    Sign in with your business account to attach this board.
                    <Link to="/login" className="ml-1 font-semibold underline">
                      Log in
                    </Link>
                  </div>
                ) : businesses.length === 0 ? (
                  <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    You don't have a business listing yet. Create one first, then attach this board.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink-700">
                        <Store size={12} className="mr-1 inline -mt-0.5" />
                        Attach to which business?
                      </label>
                      <select className="input" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
                        <option value="">Select a business</option>
                        {businesses.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} — {b.city}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button disabled={saving || !businessId} onClick={claim} className="btn-primary w-full py-2.5 disabled:opacity-50">
                      {saving ? "Activating…" : "Confirm & activate board"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
