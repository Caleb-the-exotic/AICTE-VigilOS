// Department + Category CRUD (admin).
export interface Dept { id: string; name: string; code: string; hod: string }
const DKEY = "aicte_depts_v1";
const CKEY = "aicte_cats_v1";

const DEFAULT_DEPTS: Dept[] = [
  { id: "d1", name: "Computer Science & Engineering", code: "CSE", hod: "Dr. Iyer" },
  { id: "d2", name: "Electronics & Communication", code: "ECE", hod: "Dr. Murthy" },
  { id: "d3", name: "Mechanical Engineering", code: "MECH", hod: "Dr. Rao" },
  { id: "d4", name: "Civil Engineering", code: "CIVIL", hod: "Dr. Bose" },
];
const DEFAULT_CATS = ["Hackathon", "Conference", "Workshop", "Sports", "Lab Booking", "Leave", "Other"];

function rd<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const r = localStorage.getItem(k); if (r) return JSON.parse(r); } catch {/**/}
  localStorage.setItem(k, JSON.stringify(fallback));
  return fallback;
}
function wr<T>(k: string, v: T) { localStorage.setItem(k, JSON.stringify(v)); }

export const deptStore = {
  list(): Dept[] { return rd(DKEY, DEFAULT_DEPTS); },
  add(d: Omit<Dept, "id">): Dept { const rows = this.list(); const n = { ...d, id: "d" + Date.now() }; rows.push(n); wr(DKEY, rows); return n; },
  update(id: string, p: Partial<Dept>) { const rows = this.list().map((r) => r.id === id ? { ...r, ...p } : r); wr(DKEY, rows); },
  remove(id: string) { wr(DKEY, this.list().filter((r) => r.id !== id)); },
};

export const categoryStore = {
  list(): string[] { return rd(CKEY, DEFAULT_CATS); },
  add(name: string) { const rows = this.list(); if (!rows.includes(name)) { rows.push(name); wr(CKEY, rows); } },
  remove(name: string) { wr(CKEY, this.list().filter((r) => r !== name)); },
};
