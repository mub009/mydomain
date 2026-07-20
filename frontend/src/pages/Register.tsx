import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { useAuthStore } from "@/store/authStore";

export default function Register() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", role: "CUSTOMER" });
  const [error, setError] = useState("");
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { user, accessToken, refreshToken } = await authApi.register(form);
      setAuth(user, accessToken, refreshToken);
      navigate("/");
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-4">Create your account</h1>
      <form onSubmit={submit} className="space-y-3 bg-white border rounded-md p-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3">
          <input
            required
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="w-1/2 border rounded-md px-3 py-2"
          />
          <input
            required
            placeholder="Last name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="w-1/2 border rounded-md px-3 py-2"
          />
        </div>
        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border rounded-md px-3 py-2"
        />
        <input
          required
          type="password"
          placeholder="Password (min 8 characters)"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full border rounded-md px-3 py-2"
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="w-full border rounded-md px-3 py-2"
        >
          <option value="CUSTOMER">I'm a customer</option>
          <option value="BUSINESS_OWNER">I own a business</option>
        </select>
        <button className="w-full bg-brand-600 text-white rounded-md py-2">Sign up</button>
      </form>
      <p className="text-sm text-gray-500 mt-3">
        Already have an account?{" "}
        <Link to="/login" className="text-brand-600">
          Log in
        </Link>
      </p>
    </div>
  );
}
