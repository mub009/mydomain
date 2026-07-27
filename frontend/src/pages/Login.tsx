import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import { authApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import AuthLayout from "@/components/AuthLayout";

/**
 * Only same-site paths are honoured, so a crafted `?next=` cannot bounce a
 * freshly signed-in user off to another host. Protocol-relative values
 * ("//evil.test") are rejected along with anything not starting with "/".
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Where to return to — set by flows that send people here mid-task, such as
  // a Markkito review QR scanned by someone who is not signed in.
  const next = safeNext(searchParams.get("next"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user, accessToken, refreshToken } = await authApi.login({ email, password });
      setAuth(user, accessToken, refreshToken);
      navigate(next, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to your Markkito account"
      footer={
        <>
          No account?{" "}
          <Link to="/register" className="text-brand-600 font-semibold hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
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
              className="input pl-11"
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-ink-700">Password</label>
            <button type="button" className="text-xs text-brand-600 hover:underline">
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              required
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pl-11"
            />
          </div>
        </div>
        <button disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
