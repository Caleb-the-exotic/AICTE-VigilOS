import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, HAS_BACKEND, type ApiUser } from "./api";

export type Role = "citizen" | "nodal_officer" | "approval_officer" | "bureau_head" | "super_admin";

export function formatRole(role?: string | null): string {
  if (!role) return "Approval Officer";
  const r = role.toLowerCase();
  if (r === "super_admin") return "Super Admin";
  if (r === "bureau_head") return "Bureau Head";
  if (r === "approval_officer") return "Approval Officer";
  if (r === "nodal_officer") return "Regional Nodal Officer";
  if (r === "citizen") return "Citizen / Complainant";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface User extends ApiUser {}

export type LoginResult = { requires2FA?: boolean; email?: string } | void;

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  login2FA: (email: string, otp: string) => Promise<void>;
  resend2FA: (email: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; role?: Role }) => Promise<void>;
  logout: () => void;
  setRole: (r: Role) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

const STORAGE_USER = "aicte_user";
const STORAGE_TOKEN = "aicte_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Authoritative session hydration from backend SQLite on startup
  useEffect(() => {
    let isMounted = true;
    const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_TOKEN) : null;

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    if (HAS_BACKEND) {
      api.getMe()
        .then((verifiedUser) => {
          if (!isMounted) return;
          if (verifiedUser && verifiedUser.status === "active") {
            const roleKey = ((verifiedUser as any).role_key || verifiedUser.role || "").toLowerCase();
            if (roleKey === "citizen" || roleKey === "institution") {
              // Block citizens from officer portal sessions
              localStorage.removeItem(STORAGE_USER);
              localStorage.removeItem(STORAGE_TOKEN);
              setUser(null);
              return;
            }
            setUser(verifiedUser);
            localStorage.setItem(STORAGE_USER, JSON.stringify(verifiedUser));
          } else {
            // Inactive or revoked
            localStorage.removeItem(STORAGE_USER);
            localStorage.removeItem(STORAGE_TOKEN);
            setUser(null);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          console.warn("[Auth] Session validation:", err);
          // Fall back to stored cache only if offline network error (not 401/403)
          if (err?.message && (err.message.includes("401") || err.message.includes("403"))) {
            localStorage.removeItem(STORAGE_USER);
            localStorage.removeItem(STORAGE_TOKEN);
            setUser(null);
          } else {
            try {
              const raw = localStorage.getItem(STORAGE_USER);
              if (raw) setUser(JSON.parse(raw));
            } catch {/**/}
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_USER);
        if (raw) setUser(JSON.parse(raw));
      } catch {/**/}
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const persist = useCallback((u: User | null, token?: string) => {
    if (u) {
      localStorage.setItem(STORAGE_USER, JSON.stringify(u));
      if (token) localStorage.setItem(STORAGE_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_USER);
      localStorage.removeItem(STORAGE_TOKEN);
    }
    setUser(u);
  }, []);

  const login = useCallback<AuthCtx["login"]>(async (identifier, password) => {
    if (!identifier || !password) {
      throw new Error("Username/Email and Password are required.");
    }

    try {
      const res = await api.login(identifier, password);
      if (res?.requires_2fa) {
        return { requires2FA: true, email: res.email };
      }
      if (res?.user && res?.token) {
        if (res.user.status && res.user.status !== "active") {
          throw new Error(`Your account status is ${res.user.status}. Access restricted.`);
        }
        persist(res.user, res.token);
        return;
      }
      throw new Error("Invalid response received from authentication server.");
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("401") || msg.includes("Invalid")) {
        throw new Error("Invalid username/email or password.");
      }
      if (msg.includes("403") || msg.includes("deactivated") || msg.includes("inactive")) {
        throw new Error("Account is inactive or suspended. Please contact an AICTE administrator.");
      }
      throw new Error(msg.replace(/^\d+\s+[^:]+:\s*/, "") || "Authentication failed.");
    }
  }, [persist]);

  const login2FA = useCallback<AuthCtx["login2FA"]>(async (email, otp) => {
    if (!email || !otp) {
      throw new Error("Email and 6-digit verification code are required.");
    }
    try {
      const res = await api.login2FA(email, otp);
      if (res?.user && res?.token) {
        if (res.user.status && res.user.status !== "active") {
          throw new Error(`Your account status is ${res.user.status}. Access restricted.`);
        }
        persist(res.user, res.token);
        return;
      }
      throw new Error("Two-factor authentication failed.");
    } catch (err: any) {
      const msg = err?.message || String(err);
      throw new Error(msg.replace(/^\d+\s+[^:]+:\s*/, "") || "Verification code is invalid or has expired.");
    }
  }, [persist]);

  const resend2FA = useCallback<AuthCtx["resend2FA"]>(async (email) => {
    if (!email) throw new Error("Email is required to resend verification code.");
    await api.resend2FA(email);
  }, []);

  const loginWithGoogle = useCallback<AuthCtx["loginWithGoogle"]>(async (credential) => {
    if (!credential) throw new Error("Google authentication credential missing.");

    try {
      const res = await api.loginWithGoogle(credential);
      if (res?.user && res?.token) {
        if (res.user.status && res.user.status !== "active") {
          throw new Error(`Your account status is ${res.user.status}. Access restricted.`);
        }
        persist(res.user, res.token);
        return;
      }
      throw new Error("Google authentication failed on server.");
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("403") || msg.includes("inactive") || msg.includes("unauthorized")) {
        throw new Error("Google login rejected: Account is inactive or unauthorized.");
      }
      if (msg.includes("offline") || msg.includes("unreachable") || msg.includes("Failed to fetch")) {
        throw new Error("Cannot connect to VigilOS Backend (http://localhost:8000). Please start backend with 'python api_server.py'.");
      }
      throw new Error(msg.replace(/^\d+\s+[^:]+:\s*/, "") || "Google login failed.");
    }
  }, [persist]);

  const register = useCallback<AuthCtx["register"]>(async (data) => {
    const res = await api.register(data);
    if (res?.user && res?.token) {
      persist(res.user, res.token);
      return;
    }
    throw new Error("Registration failed.");
  }, [persist]);

  const logout = useCallback(() => {
    if (HAS_BACKEND) {
      api.logout().catch(() => {});
    }
    persist(null);
  }, [persist]);

  const setRole = useCallback((newRole: Role) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, role: newRole };
      localStorage.setItem(STORAGE_USER, JSON.stringify(updated));
      return updated;
    });
    if (HAS_BACKEND) {
      api.updateRole(newRole).catch(() => {});
    }
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, login2FA, resend2FA, loginWithGoogle, register, logout, setRole }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
