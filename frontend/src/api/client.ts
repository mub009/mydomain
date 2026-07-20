import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/authStore";

export const api = axios.create({
  baseURL: "/api/v1",
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) throw new Error("No refresh token available");

  const response = await axios.post("/api/v1/auth/refresh", { refreshToken });
  const { accessToken, refreshToken: newRefreshToken } = response.data.data;
  const { user } = useAuthStore.getState();
  if (user) useAuthStore.getState().setAuth(user, accessToken, newRefreshToken);
  return accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        refreshPromise ??= refreshAccessToken();
        const accessToken = await refreshPromise;
        refreshPromise = null;
        originalRequest.headers.set("Authorization", `Bearer ${accessToken}`);
        return api(originalRequest);
      } catch {
        refreshPromise = null;
        useAuthStore.getState().clearAuth();
      }
    }

    return Promise.reject(error);
  },
);

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as any)?.error?.message ?? error.message;
  }
  return "Something went wrong";
}
