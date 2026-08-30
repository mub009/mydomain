import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Calendar, User as UserIcon } from "lucide-react";
import { classifiedsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { ClassifiedListing } from "@/types";
import { CardSkeleton, Spinner } from "@/components/Loading";
import ClassifiedCard from "@/components/ClassifiedCard";

export default function SellerProfile() {
  const { sellerId = "" } = useParams();
  const [seller, setSeller] = useState<{ firstName: string; lastName: string; createdAt: string } | null>(null);
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    classifiedsApi
      .sellerProfile(sellerId)
      .then((r) => {
        setSeller(r.seller);
        setListings(r.listings);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [sellerId]);

  if (loading) return <Spinner label="Loading seller…" />;
  if (error || !seller) return <div className="card p-8 text-center text-sm text-red-700">{error || "Seller not found"}</div>;

  return (
    <div>
      <div className="card flex items-center gap-3 p-5">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <UserIcon size={24} />
        </span>
        <div>
          <h1 className="text-lg font-bold text-ink-900">
            {seller.firstName} {seller.lastName}
          </h1>
          <p className="flex items-center gap-1 text-sm text-ink-500">
            <Calendar size={12} /> Member since {new Date(seller.createdAt).getFullYear()}
          </p>
        </div>
      </div>

      <h2 className="mt-6 mb-3 font-bold text-ink-900">Listings from this seller</h2>
      {loading && <CardSkeleton count={4} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {listings.map((l) => (
          <ClassifiedCard key={l.id} listing={l} />
        ))}
      </div>
      {listings.length === 0 && <p className="text-sm text-ink-500">No active listings right now.</p>}
    </div>
  );
}
