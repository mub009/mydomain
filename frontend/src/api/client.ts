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

// "owner.phone" -> "Owner phone", "addressLine1" -> "Address line1"
function humanizeFieldPath(path: string): string {
  const words = path
    .split(".")
    .map((seg) => seg.replace(/([A-Z])/g, " $1"))
    .join(" ")
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    // The request never reached the server (backend down, wrong port, offline).
    if (!error.response) {
      return "Could not reach the server. Check that the backend is running.";
    }

    const apiError = (error.response.data as any)?.error;
    // Validation errors carry per-field issues — surface which field failed
    // instead of the generic "Request validation failed".
    const issues = apiError?.details?.issues;
    if (Array.isArray(issues) && issues.length > 0) {
      return issues
        .map((i: { path?: string; message?: string }) =>
          i.path ? `${humanizeFieldPath(i.path)}: ${i.message}` : i.message ?? "Invalid value",
        )
        .join(" · ");
    }

    if (apiError?.message) {
      // In development the server attaches the underlying reason; showing it
      // saves a trip to the logs when something unexpected breaks.
      const reason = apiError.details?.reason ?? apiError.details?.hint;
      return reason && reason !== apiError.message ? `${apiError.message} (${reason})` : apiError.message;
    }
    return `Request failed (${error.response.status}). Check the backend logs.`;
  }

  // Not an HTTP failure — a bug in our own code. Log it so it is findable
  // instead of vanishing behind a generic message.
  // eslint-disable-next-line no-console
  console.error("Unexpected client error:", error);
  return error instanceof Error ? `Unexpected error: ${error.message}` : "An unexpected error occurred";
}
