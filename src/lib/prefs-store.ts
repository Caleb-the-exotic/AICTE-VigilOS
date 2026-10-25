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

function getCurrentDeviceName(): string {
  if (typeof navigator === "undefined") return "Active Browser Session";
  const ua = navigator.userAgent;
  let browser = "Browser";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";

  let os = "System";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return `${browser} · ${os}`;
}

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
    { id: "s1", device: getCurrentDeviceName(), ip: "127.0.0.1", lastActive: new Date().toISOString(), current: true },
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

function getAccountKey(userEmailOrId?: string): string {
  if (userEmailOrId && typeof userEmailOrId === "string" && userEmailOrId.trim()) {
    return userEmailOrId.trim().toLowerCase();
  }
  if (typeof window !== "undefined") {
    try {
      const uStr = localStorage.getItem("aicte_user");
      if (uStr) {
        const u = JSON.parse(uStr);
        if (u?.email) return String(u.email).trim().toLowerCase();
        if (u?.id) return String(u.id).trim().toLowerCase();
      }
    } catch {/**/}
  }
  return "guest";
}

function getStorageKey(userEmailOrId?: string): string {
  const account = getAccountKey(userEmailOrId);
  return `aicte_prefs_v2_${account}`;
}

export const prefsStore = {
  get(userEmailOrId?: string): UserPrefs {
    if (typeof window === "undefined") return DEFAULTS;
    const storageKey = getStorageKey(userEmailOrId);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Clean out any legacy mock Safari iPhone session from stored preferences
        const filteredSessions = (parsed.sessions || DEFAULTS.sessions).filter(
          (s: Session) =>
            s.id !== "s2" &&
            !s.device.toLowerCase().includes("safari · iphone") &&
            !s.device.toLowerCase().includes("safari iphone")
        );
        return {
          ...DEFAULTS,
          ...parsed,
          sessions: filteredSessions.length > 0 ? filteredSessions : [
            { id: "s1", device: getCurrentDeviceName(), ip: "127.0.0.1", lastActive: new Date().toISOString(), current: true },
          ],
        };
      }
    } catch {/**/}

    return {
      ...DEFAULTS,
      sessions: [
        { id: "s1", device: getCurrentDeviceName(), ip: "127.0.0.1", lastActive: new Date().toISOString(), current: true },
      ],
    };
  },

  set(patch: Partial<UserPrefs>, userEmailOrId?: string): UserPrefs {
    if (typeof window === "undefined") return DEFAULTS;
    const storageKey = getStorageKey(userEmailOrId);
    const cur = this.get(userEmailOrId);
    const next: UserPrefs = { ...cur, ...patch };

    // Clean out mock Safari iPhone session if present
    if (next.sessions) {
      next.sessions = next.sessions.filter(
        (s) =>
          s.id !== "s2" &&
          !s.device.toLowerCase().includes("safari · iphone") &&
          !s.device.toLowerCase().includes("safari iphone")
      );
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new Event("prefs-updated"));
    } catch {/**/}
    return next;
  },

  getAvatar(userEmailOrId?: string): string | undefined {
    return this.get(userEmailOrId).avatarDataUrl;
  },

  revokeSession(id: string, userEmailOrId?: string) {
    const cur = this.get(userEmailOrId);
    this.set({ sessions: cur.sessions.filter((s) => s.id !== id) }, userEmailOrId);
  },

  refreshCurrentSession(userEmailOrId?: string) {
    const cur = this.get(userEmailOrId);
    const nowIso = new Date().toISOString();
    const updated = cur.sessions.map((s) => s.current ? { ...s, lastActive: nowIso } : s);
    return this.set({ sessions: updated }, userEmailOrId);
  },
};
