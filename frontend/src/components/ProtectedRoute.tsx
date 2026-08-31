import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { UserRole } from "@/types";

export default function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: UserRole[] }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  // Bounced to login for a page a guest tried to reach directly (e.g. "Sell
  // an item") — send them back there once they've signed in, instead of
  // dropping them on the home page with no way back to what they wanted.
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
