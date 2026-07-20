import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { useAuthStore } from "@/store/authStore";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { user, accessToken, refreshToken } = await authApi.login({ email, password });
      setAuth(user, accessToken, refreshToken);
      navigate("/");
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-4">Log in</h1>
      <form onSubmit={submit} className="space-y-3 bg-white border rounded-md p-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-md px-3 py-2"
        />
        <input
          required
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-md px-3 py-2"
        />
        <button className="w-full bg-brand-600 text-white rounded-md py-2">Log in</button>
      </form>
      <p className="text-sm text-gray-500 mt-3">
        No account?{" "}
        <Link to="/register" className="text-brand-600">
          Sign up
        </Link>
      </p>
    </div>
  );
}
