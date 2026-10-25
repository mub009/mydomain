import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Calendar, User as UserIcon, UserCheck, UserPlus, Users } from "lucide-react";
import { classifiedFollowsApi, classifiedsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { ClassifiedListing } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { CardSkeleton, Spinner } from "@/components/Loading";
import ClassifiedCard from "@/components/ClassifiedCard";

export default function SellerProfile() {
  const { sellerId = "" } = useParams();
  const user = useAuthStore((s) => s.user);
  const [seller, setSeller] = useState<{ firstName: string; lastName: string; createdAt: string } | null>(null);
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);

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
    classifiedFollowsApi
      .status(sellerId)
      .then((r) => {
        setFollowing(r.following);
        setFollowerCount(r.followerCount);
      })
      .catch(() => undefined);
  }, [sellerId]);

  function toggleFollow() {
    if (!user || followBusy) return;
    setFollowBusy(true);
    const action = following ? classifiedFollowsApi.unfollow(sellerId) : classifiedFollowsApi.follow(sellerId);
    action
      .then(() => {
        setFollowing((v) => !v);
        setFollowerCount((c) => c + (following ? -1 : 1));
      })
      .finally(() => setFollowBusy(false));
  }

  if (loading) return <Spinner label="Loading seller…" />;
  if (error || !seller) return <div className="card p-8 text-center text-sm text-red-700">{error || "Seller not found"}</div>;

  const isSelf = user?.id === sellerId;

  return (
    <div>
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
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
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-400">
              <Users size={11} /> {followerCount} follower{followerCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {!isSelf &&
          (user ? (
            <button
              onClick={toggleFollow}
              disabled={followBusy}
              className={following ? "btn-secondary px-4 py-2 text-sm" : "btn-primary px-4 py-2 text-sm"}
            >
              {following ? <UserCheck size={15} /> : <UserPlus size={15} />}
              {following ? "Following" : "Follow"}
            </button>
          ) : (
            <Link to={`/login?next=/classifieds/sellers/${sellerId}`} className="btn-primary px-4 py-2 text-sm">
              <UserPlus size={15} /> Follow
            </Link>
          ))}
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
