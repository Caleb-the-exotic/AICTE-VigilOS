/**
 * CommandPalette.tsx — Global ⌘K Command Palette
 * Keyboard-first navigation + quick actions for CampusGPT OS.
 * Trigger: Ctrl+K / Cmd+K or click the search button in AppLayout.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Brain,
  FileText,
  Calendar,
  Users,
  BarChart3,
  MessageSquare,
  Settings,
  Search,
  Zap,
  LogOut,
  Bell,
  X,
  ArrowRight,
  ChevronRight,
  Gavel,
  AlertTriangle,
  Building2,
} from "lucide-react";

const COMMANDS = [
  {
    category: "AICTE Oversight (PS26264)",
    items: [
      { id: "nav-cases",        label: "AICTE Complaints & Cases Dashboard", icon: Gavel,        to: "/cases",          shortcut: "G K" },
      { id: "nav-overlaps",     label: "Cross-Bureau Overlap Alert Center",  icon: AlertTriangle,to: "/cases",          shortcut: "" },
      { id: "nav-institutions", label: "Institution Registry & 360° Profile",icon: Building2,    to: "/cases",          shortcut: "" },
    ],
  },
  {
    category: "Navigate",
    items: [
      { id: "nav-home",         label: "Go to Dashboard",       icon: BarChart3,    to: "/",               shortcut: "G H" },
      { id: "nav-cases-quick",  label: "Complaint Cases & Overlap", icon: Gavel,    to: "/cases",          shortcut: "G K" },
      { id: "nav-chat",         label: "AI Intelligence Activity", icon: Brain,     to: "/ai-activity",    shortcut: "G A" },
      { id: "nav-comms",        label: "Bureau Communications", icon: MessageSquare,to: "/comms",          shortcut: "G M" },
      { id: "nav-help",         label: "AICTE Support & Directory", icon: Building2, to: "/help",          shortcut: "G S" },
      { id: "nav-notifications",label: "Notifications",         icon: Bell,         to: "/notifications",  shortcut: "" },
      { id: "nav-profile",      label: "Profile Settings",      icon: Settings,     to: "/profile",        shortcut: "" },
    ],
  },
  {
    category: "Quick Actions",
    items: [
      { id: "qa-cases",    label: "View Cross-Bureau Cases",       icon: Gavel,        to: "/cases",          shortcut: "N C" },
      { id: "qa-overlap",  label: "Check Overlap Alerts",          icon: AlertTriangle,to: "/cases",          shortcut: "N O" },
      { id: "qa-chat",     label: "Ask Bureau AI Copilot",         icon: Brain,        to: "/comms",          shortcut: "Ctrl /" },
      { id: "qa-logout",   label: "Logout",                        icon: LogOut,       action: "logout",       shortcut: "" },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function flatten(query: string) {
  const q = query.toLowerCase();
  return COMMANDS.flatMap((g) =>
    g.items
      .filter((item) => item.label.toLowerCase().includes(q) || g.category.toLowerCase().includes(q))
      .map((item) => ({ ...item, category: g.category }))
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  onAction?: (action: string) => void;
}

export function CommandPalette({ open, onClose, onAction }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const results = flatten(query);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const execute = useCallback(
    (item: (typeof results)[0]) => {
      onClose();
      if ("to" in item && item.to) {
        navigate({ to: item.to as string });
      } else if ("action" in item && item.action) {
        onAction?.(item.action as string);
      }
    },
    [navigate, onClose, onAction]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { setSelected((s) => Math.min(s + 1, results.length - 1)); e.preventDefault(); }
      if (e.key === "ArrowUp")   { setSelected((s) => Math.max(s - 1, 0)); e.preventDefault(); }
      if (e.key === "Enter" && results[selected]) execute(results[selected]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, selected, execute, onClose]);

  if (!open) return null;

  // Group results by category
  const groups: Record<string, typeof results> = {};
  results.forEach((r) => {
    if (!groups[r.category]) groups[r.category] = [];
    groups[r.category].push(r);
  });

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
      aria-label="Command palette backdrop"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-xl bg-[#0e0e12] border border-red-950/40 rounded-2xl shadow-2xl overflow-hidden z-10"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: "0 0 0 1px rgba(220,38,38,0.35), 0 24px 64px rgba(0,0,0,0.85)" }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40 bg-zinc-950/60">
          <Search className="w-4 h-4 text-primary shrink-0" />
          <input
            ref={inputRef}
            id="command-palette-input"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            placeholder="Type a command or search cases, bureaus, PIDs…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-white/30 hover:text-white/70 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 px-2 py-0.5 text-[10px] rounded bg-white/5 text-white/40 border border-white/10 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2 bg-zinc-950/80">
          {results.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-white/30">
              <Search className="w-8 h-8 opacity-40 text-primary" />
              <p className="text-sm">No commands or cases found</p>
            </div>
          )}

          {Object.entries(groups).map(([category, items]) => (
            <div key={category}>
              <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {category}
              </div>
              {items.map((item) => {
                const Icon = item.icon;
                const isSelected = selected === flatIdx;
                const currentIdx = flatIdx++;
                return (
                  <button
                    key={item.id}
                    id={`cmd-${item.id}`}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                      isSelected
                        ? "bg-primary/20 text-white border-l-2 border-primary"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                    onMouseEnter={() => setSelected(currentIdx)}
                    onClick={() => execute(item)}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${
                        isSelected ? "bg-primary/30" : "bg-white/5"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-primary" : "text-white/50"}`} />
                    </div>
                    <span className="flex-1 text-sm">{item.label}</span>
                    {item.shortcut && (
                      <span className="text-[10px] text-white/35 font-mono">{item.shortcut}</span>
                    )}
                    {isSelected && <ArrowRight className="w-3 h-3 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/5 text-[10px] text-white/25">
          <span className="flex items-center gap-1"><kbd className="font-mono">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="font-mono">↵</kbd> Select</span>
          <span className="flex items-center gap-1"><kbd className="font-mono">ESC</kbd> Close</span>
          <span className="ml-auto flex items-center gap-1"><ChevronRight className="w-3 h-3" />CampusGPT OS</span>
        </div>
      </div>
    </div>
  );
}

// ── Global hotkey hook (use in AppLayout) ──────────────────────────────────────
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}
