import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building2, Lock, Mail } from "lucide-react";
import { authApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { useAuthStore } from "@/store/authStore";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user, accessToken, refreshToken } = await authApi.login({ email, password });
      setAuth(user, accessToken, refreshToken);
      navigate("/");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto py-8">
      <div className="flex flex-col items-center mb-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm mb-3">
          <Building2 size={24} />
        </span>
        <h1 className="text-2xl font-extrabold text-ink-900">Welcome back</h1>
        <p className="text-sm text-ink-500 mt-1">Log in to your Markkito account</p>
      </div>

      <form onSubmit={submit} className="card p-6 space-y-4">
        {error && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{error}</p>}
        <div>
          <label className="block text-xs font-semibold text-ink-700 mb-1.5">Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              required
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-700 mb-1.5">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              required
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
        <button disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="text-sm text-ink-500 mt-4 text-center">
        No account?{" "}
        <Link to="/register" className="text-brand-600 font-semibold hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
