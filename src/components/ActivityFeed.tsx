/**
 * ActivityFeed.tsx — Unified Real-Time Activity Timeline
 * Merges audit logs + event bus events into a live scrolling feed.
 * Supports filter by type and auto-refresh polling.
 */

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2, XCircle, AlertTriangle, Bot,
  Lock, FileText, Zap, RefreshCw, Filter, X,
} from "lucide-react";
import { api, tryApi, type ActivityEvent } from "@/lib/api";

// ── Icon map ──────────────────────────────────────────────────────────────────
function EventIcon({ icon, action }: { icon: string; action: string }) {
  const cls = "w-3.5 h-3.5";
  if (icon === "check" || action.includes("approved"))   return <CheckCircle2 className={`${cls} text-emerald-400`} />;
  if (icon === "x" || action.includes("rejected"))       return <XCircle      className={`${cls} text-red-400`} />;
  if (icon === "alert" || action.includes("escalated"))  return <AlertTriangle className={`${cls} text-amber-400`} />;
  if (icon === "bot" || action.includes("submit"))       return <Bot           className={`${cls} text-violet-400`} />;
  if (icon === "lock" || action.includes("login"))       return <Lock          className={`${cls} text-blue-400`} />;
  if (icon === "zap" || action.includes("request."))     return <Zap           className={`${cls} text-cyan-400`} />;
  return <FileText className={`${cls} text-white/40`} />;
}

function resultBadge(result: string) {
  if (!result) return null;
  const r = result.toLowerCase();
  if (r.includes("approved")) return <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/15 text-emerald-400 font-medium">APPROVED</span>;
  if (r.includes("rejected")) return <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/15 text-red-400 font-medium">REJECTED</span>;
  if (r.includes("escalated")) return <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-400 font-medium">ESCALATED</span>;
  return null;
}

// ── Seed data ─────────────────────────────────────────────────────────────────
function seedFeed(): ActivityEvent[] {
  const t = Date.now();
  return [
    { id: "1", session_id: "", actor_role: "citizen",           action: "leave_request submitted",       target: "REQ-1024", result: "APPROVED",  created_at: new Date(t - 1000 * 60 * 1).toISOString(), icon: "check" },
    { id: "2", session_id: "", actor_role: "SYSTEM",            action: "request.classified",             target: "REQ-1025", result: "",          created_at: new Date(t - 1000 * 60 * 3).toISOString(), icon: "zap" },
    { id: "3", session_id: "", actor_role: "citizen",           action: "lab_booking submitted",          target: "LAB204",   result: "REJECTED",  created_at: new Date(t - 1000 * 60 * 7).toISOString(), icon: "x" },
    { id: "4", session_id: "", actor_role: "bureau_head",       action: "escalated_leave reviewed",       target: "REQ-1022", result: "APPROVED",  created_at: new Date(t - 1000 * 60 * 12).toISOString(),icon: "check" },
    { id: "5", session_id: "", actor_role: "citizen",           action: "user login",                     target: "stu_001",  result: "",          created_at: new Date(t - 1000 * 60 * 20).toISOString(), icon: "lock" },
    { id: "6", session_id: "", actor_role: "SYSTEM",            action: "request.completed",              target: "REQ-1019", result: "APPROVED",  created_at: new Date(t - 1000 * 60 * 35).toISOString(), icon: "check" },
    { id: "7", session_id: "", actor_role: "citizen",           action: "complaint submitted",             target: "COMP-12",  result: "ESCALATED", created_at: new Date(t - 1000 * 60 * 60).toISOString(), icon: "alert" },
  ];
}

// ── Filter pill ───────────────────────────────────────────────────────────────
const FILTERS = ["all", "approved", "rejected", "escalated", "system", "login"] as const;
type Filter = typeof FILTERS[number];

// ── Time formatter ────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  sessionId?: string;
  limit?: number;
  autoRefresh?: boolean;
  maxHeight?: string;
  compact?: boolean;
}

export function ActivityFeed({
  sessionId,
  limit = 50,
  autoRefresh = true,
  maxHeight = "480px",
  compact = false,
}: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>(seedFeed());
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const listRef = useRef<HTMLDivElement>(null);

  const fetchFeed = async () => {
    const data = await tryApi(() => api.getActivityFeed(sessionId, limit));
    if (data && data.length) {
      setEvents(data);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchFeed().finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(fetchFeed, 5000);
    return () => clearInterval(t);
  }, [autoRefresh, sessionId]);

  // Filtered events
  const filtered = events.filter((e) => {
    if (filter === "all") return true;
    if (filter === "approved") return e.result.toLowerCase().includes("approved");
    if (filter === "rejected") return e.result.toLowerCase().includes("rejected");
    if (filter === "escalated") return e.result.toLowerCase().includes("escalated");
    if (filter === "system") return e.actor_role === "SYSTEM";
    if (filter === "login") return e.action.toLowerCase().includes("login");
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {!compact && (
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3 h-3 text-white/30" />
            {FILTERS.map((f) => (
              <button
                key={f}
                id={`activity-filter-${f}`}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                  filter === f
                    ? "bg-primary/20 text-primary border border-primary/40 font-semibold"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70 border border-transparent"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            id="activity-feed-refresh"
            onClick={fetchFeed}
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{lastRefresh.toLocaleTimeString()}</span>
          </button>
        </div>
      )}

      {/* Feed list */}
      <div
        ref={listRef}
        className="overflow-y-auto scrollbar-thin space-y-1 flex-1"
        style={{ maxHeight }}
      >
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-white/25">
            <FileText className="w-6 h-6 opacity-40" />
            <p className="text-[11px]">No activity yet</p>
          </div>
        )}

        {filtered.map((event, i) => (
          <div
            key={event.id || i}
            className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/4 transition-colors group"
            style={{
              animation: "fadeSlideIn 0.3s ease-out both",
              animationDelay: `${i * 30}ms`,
            }}
          >
            {/* Icon */}
            <div className="w-7 h-7 rounded-lg bg-white/5 grid place-items-center shrink-0 mt-0.5 group-hover:bg-white/8 transition-colors">
              <EventIcon icon={event.icon} action={event.action} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-white/70 font-medium truncate">
                  {event.action.replace(/_/g, " ")}
                </span>
                {resultBadge(event.result)}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {event.target && (
                  <span className="text-[9px] font-mono text-white/30 truncate">{event.target}</span>
                )}
                {event.actor_role && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/25">
                    {event.actor_role}
                  </span>
                )}
              </div>
            </div>

            {/* Time */}
            <span className="text-[9px] text-white/25 shrink-0 mt-0.5 font-mono">
              {timeAgo(event.created_at)}
            </span>
          </div>
        ))}
      </div>

      {/* Live indicator */}
      {autoRefresh && !compact && (
        <div className="flex items-center gap-1.5 pt-2 mt-2 border-t border-white/5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] text-white/25">Live · refreshes every 5s</span>
        </div>
      )}
    </div>
  );
}
