// Saved OD templates for recurring requests.
import type { RequestCategory } from "./requests-store";

export interface OdTemplate {
  id: string;
  name: string;
  title: string;
  category: RequestCategory;
  description: string;
}

const KEY = "aicte_templates_v1";

function read(): OdTemplate[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {/**/}
  const s = seed();
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}
function write(r: OdTemplate[]) { localStorage.setItem(KEY, JSON.stringify(r)); }

function seed(): OdTemplate[] {
  return [
    { id: "t1", name: "IEEE conference paper", title: "IEEE Conference — Paper Presentation", category: "Conference", description: "Travelling to present accepted IEEE paper. Carrying registration receipt and accepted manuscript." },
    { id: "t2", name: "Inter-college sports", title: "Inter-college Tournament", category: "Sports", description: "Representing college team. Selection letter attached." },
    { id: "t3", name: "Standard hackathon", title: "Hackathon — 48 hr", category: "Hackathon", description: "Participating in 48-hour hackathon. Team registration confirmed." },
  ];
}

export const templatesStore = {
  list(): OdTemplate[] { return read(); },
  byId(id: string) { return read().find((t) => t.id === id); },
  save(t: Omit<OdTemplate, "id">): OdTemplate {
    const rows = read();
    const next = { ...t, id: "t" + Date.now() };
    rows.push(next);
    write(rows);
    return next;
  },
  remove(id: string) { write(read().filter((t) => t.id !== id)); },
};
