import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { UserRole } from "@/types";

export default function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: UserRole[] }) {
  const user = useAuthStore((s) => s.user);

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
