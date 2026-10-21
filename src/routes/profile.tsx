import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth, type Role } from "@/lib/auth";
import { UserCircle, Upload, ShieldCheck, Monitor, Globe2, LogOut, Key, Mic, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prefsStore } from "@/lib/prefs-store";
import { toast } from "sonner";


export const Route = createFileRoute("/profile")({ component: Profile });
const roles: Role[] = ["student", "ambassador", "faculty", "hod", "admin"];

function Profile() {
  const { user, setRole } = useAuth();
  const [prefs, setPrefs] = useState(prefsStore.get());
  const [show2FA, setShow2FA] = useState(false);
  const [otp, setOtp] = useState("");

  useEffect(() => { const f = () => setPrefs(prefsStore.get()); window.addEventListener("prefs-updated", f); return () => window.removeEventListener("prefs-updated", f); }, []);
  if (!user) return null;

  const onAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { prefsStore.set({ avatarDataUrl: reader.result as string }); toast.success("Avatar updated"); };
    reader.readAsDataURL(f);
  };

  const enable2FA = () => {
    if (otp.length !== 6) { toast.error("Enter 6-digit code"); return; }
    prefsStore.set({ twoFactor: true }); setShow2FA(false); setOtp(""); toast.success("Two-factor enabled");
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-2"><UserCircle className="w-5 h-5 text-primary" /><h1 className="text-xl font-bold">Profile</h1></div>

        <div className="glass-card glass-card-glow p-6 flex items-center gap-5">
          <label className="relative cursor-pointer group">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/50 grid place-items-center text-2xl font-bold text-primary-foreground neon-glow overflow-hidden">
              {prefs.avatarDataUrl ? <img src={prefs.avatarDataUrl} alt="avatar" className="w-full h-full object-cover" /> : user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="absolute inset-0 rounded-2xl bg-black/60 grid place-items-center opacity-0 group-hover:opacity-100 transition"><Upload className="w-5 h-5 text-white" /></div>
            <input type="file" accept="image/*" className="hidden" onChange={onAvatar} />
          </label>
          <div>
            <div className="text-lg font-bold">{user.name}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
            <div className="text-[11px] text-primary mt-1 uppercase tracking-wider">{user.role}</div>
          </div>
        </div>

        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Key className="w-4 h-4 text-primary" /> Security</h2>
          <Button variant="outline" size="sm" onClick={() => toast.info("Password reset email sent (mock)")}>Change password</Button>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/30">
            <div><div className="text-sm font-medium flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-primary" /> Two-factor authentication</div><div className="text-[11px] text-muted-foreground">{prefs.twoFactor ? "Enabled · authenticator app" : "Add an extra layer of protection"}</div></div>
            {prefs.twoFactor ? <Button variant="outline" size="sm" onClick={() => { prefsStore.set({ twoFactor: false }); toast.success("2FA disabled"); }}>Disable</Button>
              : <Button variant="neon" size="sm" onClick={() => setShow2FA(true)}>Enable</Button>}
          </div>
          {show2FA && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs space-y-2">
              <div>Scan this QR with Google Authenticator, then enter the 6-digit code:</div>
              <div className="font-mono bg-secondary/60 p-3 rounded text-center">[ QR placeholder ]</div>
              <div className="flex gap-2">
                <input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} placeholder="000000" className="flex-1 h-9 px-3 rounded-lg bg-input border border-border/30 font-mono tracking-widest text-center" />
                <Button variant="neon" size="sm" onClick={enable2FA}>Verify</Button>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card p-5 space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Monitor className="w-4 h-4 text-primary" /> Active sessions</h2>
          {prefs.sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/30">
              <div><div className="text-sm font-medium">{s.device} {s.current && <span className="text-[10px] text-green-400 ml-1">· current</span>}</div><div className="text-[11px] text-muted-foreground">{s.ip} · last active {new Date(s.lastActive).toLocaleString()}</div></div>
              {!s.current && <Button variant="outline" size="sm" onClick={() => { prefsStore.revokeSession(s.id); setPrefs(prefsStore.get()); toast.success("Session revoked"); }}><LogOut className="w-3.5 h-3.5" /></Button>}
            </div>
          ))}
        </div>

        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Globe2 className="w-4 h-4 text-primary" /> Locale</h2>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">Language
              <select value={prefs.language} onChange={(e) => { prefsStore.set({ language: e.target.value }); setPrefs(prefsStore.get()); }} className="w-full mt-1 h-9 px-3 rounded-lg bg-input border border-border/30">
                <option value="en">English</option><option value="hi">हिन्दी</option><option value="ta">தமிழ்</option>
              </select>
            </label>
            <label className="text-xs">Timezone
              <select value={prefs.timezone} onChange={(e) => { prefsStore.set({ timezone: e.target.value }); setPrefs(prefsStore.get()); }} className="w-full mt-1 h-9 px-3 rounded-lg bg-input border border-border/30">
                {["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "UTC"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="glass-card p-5 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Mic className="w-4 h-4 text-primary" /> Voice Settings</h2>

          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/30">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Voice Input</div>
                <div className="text-[11px] text-muted-foreground">Dictate prompts using microphone</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.voiceInputEnabled}
                onChange={(e) => { prefsStore.set({ voiceInputEnabled: e.target.checked }); setPrefs(prefsStore.get()); }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-secondary border border-border/40 rounded-full peer peer-checked:bg-primary peer-checked:border-primary/50 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-3.5 after:h-3.5 after:rounded-full after:bg-foreground after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/30">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Voice Output</div>
                <div className="text-[11px] text-muted-foreground">Read responses aloud</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.voiceOutputEnabled}
                onChange={(e) => { prefsStore.set({ voiceOutputEnabled: e.target.checked }); setPrefs(prefsStore.get()); }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-secondary border border-border/40 rounded-full peer peer-checked:bg-primary peer-checked:border-primary/50 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-3.5 after:h-3.5 after:rounded-full after:bg-foreground after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <div className="space-y-3 p-3 rounded-lg bg-secondary/40 border border-border/30">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">Speech Rate: {prefs.speechRate.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={prefs.speechRate}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  prefsStore.set({ speechRate: v });
                  setPrefs(prefsStore.get());
                }}
                className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">Pitch: {prefs.speechPitch.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={prefs.speechPitch}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  prefsStore.set({ speechPitch: v });
                  setPrefs(prefsStore.get());
                }}
                className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">Volume: {Math.round(prefs.speechVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={prefs.speechVolume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  prefsStore.set({ speechVolume: v });
                  setPrefs(prefsStore.get());
                }}
                className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="glass-card p-5 space-y-2">
          <h2 className="text-sm font-semibold">Delegate approver (out-of-office)</h2>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Delegate to (email)" value={prefs.delegate?.to || ""} onChange={(e) => { prefsStore.set({ delegate: { to: e.target.value, until: prefs.delegate?.until || "" } }); setPrefs(prefsStore.get()); }} className="h-9 px-3 rounded-lg bg-input border border-border/30 text-xs" />
            <input type="date" value={prefs.delegate?.until || ""} onChange={(e) => { prefsStore.set({ delegate: { to: prefs.delegate?.to || "", until: e.target.value } }); setPrefs(prefsStore.get()); }} className="h-9 px-3 rounded-lg bg-input border border-border/30 text-xs" />
          </div>
        </div>

        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-semibold">Switch role (demo)</h2>
          <div className="flex flex-wrap gap-1.5">
            {roles.map((r) => <button key={r} onClick={() => setRole(r)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize ${user.role === r ? "bg-primary/15 border-primary/30 text-primary" : "bg-secondary/40 border-border/30 text-muted-foreground hover:text-foreground"}`}>{r}</button>)}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
