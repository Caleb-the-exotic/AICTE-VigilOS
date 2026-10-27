// Peer-to-peer + group mock chat store (live chat).
export interface DM {
  id: string; from: string; to: string; text: string; ts: number; read: boolean;
  file?: { name: string; size: number; kind: "image" | "file"; dataUrl?: string };
}
export interface Peer { id: string; name: string; role: string; online: boolean; isGroup?: boolean; members?: string[] }

const KEY = "aicte_dms_v2";
const TYPING_KEY = "aicte_typing_v1";

export const PEERS: Peer[] = [
  { id: "u-rahul@x", name: "Rahul K.", role: "citizen", online: true },
  { id: "u-priya@x", name: "Priya S.", role: "citizen", online: true },
  { id: "u-arjun@x", name: "Arjun M.", role: "citizen", online: false },
  { id: "u-sharma@x", name: "Dr. Sharma", role: "approval_officer", online: true },
  { id: "u-bureauhead@x", name: "Bureau Head (PGRC)", role: "bureau_head", online: false },
  { id: "u-admin@x", name: "Super Admin", role: "super_admin", online: true },
  { id: "g-cse3a", name: "CSE-3A Project Group", role: "group", online: true, isGroup: true, members: ["u-rahul@x", "u-priya@x", "u-arjun@x"] },
  { id: "g-hackteam", name: "Hackathon Team", role: "group", online: true, isGroup: true, members: ["u-rahul@x", "u-priya@x"] },
];

function read(): DM[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(rows: DM[]) { localStorage.setItem(KEY, JSON.stringify(rows)); }

export const dmStore = {
  thread(meId: string, peerId: string): DM[] {
    return read()
      .filter((m) => (m.from === meId && m.to === peerId) || (m.from === peerId && m.to === meId))
      .sort((a, b) => a.ts - b.ts);
  },
  send(from: string, to: string, text: string, file?: DM["file"]): DM {
    const rows = read();
    const msg: DM = { id: "dm-" + Date.now() + Math.random(), from, to, text, ts: Date.now(), read: false, file };
    rows.push(msg);
    const peer = PEERS.find((p) => p.id === to);
    if (peer && peer.online && !peer.isGroup) {
      // Typing then auto-reply
      this.setTyping(to, from, true);
      const delay = 800 + Math.random() * 1400;
      setTimeout(() => {
        this.setTyping(to, from, false);
        const replies = ["Got it.", "Thanks for the update.", "I'll check and revert.", "Approved on my end.", "Can we discuss in 10m?"];
        const reply: DM = { id: "dm-" + Date.now() + Math.random(), from: to, to: from, text: replies[Math.floor(Math.random() * replies.length)], ts: Date.now(), read: false };
        const all = read();
        all.push(reply);
        write(all);
        // Mark sender's message as read by them
        const all2 = read().map((m) => m.from === from && m.to === to ? { ...m, read: true } : m);
        write(all2);
        window.dispatchEvent(new Event("dm-updated"));
      }, delay);
    }
    write(rows);
    window.dispatchEvent(new Event("dm-updated"));
    return msg;
  },
  unreadCount(meId: string): number { return read().filter((m) => m.to === meId && !m.read).length; },
  markRead(meId: string, peerId: string) {
    const rows = read().map((m) => (m.from === peerId && m.to === meId ? { ...m, read: true } : m));
    write(rows);
  },
  search(q: string): DM[] {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return read().filter((m) => m.text.toLowerCase().includes(s)).slice(-50);
  },
  setTyping(peerId: string, withId: string, on: boolean) {
    if (typeof window === "undefined") return;
    const k = `${TYPING_KEY}:${peerId}:${withId}`;
    if (on) sessionStorage.setItem(k, "1"); else sessionStorage.removeItem(k);
    window.dispatchEvent(new Event("typing-updated"));
  },
  isTyping(peerId: string, withId: string): boolean {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(`${TYPING_KEY}:${peerId}:${withId}`) === "1";
  },
};
