import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { classifiedsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { ClassifiedListing } from "@/types";
import { CardSkeleton } from "@/components/Loading";
import Pagination from "@/components/Pagination";
import ClassifiedCard from "@/components/ClassifiedCard";

export default function Favorites() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ClassifiedListing[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    classifiedsApi
      .favorites({ page })
      .then((r) => {
        setItems(r.data);
        setTotalPages(r.meta.totalPages);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page]);

  function removeFavorite(listing: ClassifiedListing) {
    setItems((prev) => prev.filter((l) => l.id !== listing.id));
    classifiedsApi.unfavorite(listing.id).catch(() => undefined);
  }

  return (
    <div>
      <h1 className="text-xl font-extrabold text-ink-900">Saved listings</h1>
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4">
        {loading && <CardSkeleton count={8} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" />}

        {!loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((l) => (
              <ClassifiedCard key={l.id} listing={l} favorited onToggleFavorite={removeFavorite} showStatus />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="card py-14 text-center text-ink-500">
            <Heart size={30} className="mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-ink-700">No saved listings yet</p>
            <p className="mt-1 text-sm">
              <Link to="/classifieds" className="font-semibold text-brand-600 hover:underline">
                Browse classifieds
              </Link>{" "}
              and tap the heart to save one for later.
            </p>
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}
