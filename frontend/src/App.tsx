import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { authApi } from "@/api/endpoints";
import { useAuthStore } from "@/store/authStore";
import { usePageViewTracking } from "@/hooks/usePageViewTracking";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import WelcomeModal from "@/components/WelcomeModal";
import Home from "@/pages/Home";
import SearchResults from "@/pages/SearchResults";
import QrClaim from "@/pages/QrClaim";
import PublicSite from "@/pages/PublicSite";
import BusinessDetail from "@/pages/BusinessDetail";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import OwnerDashboard from "@/pages/OwnerDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import ClassifiedsBrowse from "@/pages/ClassifiedsBrowse";
import ClassifiedDetail from "@/pages/ClassifiedDetail";
import ClassifiedForm from "@/pages/ClassifiedForm";
import SellerProfile from "@/pages/SellerProfile";
import MyListings from "@/pages/MyListings";
import Favorites from "@/pages/Favorites";

export default function App() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const updateUser = useAuthStore((s) => s.updateUser);

  // Re-sync the signed-in user's profile on load so sessions persisted
  // before a backend change pick up new fields like dealer privileges.
  useEffect(() => {
    if (!accessToken) return;
    authApi.me().then(updateUser).catch(() => undefined);
  }, [accessToken, updateUser]);

  // Powers the admin Analytics tab — every route change (including
  // /site/:slug, since this runs above that branch) pings the backend.
  usePageViewTracking();
  useScrollToTop();

  return (
    <Routes>
      {/* A business's own published website renders standalone — no Markkito
          header, footer or page container, so its full-width hero, map and
          sticky nav behave the way they do on a normal site. */}
      <Route path="/site/:slug" element={<PublicSite />} />

      <Route path="*" element={<AppShell />} />
    </Routes>
  );
}

// Everything except a published business site renders inside the app chrome.
function AppShell() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchResults />} />
        {/* Landing point for a scanned (or hand-typed) pre-printed QR board */}
        <Route path="/qr" element={<QrClaim />} />
        <Route path="/qr/:code" element={<QrClaim />} />
        <Route path="/business/:slug" element={<BusinessDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* B2B is the same directory as B2C, just pre-filtered — a business
            picks B2B/B2C at registration, not a separate marketplace. */}
        <Route path="/b2b" element={<Navigate to="/search?businessType=B2B" replace />} />

        {/* OLX-style classifieds — any signed-in user can post and manage
            their own items, so these aren't gated to business roles. */}
        <Route path="/classifieds" element={<ClassifiedsBrowse />} />
        <Route
          path="/classifieds/new"
          element={
            <ProtectedRoute>
              <ClassifiedForm />
            </ProtectedRoute>
          }
        />
        <Route path="/classifieds/sellers/:sellerId" element={<SellerProfile />} />
        <Route path="/classifieds/:id" element={<ClassifiedDetail />} />
        <Route
          path="/classifieds/:id/edit"
          element={
            <ProtectedRoute>
              <ClassifiedForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-listings"
          element={
            <ProtectedRoute>
              <MyListings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/favorites"
          element={
            <ProtectedRoute>
              <Favorites />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={["BUSINESS_OWNER", "DEALER", "ADMIN"]}>
              <OwnerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
      <WelcomeModal />
    </Layout>
  );
}
