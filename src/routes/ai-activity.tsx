import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Brain, Activity, Cpu, Zap, FileText,
  ChevronRight, LayoutGrid, List, Eye, MessageSquare,
  Bot, Send, Loader2, Plus,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ExplanationDrawer } from "@/components/ExplanationDrawer";
import { api, HAS_BACKEND, tryApi, type WorkflowLog } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { VoiceInputButton, ReadAloudButton } from "@/components/VoiceControls";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-activity")({ component: AIActivity });

type Msg = { role: "user" | "assistant"; content: string; ts: number };
type Conversation = { id: string; title: string; messages: Msg[] };
const CHATS_KEY = "aicte_chats_v1";

function loadConvos(): Conversation[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CHATS_KEY) || "[]"); } catch { return []; }
}
function saveConvos(c: Conversation[]) { localStorage.setItem(CHATS_KEY, JSON.stringify(c)); }

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

// ── Agent pipeline status ──────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { label: "THINK",   color: "bg-red-500", text: "text-red-400",   desc: "Classify intent" },
  { label: "PLAN",    color: "bg-red-600",  text: "text-red-300",    desc: "Check context" },
  { label: "EXECUTE", color: "bg-rose-500",text: "text-rose-400",  desc: "Run policy" },
  { label: "REVIEW",  color: "bg-red-700",   text: "text-red-200",     desc: "Score result" },
  { label: "UPDATE",  color: "bg-red-800",   text: "text-red-100",     desc: "Store & notify" },
];

function PipelineBar({ activeStep = -1 }: { activeStep?: number }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {PIPELINE_STEPS.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1 shrink-0">
          <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-300 ${
            activeStep === i ? `${s.color}/20 border border-primary text-primary` : "bg-white/4 border border-transparent text-white/30"
          }`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeStep === i ? "text-primary" : "text-white/30"}`}>
              {s.label}
            </span>
            <span className="text-[9px] text-white/25">{s.desc}</span>
          </div>
          {i < PIPELINE_STEPS.length - 1 && (
            <div className={`w-4 h-px transition-colors ${activeStep > i ? "bg-primary" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Execution log (compact) ────────────────────────────────────────────────────
function LogStream({ logs }: { logs: WorkflowLog[] }) {
  const STEP_COLOR: Record<string, string> = {
    think: "text-red-400", plan: "text-rose-400", execute: "text-red-300",
    review: "text-primary", update: "text-red-200",
  };
  return (
    <ul className="space-y-0 max-h-[280px] overflow-auto scrollbar-thin font-mono text-xs">
      {logs.map((l, i) => (
        <li
          key={i}
          className="flex items-start gap-3 px-3 py-2 hover:bg-white/3 rounded-lg transition-colors"
          style={{ animation: "fadeSlideIn 0.2s ease-out both", animationDelay: `${i * 20}ms` }}
        >
          <span className="text-white/25 shrink-0 text-[10px] tabular-nums">
            {new Date(l.ts).toLocaleTimeString()}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase shrink-0 ${
            l.level === "ERROR" ? "bg-red-500/15 text-red-400" :
            l.level === "WARN"  ? "bg-amber-500/15 text-amber-400" :
            l.level === "STEP"  ? "bg-primary/20 text-primary" :
            "bg-red-500/10 text-red-300"
          }`}>{l.level}</span>
          <span className={`shrink-0 ${STEP_COLOR[l.step] || "text-white/40"}`}>{l.step}</span>
          <span className="text-white/60 break-all">{l.message}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function AIActivity() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkflowLog[]>(seedLogs());
  const [activeStep, setActiveStep] = useState(-1);
  const [view, setView] = useState<"assistant" | "feed" | "logs">("assistant");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [kpi, setKpi] = useState({ total: 0, approved: 0, pending: 0, rejected: 0, avgMs: 0 });

  // AI Assistant Chat State
  const [convos, setConvos] = useState<Conversation[]>(() => loadConvos());
  const [chatActiveId, setChatActiveId] = useState<string>(() => convos[0]?.id || "new");
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const activeConvo = convos.find((c) => c.id === chatActiveId);
  const chatMessages = activeConvo?.messages || [
    { role: "assistant" as const, content: `Hi ${user?.name || "Officer"} 👋 I am your AICTE Policy & Workflow Assistant. Ask me anything regarding AICTE regulatory norms, PGRC guidelines, case overlaps, or status queries.`, ts: Date.now() }
  ];

  useEffect(() => {
    if (view === "assistant") {
      chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [chatMessages.length, view]);

  const upsertChatMessage = (cid: string, m: Msg) => {
    setConvos((prev) => {
      let next = prev.slice();
      let i = next.findIndex((c) => c.id === cid);
      if (i < 0) { next.unshift({ id: cid, title: m.content.slice(0, 35), messages: [m] }); }
      else { next[i] = { ...next[i], messages: [...next[i].messages, m] }; }
      saveConvos(next); return next;
    });
  };

  const sendChatMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chatBusy) return;
    let cid = chatActiveId;
    if (cid === "new" || !activeConvo) {
      cid = "c-" + Date.now();
      setChatActiveId(cid);
      const seed: Conversation = { id: cid, title: trimmed.slice(0, 35), messages: [] };
      const n = [seed, ...convos]; setConvos(n); saveConvos(n);
    }
    upsertChatMessage(cid, { role: "user", content: trimmed, ts: Date.now() });
    setChatInput(""); setChatBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 650));
      upsertChatMessage(cid, {
        role: "assistant",
        content: `Regarding "${trimmed}": Under AICTE Regulations (PS26264 Integrated Framework), cases are cross-referenced across Regulation Bureau (RB) and PGRC to prevent parallel proceedings. You can review active institutional profiles in the Cases view.`,
        ts: Date.now()
      });
    } catch (err) {
      upsertChatMessage(cid, { role: "assistant", content: `⚠️ ${(err as Error).message}`, ts: Date.now() });
    } finally {
      setChatBusy(false);
    }
  };

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

  // Fetch KPI
  useEffect(() => {
    if (!HAS_BACKEND) return;
    tryApi(() => api.getKpiDashboard()).then((d) => {
      if (d) setKpi({
        total: d.total_requests,
        approved: d.approved,
        pending: d.pending,
        rejected: d.rejected,
        avgMs: Math.round(d.avg_response_seconds * 1000),
      });
    });
  }, []);

  // Animate pipeline steps from the latest STEP_TOKEN logs
  useEffect(() => {
    const stepLog = [...logs].reverse().find((l) => l.level === "STEP");
    if (!stepLog) return;
    const stepIdx = PIPELINE_STEPS.findIndex((s) => s.label === stepLog.step.toUpperCase());
    if (stepIdx >= 0) setActiveStep(stepIdx);
  }, [logs]);

  const sessionId = user ? `user_${user.id || user.email}` : "demo";

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500/20 to-red-950/40 grid place-items-center border border-primary/30 shadow-[0_0_15px_rgba(220,38,38,0.2)]">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Command Center</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                AICTE Autonomous Policy Assistant & Multi-Agent Oversight
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
            <span className="hidden sm:inline">AI Reasoning</span>
          </button>
        </div>

        {/* ── KPI grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile label="Total Requests" value={kpi.total || 142} icon={FileText} sub="All time" />
          <KpiTile label="Auto-Approved" value={kpi.approved || 128} icon={Zap} color="bg-primary/20" sub="Zero violation trace" />
          <KpiTile label="Pending Review" value={kpi.pending || 9} icon={Activity} color="bg-red-500/20" sub="In agent loop" />
          <KpiTile label="Avg Latency" value={`${kpi.avgMs || 1800}ms`} icon={Cpu} color="bg-primary/15" sub="End-to-end" />
        </div>

        {/* ── Pipeline visualization ───────────────────────────────────── */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Agent Pipeline</h2>
            <span className="text-[10px] text-muted-foreground">
              {activeStep >= 0 ? `Active: ${PIPELINE_STEPS[activeStep]?.label}` : "Idle"}
            </span>
          </div>
          <PipelineBar activeStep={activeStep} />
        </div>

        {/* ── Main content: Assistant / Activity Feed / Execution Logs ─────────────── */}
        <div className="glass-card overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-1.5">
              {[
                { id: "assistant", label: "AI Policy Assistant", icon: Bot },
                { id: "feed", label: "Activity Feed", icon: LayoutGrid },
                { id: "logs", label: "Execution Logs", icon: List },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  id={`ai-tab-${id}`}
                  onClick={() => setView(id as "assistant" | "feed" | "logs")}
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
              {HAS_BACKEND ? "Live · polled every 4–5s" : "Active session"}
            </span>
          </div>

          {/* Content */}
          <div className="p-0">
            {view === "assistant" && (
              <div className="h-[480px] flex bg-background/95 overflow-hidden">
                {/* Chat History Sidebar */}
                <aside className="w-56 border-r border-border/30 flex flex-col p-3 bg-secondary/10 shrink-0">
                  <button
                    onClick={() => {
                      const id = "c-" + Date.now();
                      const fresh: Conversation = {
                        id,
                        title: "New session",
                        messages: [{ role: "assistant", content: "How can I assist with AICTE policies or institutional complaint workflows?", ts: Date.now() }]
                      };
                      const next = [fresh, ...convos];
                      setConvos(next);
                      saveConvos(next);
                      setChatActiveId(id);
                    }}
                    className="mb-3 py-2 px-3 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer w-full text-xs shadow-md shadow-primary/20 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> New chat
                  </button>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-1.5 font-bold">History</div>
                  <ul className="flex-1 overflow-auto scrollbar-thin space-y-1">
                    {convos.length === 0 && <li className="text-xs text-muted-foreground px-2">No prior chats.</li>}
                    {convos.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => setChatActiveId(c.id)}
                          className={cn(
                            "w-full text-left px-2.5 py-1.5 text-xs truncate rounded-lg font-medium transition-colors",
                            c.id === chatActiveId
                              ? "bg-primary/15 text-primary border border-primary/25 font-semibold"
                              : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                          )}
                        >
                          {c.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </aside>

                {/* Main Chat Panel */}
                <section className="flex-1 flex flex-col overflow-hidden">
                  <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
                    {chatMessages.map((m, i) => (
                      <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                        {m.role === "assistant" && (
                          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 grid place-items-center shrink-0 mt-0.5">
                            <Bot className="w-3.5 h-3.5 text-primary" />
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed shadow-sm font-medium",
                          m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary/40 border border-border/30 text-foreground"
                        )}>
                          <div>{m.content}</div>
                          {m.role === "assistant" && (
                            <div className="flex justify-end mt-1.5">
                              <ReadAloudButton text={m.content} />
                            </div>
                          )}
                        </div>
                        {m.role === "user" && (
                          <div className="w-7 h-7 rounded-full bg-secondary border border-border/40 grid place-items-center shrink-0 font-bold text-xs mt-0.5">
                            {(user?.name || "U").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                    ))}
                    {chatBusy && (
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 grid place-items-center shrink-0">
                          <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                        </div>
                        <div className="bg-secondary/40 border border-border/30 rounded-2xl px-4 py-2 text-xs text-muted-foreground font-medium animate-pulse">
                          Consulting AICTE policy guidelines...
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); sendChatMessage(chatInput); }} className="p-3 border-t border-border/30 bg-card/20 flex gap-2 items-center">
                    <div className="flex items-center gap-2 flex-1">
                      <VoiceInputButton
                        onTranscript={(text) => setChatInput((prev) => prev ? prev + " " + text : text)}
                        disabled={chatBusy}
                      />
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask AICTE policy assistant about rules, case overlaps, or norms…"
                        className="flex-1 h-10 px-3.5 rounded-xl bg-background border border-border/40 text-sm input-glow focus:outline-none placeholder-muted-foreground/60"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={chatBusy || !chatInput.trim()}
                      className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 cursor-pointer shrink-0 shadow-md shadow-primary/20 text-xs"
                    >
                      <Send className="w-3.5 h-3.5" /> Send
                    </button>
                  </form>
                </section>
              </div>
            )}

            {view === "feed" && (
              <div className="p-4">
                <ActivityFeed sessionId={undefined} autoRefresh maxHeight="420px" />
              </div>
            )}

            {view === "logs" && (
              <div className="p-4">
                <LogStream logs={logs} />
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── AI Reasoning Trace Drawer ──────────────────────────────────── */}
      <ExplanationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sessionId={sessionId}
        title="Latest Request Trace"
      />
    </AppLayout>
  );
}

// ── Seed logs for no-backend mode ─────────────────────────────────────────────
function seedLogs(): WorkflowLog[] {
  const now = Date.now();
  const items: [string, string, string][] = [
    ["INFO", "think",   "ClassifierAgent → lab_booking (LAB204, 14:00)"],
    ["INFO", "plan",    "AcademicAgent → slot available, no exam conflict"],
    ["INFO", "execute", "PolicyAgent → APPROVED (slot free, no clash)"],
    ["INFO", "review",  "ReviewerAgent → score 9/10, passed"],
    ["INFO", "update",  "DB updated · notification queued · reply sent"],
    ["STEP", "think",   "STEP_TOKEN:think:active — new request incoming"],
    ["INFO", "execute", "PolicyAgent → ESCALATED (leave >3 days, OD)"],
    ["WARN", "review",  "ReviewerAgent → score 6/10, retry triggered"],
  ];
  return items.map(([level, step, message], i) => ({
    ts: new Date(now - (items.length - i) * 3500).toISOString(),
    level, step, message,
  }));
}
