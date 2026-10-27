/**
 * ExplanationDrawer.tsx — AI Reasoning Trace Drawer
 * Shows the full THINK → PLAN → EXECUTE → REVIEW → UPDATE chain
 * for any request. Opens as a right-side slide-in panel.
 */

import { useEffect, useState } from "react";
import {
  Brain, Lightbulb, Play, ClipboardCheck,
  RefreshCw, X, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  Zap, Star
} from "lucide-react";
import { api, tryApi, type AgentStep } from "@/lib/api";

// ── Step metadata ──────────────────────────────────────────────────────────────
const STEP_META: Record<string, { label: string; icon: React.FC<{ className?: string }>; color: string; bg: string }> = {
  THINK:   { label: "Think",   icon: Brain,         color: "text-red-400",  bg: "bg-red-500/15" },
  PLAN:    { label: "Plan",    icon: Lightbulb,     color: "text-rose-400", bg: "bg-rose-500/15"  },
  EXECUTE: { label: "Execute", icon: Play,          color: "text-red-300",  bg: "bg-red-600/15"},
  REVIEW:  { label: "Review",  icon: ClipboardCheck,color: "text-primary",  bg: "bg-primary/15"   },
  UPDATE:  { label: "Update",  icon: RefreshCw,     color: "text-red-200",  bg: "bg-red-800/15"   },
};

const STATUS_ICON: Record<string, React.FC<{ className?: string }>> = {
  done:    CheckCircle2,
  failed:  XCircle,
  running: Loader2,
};

// ── Payload viewer (collapsible JSON) ─────────────────────────────────────────
function PayloadBlock({ label, data }: { label: string; data: unknown }) {
  const [open, setOpen] = useState(false);
  const str = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  if (!str || str === "{}" || str === "null") return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {label}
      </button>
      {open && (
        <pre className="mt-1.5 p-2.5 rounded-lg bg-black/40 text-[10px] text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
          {str}
        </pre>
      )}
    </div>
  );
}

// ── Single step card ───────────────────────────────────────────────────────────
function StepCard({ step, index }: { step: AgentStep; index: number }) {
  const meta = STEP_META[step.step_type] || STEP_META.THINK;
  const Icon = meta.icon;
  const StatusIcon = STATUS_ICON[step.status] || CheckCircle2;
  const isRunning = step.status === "running";

  return (
    <div
      className="relative pl-8"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Timeline line */}
      <div className="absolute left-3 top-0 bottom-0 w-px bg-white/8" />

      {/* Step dot */}
      <div className={`absolute left-0.5 top-3 w-5 h-5 rounded-full ${meta.bg} grid place-items-center border border-white/10`}>
        <Icon className={`w-2.5 h-2.5 ${meta.color}`} />
      </div>

      <div className="pb-5">
        <div className="glass-card p-3.5 border border-white/8 rounded-xl hover:border-white/15 transition-colors">
          {/* Header row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.color}`}>
                {meta.label}
              </span>
              {step.agent_name && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40 font-mono">
                  {step.agent_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon
                className={`w-3.5 h-3.5 ${
                  step.status === "done" ? "text-emerald-400" :
                  step.status === "failed" ? "text-red-400" : "text-blue-400 animate-spin"
                }`}
              />
            </div>
          </div>

          {/* Output summary */}
          {step.output_payload && (
            <div className="text-[11px] text-white/60 leading-relaxed">
              {typeof step.output_payload === "string"
                ? step.output_payload
                : (step.output_payload as Record<string, unknown>).reason as string
                  || (step.output_payload as Record<string, unknown>).result as string
                  || (step.output_payload as Record<string, unknown>).chat_reply as string
                  || JSON.stringify(step.output_payload).slice(0, 120) + "…"}
            </div>
          )}

          {/* Expandable payloads */}
          <PayloadBlock label="Input" data={step.input_payload} />
          <PayloadBlock label="Output" data={step.output_payload} />

          {/* Timestamp */}
          <div className="mt-2 text-[9px] text-white/20 font-mono">
            {step.created_at ? new Date(step.created_at).toLocaleTimeString() : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mock seed data for when no backend ────────────────────────────────────────
function seedSteps(): AgentStep[] {
  const now = new Date().toISOString();
  return [
    { id: "1", request_id: "demo", session_id: "", step_type: "THINK",
      agent_name: "ClassifierAgent", score: 9, status: "done", created_at: now,
      input_payload: { query: "Book LAB204 tomorrow 2pm" },
      output_payload: { workflow_type: "lab_booking", lab_id: "LAB204", date: "2026-04-06", time_slot: "14:00-16:00" } },
    { id: "2", request_id: "demo", session_id: "", step_type: "PLAN",
      agent_name: "AcademicAgent", score: 8, status: "done", created_at: now,
      input_payload: { lab_id: "LAB204" },
      output_payload: { slot_available: true, resource_id: "LAB204" } },
    { id: "3", request_id: "demo", session_id: "", step_type: "EXECUTE",
      agent_name: "PolicyAgent", score: 9, status: "done", created_at: now,
      input_payload: { workflow_type: "lab_booking", lab_id: "LAB204" },
      output_payload: { result: "APPROVED", reason: "LAB204 is available on 2026-04-06 for 14:00-16:00. Booking confirmed.", alternatives: [] } },
    { id: "4", request_id: "demo", session_id: "", step_type: "REVIEW",
      agent_name: "ReviewerAgent", score: 9, status: "done", created_at: now,
      input_payload: {},
      output_payload: { overall_score: 9, passed: true, what_is_good: "Clean classification and policy match." } },
    { id: "5", request_id: "demo", session_id: "", step_type: "UPDATE",
      agent_name: "Executor", score: null, status: "done", created_at: now,
      input_payload: {},
      output_payload: { chat_reply: "LAB204 booked for tomorrow 2:00–4:00 PM. See you there!" } },
  ];
}

// ── Main Drawer ───────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  requestId?: string;
  title?: string;
}

export function ExplanationDrawer({ open, onClose, sessionId, requestId, title }: Props) {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    tryApi(() => api.getAgentSteps(sessionId, requestId)).then((data) => {
      setSteps(data && data.length ? data : seedSteps());
      setLoading(false);
    });
  }, [open, sessionId, requestId]);

  // Keyboard close
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md z-[201] flex flex-col
          bg-[#0c0e16] border-l border-white/10 shadow-2xl
          transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ boxShadow: "-8px 0 48px rgba(0,0,0,0.6)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-500/20 grid place-items-center">
              <Brain className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">AI Reasoning Trace</h2>
              <p className="text-[10px] text-white/40 mt-0.5">
                {title || "THINK → PLAN → EXECUTE → REVIEW → UPDATE"}
              </p>
            </div>
          </div>
          <button
            id="explanation-drawer-close"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 grid place-items-center text-white/50 hover:text-white transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stats bar */}
        {!loading && steps.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2.5 bg-white/3 border-b border-white/8 text-[10px] text-white/40 shrink-0">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              {steps.length} steps
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              {steps.filter((s) => s.status === "done").length} completed
            </span>
            {steps.some((s) => s.score !== null) && (
              <span className="flex items-center gap-1 ml-auto">
                <Star className="w-3 h-3 text-amber-400" />
                avg score{" "}
                {(
                  steps.filter((s) => s.score !== null).reduce((a, s) => a + (s.score || 0), 0) /
                  steps.filter((s) => s.score !== null).length
                ).toFixed(1)}
              </span>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-white/30">
              <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
              <p className="text-sm">Loading reasoning trace…</p>
            </div>
          ) : steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-white/30">
              <Brain className="w-8 h-8 opacity-30" />
              <p className="text-sm">No agent steps recorded yet</p>
            </div>
          ) : (
            steps.map((step, i) => <StepCard key={step.id} step={step} index={i} />)
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/8 shrink-0 text-[10px] text-white/25 text-center">
          CampusGPT OS · Multi-Agent Kernel v2 · {steps.length} trace steps
        </div>
      </div>
    </>
  );
}
