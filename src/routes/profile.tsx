import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth, formatRole } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { UserCircle, Upload, ShieldCheck, Monitor, LogOut, Key, Clock, Shield, Sun, Moon, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prefsStore } from "@/lib/prefs-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({ component: Profile });

function Profile() {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(() => prefsStore.refreshCurrentSession());
  const [show2FA, setShow2FA] = useState(false);
  const [otp, setOtp] = useState("");

  useEffect(() => {
    const f = () => setPrefs(prefsStore.get());
    window.addEventListener("prefs-updated", f);
    return () => window.removeEventListener("prefs-updated", f);
  }, []);

  if (!user) return null;

  const onAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      prefsStore.set({ avatarDataUrl: reader.result as string });
      toast.success("Avatar updated");
    };
    reader.readAsDataURL(f);
  };

  const enable2FA = () => {
    if (otp.length !== 6) {
      toast.error("Enter 6-digit code");
      return;
    }
    prefsStore.set({ twoFactor: true });
    setShow2FA(false);
    setOtp("");
    toast.success("Two-factor enabled");
  };

  const formatSessionTime = (isoString: string, isCurrent?: boolean) => {
    if (isCurrent) {
      const now = new Date();
      try {
        const timeStr = now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        return `Active now · ${timeStr} IST`;
      } catch {
        return "Active now";
      }
    }
    try {
      return new Date(isoString).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " IST";
    } catch {
      return new Date(isoString).toLocaleString();
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Page Title */}
        <div className="flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Profile & Account Settings</h1>
        </div>

        {/* Profile Card */}
        <div className="glass-card glass-card-glow p-6 flex items-center justify-between gap-5 flex-wrap">
          <div className="flex items-center gap-5">
            <label className="relative cursor-pointer group">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/50 grid place-items-center text-2xl font-bold text-primary-foreground neon-glow overflow-hidden">
                {prefs.avatarDataUrl ? (
                  <img src={prefs.avatarDataUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  user.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-black/60 grid place-items-center opacity-0 group-hover:opacity-100 transition">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={onAvatar} />
            </label>
            <div>
              <div className="text-lg font-bold">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/15 border border-primary/30 px-2.5 py-0.5 rounded-full">
                  {formatRole(user.role)}
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  ID: {user.id || user.email.split("@")[0]}
                </span>
              </div>
            </div>
          </div>

          {/* Official Designation Display (Read-Only) */}
          <div className="flex flex-col items-start sm:items-end gap-1.5 ml-auto w-full sm:w-auto">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-primary" /> Official Role Designation
            </span>
            <div className="h-10 px-4 rounded-xl bg-secondary/60 border border-border/50 text-xs font-semibold text-foreground flex items-center gap-2.5 min-w-[240px] w-full sm:w-auto shadow-sm select-none">
              {user.role === "admin" && <span>🔑</span>}
              {user.role === "hod" && <span>🏛️</span>}
              {user.role === "faculty" && <span>📋</span>}
              {user.role === "ambassador" && <span>🌐</span>}
              {user.role === "student" && <span>👤</span>}
              <span className="truncate">
                {user.role === "faculty" && "Approval Officer (Case Handler)"}
                {user.role === "hod" && "Bureau Head (RB / PGRC / RO)"}
                {user.role === "admin" && "Super Admin (Central Vigilance)"}
                {user.role === "ambassador" && "State / Regional Nodal Officer"}
                {user.role === "student" && "Citizen / Complainant"}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions Row: Theme, Home/Admin Page, Logout */}
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary/35 hover:bg-secondary/60 border border-border/40 hover:border-primary/50 text-foreground transition-all duration-200 cursor-pointer shadow-sm group active:scale-[0.98]"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-primary group-hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="w-4 h-4 text-primary group-hover:-rotate-12 transition-transform" />
            )}
            <span className="text-xs font-semibold">
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </button>

          {user.role === "admin" ? (
            <button
              type="button"
              onClick={() => navigate({ to: "/admin" })}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary/35 hover:bg-secondary/60 border border-border/40 hover:border-primary/50 text-foreground transition-all duration-200 cursor-pointer shadow-sm group active:scale-[0.98]"
            >
              <Shield className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">Admin Page</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary/35 hover:bg-secondary/60 border border-border/40 hover:border-primary/50 text-foreground transition-all duration-200 cursor-pointer shadow-sm group active:scale-[0.98]"
            >
              <Home className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">Home</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              logout();
              navigate({ to: "/login" });
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary/35 hover:bg-destructive/15 border border-border/40 hover:border-destructive/40 text-foreground hover:text-destructive transition-all duration-200 cursor-pointer shadow-sm group active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4 text-destructive/80 group-hover:text-destructive group-hover:translate-x-0.5 transition-all" />
            <span className="text-xs font-semibold">Log Out</span>
          </button>
        </div>

        {/* Security Card */}
        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" /> Security
          </h2>
          <Button variant="outline" size="sm" onClick={() => toast.info("Password reset email sent (mock)")}>
            Change password
          </Button>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/30">
            <div>
              <div className="text-sm font-medium flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-primary" /> Two-factor authentication
              </div>
              <div className="text-[11px] text-muted-foreground">
                {prefs.twoFactor ? "Enabled · authenticator app" : "Add an extra layer of protection"}
              </div>
            </div>
            {prefs.twoFactor ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  prefsStore.set({ twoFactor: false });
                  toast.success("2FA disabled");
                }}
              >
                Disable
              </Button>
            ) : (
              <Button variant="neon" size="sm" onClick={() => setShow2FA(true)}>
                Enable
              </Button>
            )}
          </div>
          {show2FA && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs space-y-2">
              <div>Scan this QR with Google Authenticator, then enter the 6-digit code:</div>
              <div className="font-mono bg-secondary/60 p-3 rounded text-center">[ QR placeholder ]</div>
              <div className="flex gap-2">
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  placeholder="000000"
                  className="flex-1 h-9 px-3 rounded-lg bg-input border border-border/30 font-mono tracking-widest text-center"
                />
                <Button variant="neon" size="sm" onClick={enable2FA}>
                  Verify
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Active Sessions Card (Timezone moved here, with accurate real-time display) */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Monitor className="w-4 h-4 text-primary" /> Active sessions
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Connected devices and logged activity
              </p>
            </div>
            {/* Fixed Timezone Display */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/40 text-xs select-none">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="text-muted-foreground">Timezone:</span>
              <span className="font-semibold text-foreground">Asia/Kolkata (IST)</span>
            </div>
          </div>

          <div className="space-y-2 mt-2">
            {prefs.sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  s.current
                    ? "bg-primary/5 border-primary/30"
                    : "bg-secondary/40 border-border/30"
                )}
              >
                <div>
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    {s.device}
                    {s.current && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        current
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {s.ip} · {formatSessionTime(s.lastActive, s.current)}
                  </div>
                </div>
                {!s.current && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      prefsStore.revokeSession(s.id);
                      setPrefs(prefsStore.get());
                      toast.success("Session revoked");
                    }}
                    title="Revoke session"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
