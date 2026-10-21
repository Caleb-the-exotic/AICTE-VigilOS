// Mail service UI mock store (uses backend notifier when available).
export interface MailAttachment { name: string; size: number }
export interface Mail {
  id: string; from: string; to: string; subject: string; body: string;
  ts: number; read: boolean; starred: boolean; folder: "inbox" | "sent" | "drafts" | "trash";
  threadId?: string; inReplyTo?: string; labels?: string[]; attachments?: MailAttachment[];
}
const KEY = "aicte_mail_v2";

function read(): Mail[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {/**/}
  const s = seed();
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}
function write(rows: Mail[]) { localStorage.setItem(KEY, JSON.stringify(rows)); window.dispatchEvent(new Event("mail-updated")); }

function seed(): Mail[] {
  const t = Date.now();
  return [
    { id: "m1", threadId: "th1", from: "noreply@vigilos.gov.in", to: "me", subject: "OD Request REQ-1024 approved", body: "Your OD request for SIH Finals has been approved by Dr. Sharma.\n\nCarry your college ID at all times.", ts: t - 3600_000, read: false, starred: false, folder: "inbox", labels: ["OD"] },
    { id: "m2", threadId: "th2", from: "hod.cse@college.edu", to: "me", subject: "Reminder: AICTE compliance review", body: "Please ensure all OD records for Sep–Nov are uploaded by Friday.", ts: t - 7200_000, read: false, starred: true, folder: "inbox", labels: ["Important"] },
    { id: "m3", threadId: "th3", from: "scheduler@vigilos.gov.in", to: "me", subject: "Lab 3 booking confirmed", body: "Lab 3 is reserved tomorrow 10:00–12:00.", ts: t - 86400_000, read: true, starred: false, folder: "inbox" },
    { id: "m4", threadId: "th4", from: "me", to: "advisor@college.edu", subject: "Question about attendance rule", body: "Hi sir, does an approved OD count toward the 75% rule?", ts: t - 2 * 86400_000, read: true, starred: false, folder: "sent" },
  ];
}

export const DEFAULT_LABELS = ["Important", "OD", "Admin", "Personal"];

export const mailStore = {
  list(folder: Mail["folder"]) { return read().filter((m) => m.folder === folder).sort((a, b) => b.ts - a.ts); },
  starred() { return read().filter((m) => m.starred && m.folder !== "trash").sort((a, b) => b.ts - a.ts); },
  byLabel(label: string) { return read().filter((m) => m.labels?.includes(label)).sort((a, b) => b.ts - a.ts); },
  byId(id: string) { return read().find((m) => m.id === id); },
  thread(threadId: string) { return read().filter((m) => m.threadId === threadId).sort((a, b) => a.ts - b.ts); },
  send(to: string, subject: string, body: string, opts?: { inReplyTo?: string; threadId?: string; attachments?: MailAttachment[] }): Mail {
    const m: Mail = {
      id: "m" + Date.now(), from: "me", to, subject, body,
      ts: Date.now(), read: true, starred: false, folder: "sent",
      threadId: opts?.threadId || "th-" + Date.now(),
      inReplyTo: opts?.inReplyTo, attachments: opts?.attachments,
    };
    const rows = read(); rows.push(m); write(rows); return m;
  },
  saveDraft(to: string, subject: string, body: string): Mail {
    const m: Mail = { id: "m" + Date.now(), from: "me", to, subject, body, ts: Date.now(), read: true, starred: false, folder: "drafts" };
    const rows = read(); rows.push(m); write(rows); return m;
  },
  markRead(id: string, read = true) {
    write(read ? read_set(id, true) : read_set(id, false));
  },
  toggleStar(id: string) {
    const rows = read().map((m) => m.id === id ? { ...m, starred: !m.starred } : m);
    write(rows);
  },
  moveToTrash(id: string) {
    write(read().map((m) => m.id === id ? { ...m, folder: "trash" as const } : m));
  },
  setLabels(id: string, labels: string[]) {
    write(read().map((m) => m.id === id ? { ...m, labels } : m));
  },
  unread() { return read().filter((m) => m.folder === "inbox" && !m.read).length; },
  search(q: string): Mail[] {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return read().filter((m) => m.subject.toLowerCase().includes(s) || m.body.toLowerCase().includes(s) || m.from.toLowerCase().includes(s));
  },
};

function read_set(id: string, val: boolean) {
  return read().map((m) => m.id === id ? { ...m, read: val } : m);
}
