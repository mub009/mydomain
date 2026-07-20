import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-brand-600">
            MyDomain
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="hover:text-brand-600">
              Search
            </Link>
            <Link to="/b2b" className="hover:text-brand-600">
              B2B Marketplace
            </Link>
            {user?.role === "BUSINESS_OWNER" && (
              <Link to="/dashboard" className="hover:text-brand-600">
                My Business
              </Link>
            )}
            {user?.role === "ADMIN" && (
              <Link to="/admin" className="hover:text-brand-600">
                Admin
              </Link>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-gray-500">{user.firstName}</span>
                <button
                  onClick={() => {
                    clearAuth();
                    navigate("/");
                  }}
                  className="text-brand-600 font-medium"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="hover:text-brand-600">
                  Log in
                </Link>
                <Link to="/register" className="bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700">
                  Sign up
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
      <footer className="border-t py-4 text-center text-xs text-gray-400">
        MyDomain — Local Business Directory & Marketplace
      </footer>
    </div>
  );
}
