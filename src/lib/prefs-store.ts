// User preferences (notif channels, language, timezone, 2FA, sessions).
export interface NotifPref { event: string; email: boolean; inApp: boolean; push: boolean }
export interface Session { id: string; device: string; ip: string; lastActive: string; current?: boolean }
export interface UserPrefs {
  notif: NotifPref[];
  language: string;
  timezone: string;
  twoFactor: boolean;
  sessions: Session[];
  avatarDataUrl?: string;
  delegate?: { to: string; until: string } | null;
  unifiedInbox: boolean;
  compact: boolean;
  reducedMotion: boolean;
  featureFlags: { liveChat: boolean; aiSuggestions: boolean; maintenance: boolean };
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;
  voiceURI: string;
  speechRate: number;
  speechPitch: number;
  speechVolume: number;
}
const KEY = "aicte_prefs_v1";

const DEFAULTS: UserPrefs = {
  notif: [
    { event: "OD approved", email: true, inApp: true, push: false },
    { event: "OD rejected", email: true, inApp: true, push: true },
    { event: "New comment", email: false, inApp: true, push: false },
    { event: "Reminder (24h)", email: true, inApp: true, push: false },
    { event: "Weekly digest", email: true, inApp: false, push: false },
  ],
  language: "en",
  timezone: "Asia/Kolkata",
  twoFactor: false,
  sessions: [
    { id: "s1", device: "Chrome · Windows", ip: "192.168.1.4", lastActive: new Date().toISOString(), current: true },
    { id: "s2", device: "Safari · iPhone", ip: "10.0.0.3", lastActive: new Date(Date.now() - 86400000).toISOString() },
  ],
  delegate: null,
  unifiedInbox: true,
  compact: false,
  reducedMotion: false,
  featureFlags: { liveChat: true, aiSuggestions: true, maintenance: false },
  voiceInputEnabled: true,
  voiceOutputEnabled: true,
  voiceURI: "",
  speechRate: 1,
  speechPitch: 1,
  speechVolume: 1,
};

export const prefsStore = {
  get(): UserPrefs {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {/**/}
    return DEFAULTS;
  },
  set(p: Partial<UserPrefs>) {
    const cur = this.get();
    const next = { ...cur, ...p };
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("prefs-updated"));
    return next;
  },
  revokeSession(id: string) {
    const cur = this.get();
    this.set({ sessions: cur.sessions.filter((s) => s.id !== id) });
  },
  refreshCurrentSession() {
    const cur = this.get();
    const nowIso = new Date().toISOString();
    const updated = cur.sessions.map((s) => s.current ? { ...s, lastActive: nowIso } : s);
    return this.set({ sessions: updated });
  },
};
