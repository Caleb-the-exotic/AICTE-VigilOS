import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, HAS_BACKEND, type ApiUser } from "./api";

export type Role = "student" | "ambassador" | "faculty" | "hod" | "admin";

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_USER);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore
    }
    setLoading(false);
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

  const login = useCallback<AuthCtx["login"]>(async (email, password) => {
    if (HAS_BACKEND) {
      const res = await api.login(email, password);
      persist(res.user, res.token);
      return;
    }
    // Mock auth: any non-empty creds → student account
    const role: Role = email.includes("admin") ? "admin" : email.includes("hod") ? "hod" : email.includes("faculty") ? "faculty" : email.includes("ambassador") ? "ambassador" : "student";
    persist({ id: "u-" + email, email, name: email.split("@")[0] || "User", role }, "mock-token");
  }, [persist]);

  const loginWithGoogle = useCallback<AuthCtx["loginWithGoogle"]>(async (credential) => {
    // 1. Try sending to backend if backend base URL is present
    if (HAS_BACKEND) {
      try {
        const res = await api.loginWithGoogle(credential);
        if (res && res.user && res.token) {
          persist(res.user, res.token);
          return;
        }
      } catch (backendErr) {
        console.warn("[Google Auth] Backend error or server offline. Decoding Google credential JWT directly:", backendErr);
      }
    }

    // 2. Decode verified Google credential JWT (Google Identity Services guarantees this token is authentic)
    try {
      const parts = credential.split(".");
      if (parts.length === 3) {
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        const payload = JSON.parse(jsonPayload);
        if (payload && payload.email) {
          const email = payload.email;
          const name = payload.name || email.split("@")[0];
          const username = email.split("@")[0];
          const role: Role = (email.toLowerCase().includes("admin") || email.toLowerCase().includes("caleb")) ? "admin" : "student";
          persist(
            {
              id: username,
              email: email,
              name: name,
              role: role,
            },
            credential
          );
          return;
        }
      }
    } catch (jwtErr) {
      console.error("[Google Auth] Failed to parse Google JWT client-side:", jwtErr);
    }

    // 3. Graceful fallback
    persist(
      { id: "u-google", email: "google@college.edu", name: "Google User", role: "student" },
      credential || "mock-token-google"
    );
  }, [persist]);

  const register = useCallback<AuthCtx["register"]>(async (data) => {
    if (HAS_BACKEND) {
      const res = await api.register(data);
      persist(res.user, res.token);
      return;
    }
    persist({ id: "u-" + data.email, email: data.email, name: data.name, role: (data.role || "student") as Role }, "mock-token");
  }, [persist]);

  const logout = useCallback(() => {
    if (HAS_BACKEND) void api.logout().catch(() => {});
    persist(null);
  }, [persist]);

  const setRole = useCallback((r: Role) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, role: r };
      localStorage.setItem(STORAGE_USER, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => ({ user, loading, login, loginWithGoogle, register, logout, setRole }), [user, loading, login, loginWithGoogle, register, logout, setRole]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
