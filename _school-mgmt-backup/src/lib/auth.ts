export const ADMIN_AUTH_KEY = "admin_auth";
export const ADMIN_TOKEN_KEY = "admin_token";
export const STAFF_AUTH_KEY = "staff_auth";
export const STAFF_USER_KEY = "staff_user";

export const getAdminToken = (): string | null =>
  localStorage.getItem(ADMIN_TOKEN_KEY);
export const setAdminToken = (token: string | null) => {
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
};

export const formatWhatsappNumber = (number: string) => {
  const cleaned = number.replace(/\D/g, "");
  if (cleaned.length === 10) return `91${cleaned}`;
  return cleaned;
};

export const getAuthStatus = () =>
  localStorage.getItem(ADMIN_AUTH_KEY) === "true";
export const setAuthStatus = (status: boolean) =>
  localStorage.setItem(ADMIN_AUTH_KEY, status ? "true" : "false");

export const isAdmin = (): boolean =>
  localStorage.getItem(ADMIN_AUTH_KEY) === "true" &&
  localStorage.getItem(STAFF_AUTH_KEY) !== "true";

export const getStaffUser = (): { id: number; username: string; name: string; role: string; permissions: Record<string, { view: boolean; edit: boolean; delete: boolean }> } | null => {
  try {
    const raw = localStorage.getItem(STAFF_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const setStaffUser = (user: any) => {
  localStorage.setItem(STAFF_USER_KEY, JSON.stringify(user));
  localStorage.setItem(STAFF_AUTH_KEY, "true");
  localStorage.setItem(ADMIN_AUTH_KEY, "true");
};

export const clearStaffUser = () => {
  localStorage.removeItem(STAFF_USER_KEY);
  localStorage.removeItem(STAFF_AUTH_KEY);
};

export const getStaffPermissions = (): Record<string, { view: boolean; edit: boolean; delete: boolean }> => {
  const u = getStaffUser();
  return u?.permissions ?? {};
};

export const canAccessTab = (tab: string): boolean => {
  if (isAdmin()) return true;
  const perms = getStaffPermissions();
  return perms[tab]?.view ?? false;
};

export const canEdit = (tab: string): boolean => {
  if (isAdmin()) return true;
  const perms = getStaffPermissions();
  return perms[tab]?.edit ?? false;
};

export const canDelete = (tab: string): boolean => {
  if (isAdmin()) return true;
  const perms = getStaffPermissions();
  return perms[tab]?.delete ?? false;
};

export async function loginWithServer(
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setAuthStatus(true);
      if (data.token) setAdminToken(data.token);
      return { ok: true };
    }
    return { ok: false, error: data.error || "Invalid credentials" };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function staffLoginWithServer(
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string; user?: any }> {
  try {
    const res = await fetch("/api/auth/staff-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setStaffUser(data.user);
      return { ok: true, user: data.user };
    }
    return { ok: false, error: data.error || "Invalid credentials" };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function requestOtp(
  purpose: string,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose }),
    });
    const data = await res.json();
    if (res.ok && data.ok) return { ok: true, message: data.message };
    return { ok: false, error: data.error || "Failed to send OTP" };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function changeCredentials(opts: {
  otp: string;
  purpose: string;
  newUsername?: string;
  newPassword: string;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch("/api/auth/change-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
    const data = await res.json();
    if (res.ok && data.ok) return { ok: true, message: data.message };
    return { ok: false, error: data.error || "Failed to update credentials" };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}
