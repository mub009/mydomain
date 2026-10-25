// Fetch wrapper for the /api/v1 JSON API. Pages are server-rendered Blade;
// scripts that change data call the same API the app has always used.
//
// The API authenticates with a bearer JWT. A signed-in Blade page gets one
// for its session user from /session/token, kept in memory and fetched
// again once if the API says it has expired.

let tokenPromise = null;

function signedIn() {
  return Boolean(document.querySelector('meta[name="auth-user"]'));
}

function fetchToken() {
  tokenPromise ??= fetch("/session/token", { headers: { Accept: "application/json" }, credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => body?.accessToken ?? null)
    .catch(() => null);
  return tokenPromise;
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function buildUrl(path, params) {
  const url = new URL(`/api/v1${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function send(method, path, { params, body, retry = true } = {}) {
  const headers = { Accept: "application/json" };
  const token = signedIn() ? await fetchToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(buildUrl(path, params), { method, headers, body: payload, credentials: "same-origin" });
  } catch {
    throw new ApiError("Could not reach the server. Check that the backend is running.", 0, null);
  }

  if (response.status === 401 && token && retry) {
    tokenPromise = null;
    return send(method, path, { params, body, retry: false });
  }

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) throw new ApiError(errorFromBody(json, response.status), response.status, json);
  return json;
}

// "owner.phone" -> "Owner phone", "addressLine1" -> "Address line1"
function humanizeFieldPath(path) {
  const words = path
    .split(".")
    .map((seg) => seg.replace(/([A-Z])/g, " $1"))
    .join(" ")
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function errorFromBody(json, status) {
  const apiError = json?.error;
  // Validation errors carry per-field issues — surface which field failed
  // instead of the generic "Request validation failed".
  const issues = apiError?.details?.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    return issues.map((i) => (i.path ? `${humanizeFieldPath(i.path)}: ${i.message}` : i.message ?? "Invalid value")).join(" · ");
  }
  if (apiError?.message) {
    const reason = apiError.details?.reason ?? apiError.details?.hint;
    return reason && reason !== apiError.message ? `${apiError.message} (${reason})` : apiError.message;
  }
  return `Request failed (${status}). Check the backend logs.`;
}

export function errorMessage(error) {
  if (error instanceof ApiError) return error.message;
  // eslint-disable-next-line no-console
  console.error("Unexpected client error:", error);
  return error instanceof Error ? `Unexpected error: ${error.message}` : "An unexpected error occurred";
}

// Each helper resolves to the parsed envelope ({ success, data, meta, ... }).
export const api = {
  get: (path, params) => send("GET", path, { params }),
  post: (path, body, params) => send("POST", path, { body, params }),
  put: (path, body) => send("PUT", path, { body }),
  patch: (path, body) => send("PATCH", path, { body }),
  delete: (path) => send("DELETE", path),
};

export function uploadImage(file, purpose) {
  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", file);
  return api.post("/uploads/image", form).then((r) => r.data.url);
}
