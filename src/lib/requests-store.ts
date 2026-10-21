// Lightweight client-side store for OD requests (mock when no backend).
// Persisted to localStorage so demo data survives reloads.

export type RequestStatus = "draft" | "pending" | "in_review" | "approved" | "rejected" | "withdrawn";
export type RequestCategory =
  | "Hackathon"
  | "Conference"
  | "Workshop"
  | "Sports"
  | "Lab Booking"
  | "Leave"
  | "Other";

export interface PolicyFinding {
  rule: string;
  status: "pass" | "fail" | "warn";
  detail: string;
}

export interface ActivityEntry {
  id: string;
  ts: string;
  actor: string;
  type: "created" | "status" | "comment" | "edited" | "attachment";
  message: string;
}

export interface Comment {
  id: string;
  ts: string;
  author: string;
  text: string;
}

export interface OdRequest {
  id: string;
  title: string;
  category: RequestCategory;
  description: string;
  startDate: string;
  endDate: string;
  status: RequestStatus;
  studentId: string;
  studentName: string;
  reviewer?: string;
  reviewerNote?: string;
  createdAt: string;
  updatedAt: string;
  attachments?: { name: string; size: number; dataUrl?: string }[];
  policy?: PolicyFinding[];
  activity?: ActivityEntry[];
  comments?: Comment[];
  parentId?: string; // for resubmits / duplicates
}

const KEY = "aicte_requests_v2";

function read(): OdRequest[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {/* ignore */}
  const s = seed();
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

function write(rows: OdRequest[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

function entry(actor: string, type: ActivityEntry["type"], message: string): ActivityEntry {
  return { id: "a-" + Date.now() + Math.random().toString(36).slice(2, 6), ts: new Date().toISOString(), actor, type, message };
}

function seed(): OdRequest[] {
  const now = Date.now();
  const day = 86400000;
  const mk = (r: Omit<OdRequest, "activity">): OdRequest => ({
    ...r,
    activity: [entry(r.studentName, "created", `Submitted ${r.category} request.`)],
    comments: [],
  });
  return [
    mk({
      id: "REQ-1024", title: "Smart India Hackathon — Finals", category: "Hackathon",
      description: "Travelling to IIT Delhi for SIH grand finale.",
      startDate: new Date(now + day).toISOString(), endDate: new Date(now + 4 * day).toISOString(),
      status: "approved", studentId: "u-rahul@x", studentName: "Rahul K.",
      reviewer: "Dr. Sharma", reviewerNote: "Approved. Carry college ID.",
      createdAt: new Date(now - 2 * day).toISOString(), updatedAt: new Date(now - 1 * day).toISOString(),
    }),
    mk({
      id: "REQ-1023", title: "IEEE Conference on AI", category: "Conference",
      description: "Paper presentation, Bangalore.",
      startDate: new Date(now + 6 * day).toISOString(), endDate: new Date(now + 8 * day).toISOString(),
      status: "in_review", studentId: "u-priya@x", studentName: "Priya S.",
      createdAt: new Date(now - day).toISOString(), updatedAt: new Date(now - day).toISOString(),
    }),
    mk({
      id: "REQ-1022", title: "Inter-college Football Tournament", category: "Sports",
      description: "Representing college team.",
      startDate: new Date(now + 2 * day).toISOString(), endDate: new Date(now + 3 * day).toISOString(),
      status: "pending", studentId: "u-arjun@x", studentName: "Arjun M.",
      createdAt: new Date(now - 36 * 3600 * 1000).toISOString(), updatedAt: new Date(now - 36 * 3600 * 1000).toISOString(),
    }),
    mk({
      id: "REQ-1021", title: "AI Workshop — IIIT Hyderabad", category: "Workshop",
      description: "2-day deep learning workshop.",
      startDate: new Date(now - 7 * day).toISOString(), endDate: new Date(now - 5 * day).toISOString(),
      status: "rejected", studentId: "u-meera@x", studentName: "Meera J.",
      reviewer: "HOD CSE", reviewerNote: "Clashes with mid-term exam.",
      createdAt: new Date(now - 10 * day).toISOString(), updatedAt: new Date(now - 8 * day).toISOString(),
    }),
  ];
}

export const requestsStore = {
  list(): OdRequest[] { return read(); },
  byId(id: string): OdRequest | undefined { return read().find((r) => r.id === id); },
  create(r: Omit<OdRequest, "id" | "createdAt" | "updatedAt" | "status" | "activity" | "comments">, opts?: { status?: RequestStatus; parentId?: string }): OdRequest {
    const rows = read();
    const id = `REQ-${1025 + rows.length + Math.floor(Math.random() * 900)}`;
    const now = new Date().toISOString();
    const status = opts?.status || "pending";
    const next: OdRequest = {
      ...r, id, status, createdAt: now, updatedAt: now,
      activity: [entry(r.studentName, "created", status === "draft" ? "Saved as draft." : `Submitted ${r.category} request.`)],
      comments: [], parentId: opts?.parentId,
    };
    rows.unshift(next);
    write(rows);
    return next;
  },
  update(id: string, patch: Partial<OdRequest>, actor?: string, msg?: string): OdRequest | undefined {
    const rows = read();
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return undefined;
    const prev = rows[i];
    const activity = [...(prev.activity || [])];
    if (patch.status && patch.status !== prev.status) {
      activity.push(entry(actor || "system", "status", `${prev.status} → ${patch.status}${msg ? ` · ${msg}` : ""}`));
    } else if (msg) {
      activity.push(entry(actor || "system", "edited", msg));
    }
    rows[i] = { ...prev, ...patch, activity, updatedAt: new Date().toISOString() };
    write(rows);
    return rows[i];
  },
  addComment(id: string, author: string, text: string): OdRequest | undefined {
    const rows = read();
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return undefined;
    const c: Comment = { id: "c-" + Date.now(), ts: new Date().toISOString(), author, text };
    rows[i] = {
      ...rows[i],
      comments: [...(rows[i].comments || []), c],
      activity: [...(rows[i].activity || []), entry(author, "comment", `Commented: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`)],
      updatedAt: new Date().toISOString(),
    };
    write(rows);
    return rows[i];
  },
  withdraw(id: string, actor: string) {
    return this.update(id, { status: "withdrawn" }, actor, "Withdrawn by student");
  },
  remove(id: string) { write(read().filter((r) => r.id !== id)); },
};

export const STATUS_STYLES: Record<RequestStatus, string> = {
  draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
  approved: "bg-green-500/10 text-green-400 border-green-500/30",
  pending: "bg-red-400/10 text-red-300 border-red-400/30",
  in_review: "bg-red-600/10 text-red-400 border-red-600/30",
  rejected: "bg-red-500/10 text-red-400 border-red-500/30",
  withdrawn: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};
