// Natural-language → OD request fields. Naive but useful for demo.
import type { RequestCategory } from "./requests-store";

const CATS: { kw: RegExp; cat: RequestCategory }[] = [
  { kw: /hack[a-z]*\b/i, cat: "Hackathon" },
  { kw: /conf[a-z]*\b|ieee|symposium/i, cat: "Conference" },
  { kw: /workshop|bootcamp/i, cat: "Workshop" },
  { kw: /sport|tournament|match|football|cricket|basketball/i, cat: "Sports" },
  { kw: /lab\b|booking/i, cat: "Lab Booking" },
  { kw: /leave|medical|sick|personal/i, cat: "Leave" },
];

const DOW: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function nextDow(target: number, ref = new Date()): Date {
  const d = new Date(ref);
  const cur = d.getDay();
  const add = (target - cur + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function parseNL(text: string): {
  category: RequestCategory;
  title: string;
  description: string;
  startDate?: string;
  endDate?: string;
} {
  const lower = text.toLowerCase();
  const cat = CATS.find((c) => c.kw.test(lower))?.cat || "Other";

  let start: Date | undefined;
  let end: Date | undefined;

  // "tomorrow" / "today"
  if (/\btomorrow\b/.test(lower)) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); start = d; }
  if (/\btoday\b/.test(lower)) { const d = new Date(); d.setHours(9, 0, 0, 0); start = d; }

  // "next mon..fri" range
  const range = lower.match(/\bnext\s+(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*[-–to]+\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*/i);
  if (range) {
    const a = DOW[range[1].slice(0, 3) as keyof typeof DOW];
    const b = DOW[range[2].slice(0, 3) as keyof typeof DOW];
    start = nextDow(a);
    end = nextDow(b, start);
    if (+end < +start) end.setDate(end.getDate() + 7);
  } else {
    // Single "next fri"
    const single = lower.match(/\bnext\s+(sun|mon|tue|wed|thu|fri|sat)/i);
    if (single) { start = nextDow(DOW[single[1].slice(0, 3) as keyof typeof DOW]); }
  }

  if (start && !end) { end = new Date(start); end.setHours(17, 0, 0, 0); }

  const title = text.replace(/\b(for|next|tomorrow|today)\b.*$/i, "").trim().slice(0, 80) || `${cat} request`;

  return {
    category: cat,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    description: `Auto-drafted from: "${text}"`,
    startDate: start ? start.toISOString().slice(0, 10) : undefined,
    endDate: end ? end.toISOString().slice(0, 10) : undefined,
  };
}
