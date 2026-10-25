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

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
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
    <Ctx.Provider value={{ user, loading, login, loginWithGoogle, register, logout, setRole }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
