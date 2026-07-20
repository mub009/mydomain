import { Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Home from "@/pages/Home";
import BusinessDetail from "@/pages/BusinessDetail";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import OwnerDashboard from "@/pages/OwnerDashboard";
import B2BMarketplace from "@/pages/B2BMarketplace";
import RfqDetail from "@/pages/RfqDetail";
import AdminDashboard from "@/pages/AdminDashboard";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/business/:slug" element={<BusinessDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/b2b" element={<B2BMarketplace />} />
        <Route path="/b2b/:id" element={<RfqDetail />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={["BUSINESS_OWNER", "ADMIN"]}>
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
    </Layout>
  );
}
