import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building2, Briefcase, Mail, Lock, User as UserIcon } from "lucide-react";
import { authApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { useAuthStore } from "@/store/authStore";

export default function Register() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", role: "CUSTOMER" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user, accessToken, refreshToken } = await authApi.register(form);
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
        <h1 className="text-2xl font-extrabold text-ink-900">Create your account</h1>
        <p className="text-sm text-ink-500 mt-1">Join MyDomain in seconds</p>
      </div>

      <form onSubmit={submit} className="card p-6 space-y-4">
        {error && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{error}</p>}
        <div className="flex gap-3">
          <div className="w-1/2">
            <label className="block text-xs font-semibold text-ink-700 mb-1.5">First name</label>
            <input
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="input"
            />
          </div>
          <div className="w-1/2">
            <label className="block text-xs font-semibold text-ink-700 mb-1.5">Last name</label>
            <input
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="input"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-700 mb-1.5">Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input pl-10"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-700 mb-1.5">I am a…</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, role: "CUSTOMER" })}
              className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                form.role === "CUSTOMER"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-ink-700 border-gray-300 hover:border-brand-300"
              }`}
            >
              <UserIcon size={15} /> Customer
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, role: "BUSINESS_OWNER" })}
              className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                form.role === "BUSINESS_OWNER"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-ink-700 border-gray-300 hover:border-brand-300"
              }`}
            >
              <Briefcase size={15} /> Business owner
            </button>
          </div>
        </div>
        <button disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="text-sm text-ink-500 mt-4 text-center">
        Already have an account?{" "}
        <Link to="/login" className="text-brand-600 font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
