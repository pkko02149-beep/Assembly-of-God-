const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

export function getToken(role: "teacher" | "parent"): string | null {
  return localStorage.getItem(`${role}_token`);
}

export function setToken(role: "teacher" | "parent", token: string) {
  localStorage.setItem(`${role}_token`, token);
}

export function clearToken(role: "teacher" | "parent") {
  localStorage.removeItem(`${role}_token`);
  localStorage.removeItem(`${role}_user`);
  if (role === "parent") localStorage.removeItem("parent_session_schema");
}

export function getUser<T>(role: "teacher" | "parent"): T | null {
  try {
    const raw = localStorage.getItem(`${role}_user`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(role: "teacher" | "parent", user: unknown) {
  localStorage.setItem(`${role}_user`, JSON.stringify(user));
}

async function request<T>(
  role: "teacher" | "parent" | null,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (role) {
    const tok = getToken(role);
    if (tok) headers["Authorization"] = `Bearer ${tok}`;
  }
  // Route parent requests to the schema of the student's academic session,
  // not the current global session set on the server.
  if (role === "parent") {
    const schema = localStorage.getItem("parent_session_schema");
    if (schema) headers["X-Session-Schema"] = schema;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data?.error || `Request failed: ${res.status}`, res.status);
  return data as T;
}

export const teacherApi = {
  get: <T>(path: string) => request<T>("teacher", "GET", path),
  post: <T>(path: string, body: unknown) => request<T>("teacher", "POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("teacher", "PUT", path, body),
  del: <T>(path: string) => request<T>("teacher", "DELETE", path),
};

export const parentApi = {
  get: <T>(path: string) => request<T>("parent", "GET", path),
  post: <T>(path: string, body: unknown) => request<T>("parent", "POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("parent", "PUT", path, body),
  del: <T>(path: string) => request<T>("parent", "DELETE", path),
};

export const openApi = {
  post: <T>(path: string, body: unknown) => request<T>(null, "POST", path, body),
  get: <T>(path: string) => request<T>(null, "GET", path),
};
