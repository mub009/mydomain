import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { authApi } from "@/api/endpoints";
import { useAuthStore } from "@/store/authStore";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import WelcomeModal from "@/components/WelcomeModal";
import Home from "@/pages/Home";
import SearchResults from "@/pages/SearchResults";
import QrClaim from "@/pages/QrClaim";
import BusinessDetail from "@/pages/BusinessDetail";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import OwnerDashboard from "@/pages/OwnerDashboard";
import B2BMarketplace from "@/pages/B2BMarketplace";
import RfqDetail from "@/pages/RfqDetail";
import AdminDashboard from "@/pages/AdminDashboard";

export default function App() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const updateUser = useAuthStore((s) => s.updateUser);

  // Re-sync the signed-in user's profile on load so sessions persisted
  // before a backend change pick up new fields like dealer privileges.
  useEffect(() => {
    if (!accessToken) return;
    authApi.me().then(updateUser).catch(() => undefined);
  }, [accessToken, updateUser]);

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
        <Route path="/b2b" element={<B2BMarketplace />} />
        <Route path="/b2b/:id" element={<RfqDetail />} />
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
