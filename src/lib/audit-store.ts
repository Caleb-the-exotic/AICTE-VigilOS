// Mock audit log + system event store.
export interface AuditEntry {
  id: string;
  ts: string;
  actor: string;
  action: string;
  target?: string;
  severity: "info" | "warn" | "error";
}

const KEY = "aicte_audit_v1";

function read(): AuditEntry[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {/**/}
  const s = seed();
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}
function write(r: AuditEntry[]) { localStorage.setItem(KEY, JSON.stringify(r)); }

function seed(): AuditEntry[] {
  const t = Date.now();
  return [
    { id: "1", ts: new Date(t - 300_000).toISOString(), actor: "Dr. Sharma", action: "approved request REQ-1024", severity: "info" },
    { id: "2", ts: new Date(t - 1800_000).toISOString(), actor: "Admin", action: "updated approval policy 'attendance ≥ 75%'", severity: "warn" },
    { id: "3", ts: new Date(t - 3600_000).toISOString(), actor: "system", action: "scheduler ran daily compliance check", severity: "info" },
    { id: "4", ts: new Date(t - 7200_000).toISOString(), actor: "HOD CSE", action: "rejected REQ-1021 (exam clash)", severity: "warn" },
    { id: "5", ts: new Date(t - 86400_000).toISOString(), actor: "system", action: "backup completed (124 MB)", severity: "info" },
  ];
}

export const auditStore = {
  list() { return read().slice().sort((a, b) => +new Date(b.ts) - +new Date(a.ts)); },
  log(actor: string, action: string, severity: AuditEntry["severity"] = "info", target?: string) {
    const rows = read();
    rows.unshift({ id: String(Date.now()), ts: new Date().toISOString(), actor, action, severity, target });
    write(rows.slice(0, 500));
  },
};
