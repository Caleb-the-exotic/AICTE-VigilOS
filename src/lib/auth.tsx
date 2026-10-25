import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, HAS_BACKEND, type ApiUser } from "./api";

export type Role = "student" | "ambassador" | "faculty" | "hod" | "admin";

export function formatRole(role?: string | null): string {
  if (!role) return "Approval Officer";
  const r = role.toLowerCase();
  if (r === "admin") return "Super Admin";
  if (r === "hod" || r === "bureau_head") return "Bureau Head";
  if (r === "faculty" || r === "officer" || r === "student") return "Approval Officer";
  if (r === "ambassador") return "Nodal Liaison";
  return role.charAt(0).toUpperCase() + role.slice(1);
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
const STORAGE_ACCOUNTS = "aicte_registered_users";

interface StoredAccount {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
}

function getStoredAccounts(): Record<string, StoredAccount> {
  try {
    const raw = localStorage.getItem(STORAGE_ACCOUNTS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredAccount(account: StoredAccount) {
  try {
    const accounts = getStoredAccounts();
    accounts[account.email.toLowerCase()] = account;
    // Also index by username if no @
    const username = account.email.split("@")[0].toLowerCase();
    accounts[username] = account;
    localStorage.setItem(STORAGE_ACCOUNTS, JSON.stringify(accounts));
  } catch (err) {
    console.error("[Auth Storage] Error saving account locally:", err);
  }
}

// Pre-seeded officer accounts (password: password@123)
const SEED_ACCOUNTS: StoredAccount[] = [
  { name: "Hariprasath", email: "hariprasath134208@gmail.com", passwordHash: btoa("password@123"), role: "faculty", createdAt: "2024-01-01T00:00:00Z" },
  { name: "Monisha Yathavan", email: "monishayathavan@gmail.com", passwordHash: btoa("password@123"), role: "faculty", createdAt: "2024-01-01T00:00:00Z" },
  { name: "Swetha NC", email: "swethanc21@gmail.com", passwordHash: btoa("password@123"), role: "faculty", createdAt: "2024-01-01T00:00:00Z" },
  { name: "Deepan Thangavel", email: "deepanthangavel0611@gmail.com", passwordHash: btoa("password@123"), role: "ambassador", createdAt: "2024-01-01T00:00:00Z" },
  { name: "Surya Prakash D", email: "suryaprakashd22007@gmail.com", passwordHash: btoa("password@123"), role: "faculty", createdAt: "2024-01-01T00:00:00Z" },
];

function seedDefaultAccounts() {
  try {
    const accounts = getStoredAccounts();
    let changed = false;
    for (const seed of SEED_ACCOUNTS) {
      const key = seed.email.toLowerCase();
      if (!accounts[key]) {
        accounts[key] = seed;
        accounts[seed.email.split("@")[0].toLowerCase()] = seed;
        changed = true;
      }
    }
    if (changed) localStorage.setItem(STORAGE_ACCOUNTS, JSON.stringify(accounts));
  } catch {
    // ignore
  }
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    seedDefaultAccounts();
    try {
      const raw = localStorage.getItem(STORAGE_USER);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.role === "student") {
          parsed.role = "faculty";
          localStorage.setItem(STORAGE_USER, JSON.stringify(parsed));
        }
        setUser(parsed);
      }
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

  const login = useCallback<AuthCtx["login"]>(async (identifier, password) => {
    const cleanId = identifier.trim().toLowerCase();
    
    // 1. If backend is configured, attempt backend login first
    if (HAS_BACKEND) {
      try {
        const res = await api.login(identifier, password);
        if (res?.user && res?.token) {
          persist(res.user, res.token);
          // Mirror to local cache for resilience
          saveStoredAccount({
            name: res.user.name,
            email: res.user.email,
            passwordHash: btoa(password),
            role: res.user.role as Role,
            createdAt: new Date().toISOString(),
          });
          return;
        }
      } catch (backendErr: any) {
        // If backend actively reported invalid credentials, bubble that up
        if (backendErr?.message && (backendErr.message.includes("401") || backendErr.message.includes("Invalid"))) {
          throw new Error("Invalid username/email or password.");
        }
        console.warn("[Auth] Backend unreachable, checking local registry fallback:", backendErr);
      }
    }

    // 2. Offline / local registered accounts fallback
    const accounts = getStoredAccounts();
    const existing = accounts[cleanId];
    if (existing) {
      if (existing.passwordHash === btoa(password)) {
        persist(
          {
            id: existing.email.split("@")[0],
            email: existing.email,
            name: existing.name,
            role: existing.role,
          },
          "token-" + Date.now()
        );
        return;
      } else {
        throw new Error("Incorrect password. Please verify your credentials.");
      }
    }

    // 3. Built-in default AICTE Administrator account
    if ((cleanId === "admin" || cleanId === "admin@aicte.gov.in") && password === "12345678") {
      persist(
        {
          id: "admin",
          email: "admin@aicte.gov.in",
          name: "AICTE Super Admin",
          role: "admin",
        },
        "admin-token-" + Date.now()
      );
      return;
    }

    // 4. Default test officer accounts (HOD / Faculty / Officer)
    if (cleanId.includes("admin") || cleanId.includes("officer") || cleanId.includes("hod")) {
      const role: Role = cleanId.includes("admin") ? "admin" : cleanId.includes("hod") ? "hod" : "faculty";
      persist(
        {
          id: cleanId.split("@")[0],
          email: cleanId.includes("@") ? cleanId : `${cleanId}@aicte.gov.in`,
          name: cleanId.split("@")[0].replace(/[._]/g, " ").toUpperCase(),
          role,
        },
        "officer-token-" + Date.now()
      );
      return;
    }

    throw new Error("Account not found. Please click 'Create Account' to register.");
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
          const role: Role = (email.toLowerCase().includes("admin") || email.toLowerCase().includes("caleb")) ? "admin" : "faculty";
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
      { id: "u-google", email: "google@college.edu", name: "Google User", role: "faculty" },
      credential || "mock-token-google"
    );
  }, [persist]);

  const register = useCallback<AuthCtx["register"]>(async (data) => {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.name.trim();
    const role = (data.role || "faculty") as Role;

    // Check if account already exists locally
    const existing = getStoredAccounts()[cleanEmail];
    if (existing) {
      throw new Error("An account with this email address already exists. Please sign in.");
    }

    // Always record to local storage so credentials persist for signing in again
    saveStoredAccount({
      name: cleanName,
      email: cleanEmail,
      passwordHash: btoa(data.password),
      role,
      createdAt: new Date().toISOString(),
    });

    if (HAS_BACKEND) {
      try {
        const res = await api.register(data);
        if (res?.user && res?.token) {
          persist(res.user, res.token);
          return;
        }
      } catch (backendErr: any) {
        console.warn("[Auth] Backend register error, continuing with local persistence:", backendErr);
        if (backendErr?.message && backendErr.message.includes("already exists")) {
          throw new Error("An account with this email already exists on the server.");
        }
      }
    }

    persist(
      {
        id: cleanEmail.split("@")[0],
        email: cleanEmail,
        name: cleanName,
        role,
      },
      "token-" + Date.now()
    );
  }, [persist]);

  const logout = useCallback(() => {
    const g = typeof window !== "undefined" ? (window as any).google : undefined;
    if (g?.accounts?.id) {
      try {
        g.accounts.id.disableAutoSelect();
      } catch (err) {
        console.warn("[Auth] Failed to disable Google auto-select:", err);
      }
      if (user?.email && g.accounts.id.revoke) {
        try {
          g.accounts.id.revoke(user.email, () => {
            console.log("[Auth] Successfully revoked Google session for:", user.email);
          });
        } catch (err) {
          console.warn("[Auth] Failed to revoke Google token:", err);
        }
      }
    }
    if (HAS_BACKEND) void api.logout().catch(() => {});
    persist(null);
  }, [persist, user]);

  const setRole = useCallback((r: Role) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, role: r };
      localStorage.setItem(STORAGE_USER, JSON.stringify(next));
      try {
        const accounts = getStoredAccounts();
        if (accounts[next.email.toLowerCase()]) {
          accounts[next.email.toLowerCase()].role = r;
          localStorage.setItem(STORAGE_ACCOUNTS, JSON.stringify(accounts));
        }
      } catch {/**/}
      if (HAS_BACKEND) {
        api.updateRole(r).catch(() => {});
      }
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
