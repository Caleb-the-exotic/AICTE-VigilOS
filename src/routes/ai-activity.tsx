import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity, FileText,
  ChevronRight, LayoutGrid, List, Eye,
  Siren, Clock, CheckCircle2, AlertOctagon,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ExplanationDrawer } from "@/components/ExplanationDrawer";
import { api, HAS_BACKEND, tryApi, type WorkflowLog } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-activity")({ component: AIActivity });

// ── Live KPI tiles ─────────────────────────────────────────────────────────────
function KpiTile({ label, value, icon: Icon, sub, color }: {
  label: string; value: string | number; icon: React.FC<{ className?: string }>;
  sub?: string; color?: string;
}) {
  return (
    <div className="glass-card p-4 flex flex-col gap-2 hover:border-primary/30 transition-all duration-200 group">
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-lg grid place-items-center ${color || "bg-primary/15"}`}>
          <Icon className={`w-4 h-4 ${color ? "text-white" : "text-primary"}`} />
        </div>
        <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-primary transition-colors" />
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      {sub && <div className="text-[10px] text-white/25">{sub}</div>}
    </div>
  );
}

// ── Execution log (compact) ────────────────────────────────────────────────────
function LogStream({ logs }: { logs: WorkflowLog[] }) {
  const STEP_COLOR: Record<string, string> = {
    overlap: "text-red-400", ingestion: "text-rose-400", crosscheck: "text-red-300",
    notification: "text-primary", update: "text-red-200",
  };
  return (
    <ul className="space-y-0 max-h-[360px] overflow-auto scrollbar-thin font-mono text-xs">
      {logs.map((l, i) => (
        <li
          key={i}
          className="flex items-start gap-3 px-3 py-2.5 hover:bg-white/3 rounded-lg transition-colors border-b border-white/5 last:border-0"
          style={{ animation: "fadeSlideIn 0.2s ease-out both", animationDelay: `${i * 20}ms` }}
        >
          <span className="text-white/25 shrink-0 text-[10px] tabular-nums">
            {new Date(l.ts).toLocaleTimeString()}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase shrink-0 ${
            l.level === "ERROR" ? "bg-red-500/15 text-red-400" :
            l.level === "WARN"  ? "bg-amber-500/15 text-amber-400" :
            l.level === "ALERT" ? "bg-primary/20 text-primary font-bold" :
            "bg-red-500/10 text-red-300"
          }`}>{l.level}</span>
          <span className={`shrink-0 ${STEP_COLOR[l.step] || "text-white/40"}`}>{l.step}</span>
          <span className="text-white/70 break-all">{l.message}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function AIActivity() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkflowLog[]>(seedLogs());
  const [view, setView] = useState<"feed" | "logs">("feed");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [metrics, setMetrics] = useState({
    pendingOverlaps: 2,
    unacknowledgedAlerts: 3,
    overdueCases: 1,
    awaitingCoordination: 4,
  });

  // Fetch logs + poll
  useEffect(() => {
    if (!HAS_BACKEND) return;
    let cancel = false;
    const tick = async () => {
      const data = await tryApi(() => api.getWorkflowLogs("global"));
      if (!cancel && data?.length) setLogs(data);
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => { cancel = true; clearInterval(t); };
  }, []);

  const sessionId = user ? `user_${user.id || user.email}` : "demo";

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center shadow-[0_0_15px_rgba(220,38,38,0.2)]">
              <Siren className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Overlap Detection & Monitoring Activity</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                AICTE Inter-Bureau Case Ingestion & Correlation Feed (RB · PGRC · RO)
              </p>
            </div>
          </div>
          <button
            id="open-explanation-drawer-btn"
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30
              text-primary text-xs hover:bg-primary/25 transition-all shadow-sm"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Trace Details</span>
          </button>
        </div>

        {/* ── Overlap & Coordination KPI grid (Replaced reviewer scores) ──── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile
            label="Pending Overlaps"
            value={metrics.pendingOverlaps}
            icon={Siren}
            color="bg-primary/20"
            sub="RB ∩ PGRC matches detected"
          />
          <KpiTile
            label="Unacknowledged Alerts"
            value={metrics.unacknowledgedAlerts}
            icon={AlertOctagon}
            color="bg-red-500/20"
            sub="Awaiting officer notice"
          />
          <KpiTile
            label="Overdue Cases"
            value={metrics.overdueCases}
            icon={Clock}
            color="bg-red-600/25"
            sub="Exceeded prescribed SLA"
          />
          <KpiTile
            label="Awaiting Officer Coordination"
            value={metrics.awaitingCoordination}
            icon={Activity}
            color="bg-primary/15"
            sub="Cross-bureau communication pending"
          />
        </div>

        {/* ── Main content: Activity Feed / Execution Logs ─────────────── */}
        <div className="glass-card overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-1.5">
              {[
                { id: "feed", label: "Activity Feed", icon: LayoutGrid },
                { id: "logs", label: "Ingestion & Match Logs", icon: List },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  id={`ai-tab-${id}`}
                  onClick={() => setView(id as "feed" | "logs")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                    view === id
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                      : "bg-secondary/40 border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {HAS_BACKEND ? "Live · polled every 4–5s" : "Live monitoring"}
            </span>
          </div>

          {/* Content */}
          <div className="p-4">
            {view === "feed" ? (
              <ActivityFeed sessionId={undefined} autoRefresh maxHeight="460px" />
            ) : (
              <LogStream logs={logs} />
            )}
          </div>
        </div>

      </div>

      {/* ── Trace Drawer ──────────────────────────────────── */}
      <ExplanationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sessionId={sessionId}
        title="Inter-Bureau Overlap Trace"
      />
    </AppLayout>
  );
}

// ── Seed logs focused on Case Overlap, Ingestion & Inter-Bureau Alerts ─────────────
function seedLogs(): WorkflowLog[] {
  const now = Date.now();
  const items: [string, string, string][] = [
    ["INFO", "ingestion",   "RB Bureau ingested case AICTE-2026-RB-0042 (Shri Ram Institute)"],
    ["ALERT", "overlap",    "Cross-match detected: Concurrent PGRC case AICTE-2026-PGRC-0089 on PID 1-109723481"],
    ["INFO", "notification","Overlap advisory notification dispatched to assigned officers"],
    ["INFO", "ingestion",   "PGRC ingested capitation fee grievance AICTE-2026-PGRC-0112"],
    ["ALERT", "overlap",    "Definite overlap detected with RB-0055 (Thakur College of Engineering)"],
    ["WARN", "crosscheck",  "SLA limit approaching for KL University complaint (AICTE-2026-PGRC-0034)"],
    ["INFO", "update",      "Inter-bureau case linkage recorded in database"],
  ];
  return items.map(([level, step, message], i) => ({
    ts: new Date(now - (items.length - i) * 4000).toISOString(),
    level, step, message,
  }));
}
