// Mail service UI mock store (uses backend notifier when available).
export interface MailAttachment { name: string; size: number }
export interface Mail {
  id: string; from: string; to: string; subject: string; body: string;
  ts: number; read: boolean; starred: boolean; folder: "inbox" | "sent" | "drafts" | "trash";
  threadId?: string; inReplyTo?: string; labels?: string[]; attachments?: MailAttachment[];
}
const KEY = "aicte_mail_v3";

function read(): Mail[] {
  if (typeof window === "undefined") return [];
  try {
    // Purge legacy v2 cache if present
    localStorage.removeItem("aicte_mail_v2");
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: Mail[] = JSON.parse(raw);
      // Clean out any seed / mock IDs
      const cleaned = parsed.filter(
        (m) =>
          !["m1", "m2", "m3", "m4"].includes(m.id) &&
          m.from !== "noreply@vigilos.gov.in" &&
          m.from !== "scheduler@vigilos.gov.in" &&
          m.from !== "hod.cse@college.edu"
      );
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(KEY, JSON.stringify(cleaned));
      }
      return cleaned;
    }
  } catch {/**/}
  return [];
}
function write(rows: Mail[]) { localStorage.setItem(KEY, JSON.stringify(rows)); window.dispatchEvent(new Event("mail-updated")); }

function seed(): Mail[] {
  return [];
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
