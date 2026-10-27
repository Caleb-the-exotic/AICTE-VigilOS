import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertTriangle, Building2, CheckCircle2, Clock, Download,
  FileText, Filter, Gavel, GitMerge, Globe, Layers,
  RefreshCw, Search, Shield, Siren, TrendingUp, Users,
  X, ChevronRight, ChevronLeft, ArrowUpRight, Eye, AlertOctagon,
  BarChart3, MapPin, Calendar, Link2, Zap, Info, Loader2,
  Plus, Mail, Phone, Edit3, Trash2,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { HAS_BACKEND, API_BASE_URL, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { exportCasesAsPdf } from "@/lib/pdf-export";
import { getInstitutionByPid, getStoredInstitutions } from "@/lib/institutions";

export const Route = createFileRoute("/cases")({ component: CasesDashboard });

// ── Types ────────────────────────────────────────────────────────
type Bureau = "RB" | "PGRC" | "RO" | "ALL";
type CaseStatus = "received" | "under_process" | "transferred" | "escalated" | "disposed" | "ALL";

interface AICTECase {
  case_id: string;
  aicte_pid: string;
  institution_code?: string;
  institution_name: string;
  region: string;
  bureau: string;
  complainant_user_id?: string;
  complainant_name?: string;
  complainant_email?: string;
  complainant_type: string;
  category: string;
  title: string;
  description: string;
  assigned_officer: string;
  status: string;
  sla_days: number;
  sla_deadline: string;
  received_at?: string;
  resolved_at?: string;
  disposed_at?: string;
  created_at: string;
  updated_at?: string;
  ageing_days?: number;
  sla_breached?: boolean;
}

interface Institution {
  aicte_pid: string;
  institution_name: string;
  region: string;
  state: string;
  inst_type: string;
  total_cases: number;
  active_cases: number;
  has_overlap: boolean;
}

interface KPIs {
  total: number;
  received: number;
  under_process: number;
  transferred: number;
  escalated: number;
  disposed: number;
  sla_breached: number;
  overlapping_institutions: number;
  by_bureau: { RB: number; PGRC: number; RO: number };
}

// ── Mock data for fallback mode ──────────────────────────────
function mockKpis(): KPIs {
  return {
    total: 10, received: 3, under_process: 4, transferred: 1,
    escalated: 1, disposed: 1, sla_breached: 1, overlapping_institutions: 2,
    by_bureau: { RB: 4, PGRC: 5, RO: 1 },
  };
}

function mockCases(): AICTECase[] {
  const now = new Date();
  const d = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
  const dl = (days: number) => new Date(now.getTime() + days * 86400000).toISOString();
  const rawList: AICTECase[] = [
    { case_id: "AICTE-2026-PGRC-0112", aicte_pid: "1-376234110", institution_code: "1-376234110", institution_name: "Thakur College of Engineering", region: "Western", bureau: "PGRC", complainant_name: "Amit Deshmukh", complainant_email: "amit.deshmukh24@gmail.com", complainant_type: "Student", category: "Capitation Fee", title: "Capitation fee demand from admitted students", description: "Students asked to pay additional ₹50,000 as 'development fee'.", assigned_officer: "Dr. Anita Sharma (PGRC)", status: "received", sla_days: 30, sla_deadline: dl(22), created_at: d(8), received_at: d(8), ageing_days: 8, sla_breached: false },
    { case_id: "AICTE-2026-RB-0042", aicte_pid: "1-109723481", institution_code: "1-109723481", institution_name: "Shri Ram Institute of Technology", region: "Northern", bureau: "RB", complainant_name: "Dr. K.V. Ramanathan", complainant_email: "kv.ramanathan@academic-council.org", complainant_type: "Stakeholder", category: "Faculty Deficiency", title: "Faculty cadre ratio non-compliance — insufficient PhD-qualified faculty", description: "Inspection reveals faculty cadre ratio below AICTE norms.", assigned_officer: "Dr. Ramesh Gupta (RB)", status: "under_process", sla_days: 45, sla_deadline: dl(33), created_at: d(12), received_at: d(12), ageing_days: 12, sla_breached: false },
    { case_id: "AICTE-2026-PGRC-0089", aicte_pid: "1-109723481", institution_code: "1-109723481", institution_name: "Shri Ram Institute of Technology", region: "Northern", bureau: "PGRC", complainant_name: "Prof. Sunita Sharma", complainant_email: "sunita.sharma.faculty@gmail.com", complainant_type: "Faculty", category: "Non-payment of Salary", title: "Non-payment of faculty salary for 4 consecutive months", description: "Multiple faculty members filed grievances regarding non-payment.", assigned_officer: "Ms. Priya Verma (PGRC)", status: "escalated", sla_days: 30, sla_deadline: dl(22), created_at: d(8), received_at: d(8), ageing_days: 8, sla_breached: false },
    { case_id: "AICTE-2026-RB-0055", aicte_pid: "1-376234110", institution_code: "1-376234110", institution_name: "Thakur College of Engineering", region: "Western", bureau: "RB", complainant_name: "Rajesh V. Patil", complainant_email: "rajesh.patil.pta@gmail.com", complainant_type: "Stakeholder", category: "Fee Regulation Violation", title: "Excess fee collection beyond AICTE approved fee structure", description: "Fees collected beyond the AICTE approved structure for 2026-27.", assigned_officer: "Mr. Suresh Iyer (RB)", status: "under_process", sla_days: 30, sla_deadline: dl(25), created_at: d(5), received_at: d(5), ageing_days: 5, sla_breached: false },
    { case_id: "AICTE-2026-PGRC-0034", aicte_pid: "1-204561892", institution_code: "1-204561892", institution_name: "KL University", region: "Southern", bureau: "PGRC", complainant_name: "K. Sai Praneeth", complainant_email: "sai.praneeth.k@gmail.com", complainant_type: "Student", category: "Ragging", title: "Ragging complaint — senior students intimidating juniors in hostel", description: "Multiple juniors reported systematic ragging in hostel.", assigned_officer: "Ms. Kavita Singh (PGRC)", status: "escalated", sla_days: 30, sla_deadline: d(1), created_at: d(31), received_at: d(31), ageing_days: 31, sla_breached: true },
    { case_id: "AICTE-2026-RB-0021", aicte_pid: "1-445871203", institution_code: "1-445871203", institution_name: "Kalinga Institute of Technology", region: "Eastern", bureau: "RB", complainant_name: "Subhash Chandra Mohanty", complainant_email: "sc.mohanty@odisha-edu-vigil.in", complainant_type: "Public", category: "Infrastructure Deficiency", title: "Laboratory equipment deficiency — below AICTE norms", description: "EVC inspection revealed laboratories lacking minimum equipment.", assigned_officer: "Mr. Deepak Nair (RB)", status: "disposed", sla_days: 60, sla_deadline: d(15), created_at: d(75), received_at: d(75), resolved_at: d(15), ageing_days: 60, sla_breached: false },
    { case_id: "AICTE-2026-PGRC-0078", aicte_pid: "1-512398067", institution_code: "1-512398067", institution_name: "SRM Institute of Science and Technology", region: "Southern", bureau: "PGRC", complainant_name: "Dr. M. Senthil Kumar", complainant_email: "m.senthil.chem@gmail.com", complainant_type: "Faculty", category: "Service Matters", title: "Wrongful termination of contractual faculty", description: "26 contractual faculty terminated without notice.", assigned_officer: "Dr. Ravi Kumar (PGRC)", status: "under_process", sla_days: 45, sla_deadline: dl(27), created_at: d(18), received_at: d(18), ageing_days: 18, sla_breached: false },
    { case_id: "AICTE-2026-RO-0016", aicte_pid: "1-631047285", institution_code: "1-631047285", institution_name: "GLA University", region: "Northern", bureau: "RO", complainant_name: "Virendra Singh Rawat", complainant_email: "virendra.rawat.up@gmail.com", complainant_type: "Stakeholder", category: "Admissions Irregularity", title: "Over-admission beyond sanctioned intake in B.Tech CSE", description: "340 students admitted against sanctioned intake of 240.", assigned_officer: "RO Northern Cell", status: "transferred", sla_days: 30, sla_deadline: dl(8), created_at: d(22), received_at: d(22), ageing_days: 22, sla_breached: false },
    { case_id: "AICTE-2026-PGRC-0145", aicte_pid: "1-788234501", institution_code: "1-788234501", institution_name: "Amity University Rajasthan", region: "Northern", bureau: "PGRC", complainant_name: "Harshwardhan Rathore", complainant_email: "h.rathore2026@gmail.com", complainant_type: "Student", category: "Academic Issues", title: "Examinations conducted without prescribed syllabus coverage", description: "End-semester exams conducted with questions outside AICTE model curriculum.", assigned_officer: "Ms. Shweta Patel (PGRC)", status: "received", sla_days: 30, sla_deadline: dl(27), created_at: d(3), received_at: d(3), ageing_days: 3, sla_breached: false },
    { case_id: "AICTE-2026-RB-0071", aicte_pid: "1-923456789", institution_code: "1-923456789", institution_name: "Chandigarh University", region: "Northern", bureau: "RB", complainant_name: "Gurpreet Singh Gill", complainant_email: "gurpreet.gill.punjab@gmail.com", complainant_type: "Stakeholder", category: "Faculty Deficiency", title: "Insufficient visiting faculty against permanent positions", description: "60% teaching load handled by visiting faculty.", assigned_officer: "Mr. Arvind Mehta (RB)", status: "under_process", sla_days: 45, sla_deadline: dl(31), created_at: d(14), received_at: d(14), ageing_days: 14, sla_breached: false },
  ];
  return rawList.map(c => {
    const inst = getInstitutionByPid(c.aicte_pid);
    return {
      ...c,
      institution_name: inst.institution_name,
      institution_code: c.institution_code || c.aicte_pid,
      region: inst.region,
    };
  });
}

// ── Helpers ──────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  received:      { label: "Received",      color: "bg-red-950/40 text-red-300 border-red-500/30",   dot: "bg-red-400" },
  under_process: { label: "Under Process", color: "bg-primary/15 text-primary border-primary/30", dot: "bg-primary" },
  transferred:   { label: "Transferred",   color: "bg-rose-950/40 text-rose-300 border-rose-500/30", dot: "bg-rose-400" },
  escalated:     { label: "Escalated",     color: "bg-red-600/25 text-red-200 border-red-500/50 shadow-sm", dot: "bg-red-500 animate-pulse" },
  disposed:      { label: "Disposed",      color: "bg-neutral-800 text-neutral-300 border-neutral-700", dot: "bg-neutral-400" },
};

const BUREAU_CONFIG: Record<string, { color: string; bg: string }> = {
  RB:   { color: "text-red-300", bg: "bg-red-500/20 border border-red-500/30" },
  PGRC: { color: "text-rose-300", bg: "bg-rose-500/20 border border-rose-500/30" },
  RO:   { color: "text-red-200", bg: "bg-red-950/60 border border-red-800/40" },
};

function BureauBadge({ bureau }: { bureau: string }) {
  const cfg = BUREAU_CONFIG[bureau] || { color: "text-white/60", bg: "bg-white/10 border border-white/10" };
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest", cfg.bg, cfg.color)}>{bureau}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "bg-white/10 text-white/60 border-white/10", dot: "bg-white/40" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border", cfg.color)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── KPI Tile ──────────────────────────────────────────────────────
function KpiTile({ label, value, icon: Icon, color, pulse, sub }: {
  label: string; value: number | string; icon: React.FC<{ className?: string }>;
  color?: string; pulse?: boolean; sub?: string;
}) {
  return (
    <div className="glass-card p-4 flex flex-col gap-2 hover:border-white/20 transition-all duration-200 group relative overflow-hidden">
      {pulse && (
        <div className="absolute inset-0 rounded-xl bg-red-500/5 animate-pulse pointer-events-none" />
      )}
      <div className="flex items-center justify-between relative z-10">
        <div className={cn("w-8 h-8 rounded-lg grid place-items-center", color || "bg-primary/15")}>
          <Icon className={cn("w-4 h-4", color ? "text-white" : "text-primary")} />
        </div>
        <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-white/50 transition-colors" />
      </div>
      <div className="relative z-10">
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-white/25 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Overlap Alert Card ────────────────────────────────────────────
function OverlapAlertCard({
  institutionName, aictePid, region, rbCases, pgrcCases, analysis, onViewProfile
}: {
  institutionName: string; aictePid: string; region: string;
  rbCases: AICTECase[]; pgrcCases: AICTECase[];
  analysis?: { overlap_score: number; overlap_type: string; shared_root_cause: string; recommended_action: string; reason: string };
  onViewProfile: (pid: string) => void;
}) {
  const score = analysis?.overlap_score ?? 0.88;
  const isHigh = score >= 0.7;

  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3 transition-all hover:scale-[1.01]",
      isHigh
        ? "bg-red-950/20 border-primary/40 shadow-lg shadow-red-900/10"
        : "bg-red-950/10 border-red-500/25"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 grid place-items-center shrink-0">
            <Siren className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div>
            <div className="font-semibold text-sm text-white">{institutionName}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-primary/80 font-mono">{aictePid}</span>
              <span className="text-white/20">·</span>
              <span className="text-[10px] text-muted-foreground">{region} Region</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="text-[10px] font-bold text-primary bg-primary/15 border border-primary/30 px-2 py-0.5 rounded-full">
            {Math.round(score * 100)}% overlap
          </div>
        </div>
      </div>

      {/* Case pills */}
      <div className="flex flex-wrap gap-2">
        {rbCases.map(c => (
          <div key={c.case_id} className="flex items-center gap-1.5 bg-red-950/30 border border-red-500/20 rounded-lg px-2.5 py-1.5">
            <BureauBadge bureau="RB" />
            <span className="text-[10px] text-white/70 font-mono">{c.case_id}</span>
            <StatusBadge status={c.status} />
          </div>
        ))}
        {pgrcCases.map(c => (
          <div key={c.case_id} className="flex items-center gap-1.5 bg-rose-950/30 border border-rose-500/20 rounded-lg px-2.5 py-1.5">
            <BureauBadge bureau="PGRC" />
            <span className="text-[10px] text-white/70 font-mono">{c.case_id}</span>
            <StatusBadge status={c.status} />
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1 flex-wrap">
        <button
          onClick={() => onViewProfile(aictePid)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/40 text-xs text-white/80 hover:bg-secondary hover:text-white transition-all"
        >
          <Eye className="w-3.5 h-3.5" /> View Institutional Profile
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-xs text-primary hover:bg-primary/25 transition-all">
          <Link2 className="w-3.5 h-3.5" /> Link Cases
        </button>
      </div>
    </div>
  );
}

// ── Case Table Row (Exact required column specification) ──
// ── Case Table Row (Exact required column specification) ──
function CaseRow({ 
  c, 
  onView, 
  onViewProfile,
  onEdit,
  onDelete,
  canManage,
}: { 
  c: AICTECase; 
  onView: (c: AICTECase) => void;
  onViewProfile: (pid: string) => void;
  onEdit?: (c: AICTECase) => void;
  onDelete?: (caseId: string) => void;
  canManage?: boolean;
}) {
  return (
    <tr
      className="border-b border-border/20 hover:bg-white/3 cursor-pointer transition-colors group"
      onClick={() => onView(c)}
    >
      {/* 1. Case ID */}
      <td className="px-3 py-3">
        <span className="text-[11px] font-mono font-semibold text-primary/90">{c.case_id}</span>
      </td>

      {/* 2. Institution */}
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewProfile(c.aicte_pid);
          }}
          className="text-xs font-semibold text-white/90 max-w-[200px] truncate hover:text-primary transition-colors hover:underline text-left cursor-pointer block"
          title="Click to view institution profile"
        >
          {c.institution_name}
        </button>
      </td>

      {/* 3. Institution Code */}
      <td className="px-3 py-3">
        <span className="text-[11px] font-mono text-muted-foreground">{c.institution_code || c.aicte_pid}</span>
      </td>

      {/* 4. Bureau */}
      <td className="px-3 py-3"><BureauBadge bureau={c.bureau} /></td>

      {/* 5. Category */}
      <td className="px-3 py-3">
        <span className="text-[11px] text-white/80">{c.category}</span>
      </td>

      {/* 6. Status */}
      <td className="px-3 py-3"><StatusBadge status={c.status} /></td>

      {/* 7. Ageing */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-[11px] tabular-nums font-medium", c.sla_breached ? "text-red-400 font-bold" : "text-white/70")}>
            {c.ageing_days ?? 0}d
          </span>
          {c.sla_breached && <AlertOctagon className="w-3 h-3 text-red-400 animate-pulse" />}
        </div>
      </td>

      {/* 8. Region */}
      <td className="px-3 py-3">
        <span className="text-[11px] text-muted-foreground">{c.region}</span>
      </td>

      {/* 9. Actions (Edit & Delete for roles above Nodal Officer, View Details) */}
      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5">
          {canManage && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(c)}
              className="p-1 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/25 text-primary cursor-pointer transition-all active:scale-95"
              title="Edit Case details"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
          {canManage && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(c.case_id)}
              className="p-1 rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive/25 text-destructive cursor-pointer transition-all active:scale-95"
              title="Delete Case from database"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onView(c)}
            className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title="View Case Overview"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Institution Profile Drawer (Sliding from Right with Campus Photos) ──
function InstitutionDrawer({ pid, onClose, liveCases }: { pid: string; onClose: () => void; liveCases?: AICTECase[] }) {
  const profile = useMemo(() => getInstitutionByPid(pid), [pid]);
  const cases = useMemo(() => {
    if (liveCases && liveCases.length > 0) {
      return liveCases.filter(c => c.aicte_pid === pid);
    }
    return mockCases().filter(c => c.aicte_pid === pid);
  }, [pid, liveCases]);
  const [activePhoto, setActivePhoto] = useState(0);

  const rbCases = cases.filter(c => c.bureau === "RB");
  const pgrcCases = cases.filter(c => c.bureau === "PGRC");
  const roCases = cases.filter(c => c.bureau === "RO");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      {/* Sliding Drawer Container */}
      <div className="relative w-full max-w-2xl bg-card border-l border-border/40 h-full overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 ease-out z-10">
        
        {/* Banner with Campus Image */}
        <div className="relative h-48 sm:h-56 w-full bg-secondary/80 overflow-hidden shrink-0">
          <img
            src={profile.images[activePhoto] || profile.images[0] || "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1000&q=80"}
            alt={profile.institution_name}
            className="w-full h-full object-cover transition-all duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />

          {/* Close button */}
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 rounded-xl bg-black/60 hover:bg-black/85 border border-white/20 text-white transition-all cursor-pointer backdrop-blur-md shadow-md"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Banner bottom info */}
          <div className="absolute bottom-3 left-5 right-5 flex items-end justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary text-primary-foreground shadow-xs">
                {profile.inst_type}
              </span>
              <h2 className="font-bold text-xl sm:text-2xl text-white mt-1 drop-shadow-md leading-tight">{profile.institution_name}</h2>
              <div className="flex items-center gap-2 text-xs text-white/90 mt-0.5">
                <span className="font-mono text-primary font-bold">{pid}</span>
                <span>·</span>
                <span>{profile.city}, {profile.state} ({profile.region} Region)</span>
              </div>
            </div>
            <span className="text-[10px] font-semibold bg-black/60 backdrop-blur-md border border-white/25 text-white/95 px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
              {profile.approval_status}
            </span>
          </div>
        </div>

        {/* Drawer Body Content */}
        <div className="p-5 space-y-5 flex-1">
          {/* Photo Gallery Selector */}
          {profile.images && profile.images.length > 1 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" /> Campus Infrastructure Gallery
              </div>
              <div className="grid grid-cols-3 gap-2">
                {profile.images.map((imgUrl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActivePhoto(i)}
                    className={cn(
                      "relative aspect-video rounded-xl overflow-hidden border transition-all cursor-pointer",
                      activePhoto === i ? "border-primary ring-2 ring-primary/40" : "border-border/40 hover:border-white/40 opacity-75 hover:opacity-100"
                    )}
                  >
                    <img src={imgUrl} alt={`Campus photo ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Institutional Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="glass-card p-3">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Principal / Head</span>
              <span className="text-white font-medium mt-0.5 block truncate">{profile.principal_name}</span>
            </div>
            <div className="glass-card p-3">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Established</span>
              <span className="text-white font-medium mt-0.5 block">{profile.established_year}</span>
            </div>
            <div className="glass-card p-3">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Faculty Members</span>
              <span className="text-white font-medium mt-0.5 block tabular-nums">{profile.total_faculty}</span>
            </div>
            <div className="glass-card p-3">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Enrolled Students</span>
              <span className="text-white font-medium mt-0.5 block tabular-nums">{profile.total_students}</span>
            </div>
          </div>

          {/* Contact & Address Card */}
          <div className="glass-card p-3.5 space-y-1.5 text-xs text-white/80">
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span>{profile.address}</span>
            </div>
            <div className="flex items-center gap-4 flex-wrap pt-1 text-muted-foreground">
              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-primary" /> {profile.contact_email}</span>
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-primary" /> {profile.contact_phone}</span>
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1.5 font-medium">
                  <Globe className="w-3.5 h-3.5" /> Visit Website
                </a>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Total Cases", value: cases.length, color: "text-white" },
              { label: "Active", value: cases.filter(c => c.status !== "disposed").length, color: "text-red-400" },
              { label: "Disposed", value: cases.filter(c => c.status === "disposed").length, color: "text-white/60" },
            ].map(s => (
              <div key={s.label} className="glass-card p-3 text-center">
                <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Split timeline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* RB Cases */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BureauBadge bureau="RB" />
                <span className="text-[11px] text-muted-foreground font-semibold">Regulation Bureau</span>
              </div>
              <div className="space-y-2">
                {rbCases.length === 0 && <div className="text-[11px] text-white/30 py-2">No active RB cases</div>}
                {rbCases.map(c => (
                  <div key={c.case_id} className="bg-red-500/5 border border-red-500/20 rounded-lg p-2.5">
                    <div className="text-[10px] font-mono text-red-300/80">{c.case_id}</div>
                    <div className="text-xs font-medium text-white/80 mt-0.5 leading-tight">{c.title}</div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <StatusBadge status={c.status} />
                      <span className="text-[10px] text-white/30">{c.ageing_days}d</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* PGRC Cases */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BureauBadge bureau="PGRC" />
                <span className="text-[11px] text-muted-foreground font-semibold">Grievance Cell</span>
              </div>
              <div className="space-y-2">
                {pgrcCases.length === 0 && <div className="text-[11px] text-white/30 py-2">No active PGRC cases</div>}
                {pgrcCases.map(c => (
                  <div key={c.case_id} className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-2.5">
                    <div className="text-[10px] font-mono text-rose-300/80">{c.case_id}</div>
                    <div className="text-xs font-medium text-white/80 mt-0.5 leading-tight">{c.title}</div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <StatusBadge status={c.status} />
                      <span className="text-[10px] text-white/30">{c.ageing_days}d</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RO cases if any */}
          {roCases.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BureauBadge bureau="RO" />
                <span className="text-[11px] text-muted-foreground font-semibold">Regional Office</span>
              </div>
              <div className="space-y-2">
                {roCases.map(c => (
                  <div key={c.case_id} className="bg-white/5 border border-white/10 rounded-lg p-2.5">
                    <div className="text-[10px] font-mono text-white/50">{c.case_id}</div>
                    <div className="text-xs font-medium text-white/80 mt-0.5">{c.title}</div>
                    <div className="mt-1.5"><StatusBadge status={c.status} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Joint action buttons */}
          <div className="border-t border-border/30 pt-4 space-y-2">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest">Joint Actions</div>
            <div className="flex flex-wrap gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-xs text-primary hover:bg-primary/25 transition-all cursor-pointer">
                <Link2 className="w-3.5 h-3.5" /> Link Cases
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 border border-border/40 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer">
                <Shield className="w-3.5 h-3.5" /> Consolidate under RB
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard Component ──────────────────────────────────────
function CasesDashboard() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [kpi, setKpi] = useState<KPIs>(mockKpis());
  const [cases, setCases] = useState<AICTECase[]>(mockCases());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [bureauFilter, setBureauFilter] = useState<Bureau>("ALL");
  const [statusFilter, setStatusFilter] = useState<CaseStatus>("ALL");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [searchQ, setSearchQ] = useState("");

  // Views
  const [activeTab, setActiveTab] = useState<"cases" | "overlaps" | "institutions" | "analytics">("cases");
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<AICTECase | null>(null);

  // Authoritative permissions: roles above Nodal Officer
  const canManageCases = ["super_admin", "bureau_head", "approval_officer"].includes(user?.role || "");

  // Responsive Pagination (10 per page on desktop, 5 per page on Android/mobile)
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const pageSize = isMobile ? 5 : 10;
  const [casePage, setCasePage] = useState(1);

  // Edit Case State & Handlers
  const [editingCase, setEditingCase] = useState<AICTECase | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("General Grievance");
  const [editBureau, setEditBureau] = useState("RB");
  const [editStatus, setEditStatus] = useState("under_process");
  const [editAssignedOfficer, setEditAssignedOfficer] = useState("");
  const [editSlaDays, setEditSlaDays] = useState(30);
  const [isSavingCase, setIsSavingCase] = useState(false);

  useEffect(() => {
    if (editingCase) {
      setEditTitle(editingCase.title || "");
      setEditDescription(editingCase.description || "");
      setEditCategory(editingCase.category || "General Grievance");
      setEditBureau(editingCase.bureau || "RB");
      setEditStatus(editingCase.status || "under_process");
      setEditAssignedOfficer(editingCase.assigned_officer || "");
      setEditSlaDays(editingCase.sla_days || 30);
    }
  }, [editingCase]);

  const handleSaveCaseEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCase) return;
    setIsSavingCase(true);
    try {
      if (HAS_BACKEND) {
        await api.updateCase(editingCase.case_id, {
          title: editTitle.trim(),
          description: editDescription.trim(),
          category: editCategory,
          bureau: editBureau,
          status: editStatus,
          assigned_officer: editAssignedOfficer.trim(),
          sla_days: Number(editSlaDays) || 30,
        });
      }
      setCases(prev => prev.map(c => c.case_id === editingCase.case_id ? {
        ...c,
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory,
        bureau: editBureau,
        status: editStatus,
        assigned_officer: editAssignedOfficer.trim(),
        sla_days: Number(editSlaDays) || 30,
      } : c));
      toast.success(`Case ${editingCase.case_id} updated successfully.`);
      setEditingCase(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update case");
    } finally {
      setIsSavingCase(false);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete case ${caseId}? This action cannot be undone.`)) {
      return;
    }
    try {
      if (HAS_BACKEND) {
        await api.deleteCase(caseId);
      }
      setCases(prev => prev.filter(c => c.case_id !== caseId));
      if (selectedCase?.case_id === caseId) setSelectedCase(null);
      toast.success(`Case ${caseId} deleted from database.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete case");
    }
  };

  // Fetch from backend
  const fetchData = useCallback(async () => {
    if (!HAS_BACKEND) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("aicte_token") || "";
      const headers = { Authorization: `Bearer ${token}` };
      const [kpiRes, casesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/aicte/kpi`, { headers }),
        fetch(`${API_BASE_URL}/api/aicte/cases`, { headers }),
      ]);
      if (kpiRes.ok) setKpi(await kpiRes.json());
      if (casesRes.ok) setCases(await casesRes.json());
    } catch (e) {
      /* falls back to mock data */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Re-sync cases from database when institution profiles or complaints are updated
  useEffect(() => {
    const handleUpdate = () => {
      fetchData();
    };
    window.addEventListener("aicte_institution_updated", handleUpdate);
    window.addEventListener("aicte_case_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("aicte_institution_updated", handleUpdate);
      window.removeEventListener("aicte_case_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [fetchData]);

  // File Complaint state
  const [isFilingModalOpen, setIsFilingModalOpen] = useState(false);
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    aicte_pid: "1-376234110",
    bureau: "PGRC",
    category: "Capitation Fee",
    title: "",
    description: "",
    complainant_type: "Student",
  });

  const availableInstitutions = useMemo(() => getStoredInstitutions(), []);

  const handleFileComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintForm.title.trim()) {
      toast.error("Please enter a complaint title or subject.");
      return;
    }
    setSubmittingComplaint(true);
    try {
      const res = await api.createCase({
        aicte_pid: complaintForm.aicte_pid,
        bureau: complaintForm.bureau,
        category: complaintForm.category,
        title: complaintForm.title,
        description: complaintForm.description,
        complainant_type: complaintForm.complainant_type,
      });
      if (res && res.ok) {
        toast.success(`Complaint registered successfully! Case Reference: ${res.case_id}`);
        setIsFilingModalOpen(false);
        setComplaintForm({
          aicte_pid: "1-376234110",
          bureau: "PGRC",
          category: "Capitation Fee",
          title: "",
          description: "",
          complainant_type: "Student",
        });
        await fetchData();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("aicte_case_updated"));
        }
      } else {
        toast.error("Failed to register complaint. Database rejected the transaction.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit complaint to backend.");
    } finally {
      setSubmittingComplaint(false);
    }
  };

  // Derived filtered cases
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      if (bureauFilter !== "ALL" && c.bureau !== bureauFilter) return false;
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (regionFilter !== "ALL" && c.region !== regionFilter) return false;
      if (searchQ.trim()) {
        const q = searchQ.toLowerCase();
        if (!c.case_id.toLowerCase().includes(q) &&
            !c.institution_name.toLowerCase().includes(q) &&
            !c.aicte_pid.toLowerCase().includes(q) &&
            !c.category.toLowerCase().includes(q) &&
            !c.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [cases, bureauFilter, statusFilter, regionFilter, searchQ]);

  // Reset case page on filter changes
  useEffect(() => {
    setCasePage(1);
  }, [bureauFilter, statusFilter, regionFilter, searchQ]);

  const totalCasesCount = filteredCases.length;
  const totalCasePages = Math.max(1, Math.ceil(totalCasesCount / pageSize));
  const startCaseIndex = totalCasesCount === 0 ? 0 : (casePage - 1) * pageSize + 1;
  const endCaseIndex = Math.min(casePage * pageSize, totalCasesCount);
  const paginatedCases = useMemo(
    () => filteredCases.slice((casePage - 1) * pageSize, casePage * pageSize),
    [filteredCases, casePage, pageSize]
  );

  // Overlap institutions (cases with both RB and PGRC)
  const overlapInstitutions = useMemo(() => {
    const byPid: Record<string, AICTECase[]> = {};
    cases.forEach(c => {
      if (!byPid[c.aicte_pid]) byPid[c.aicte_pid] = [];
      byPid[c.aicte_pid].push(c);
    });
    return Object.entries(byPid)
      .filter(([, cs]) => {
        const active = cs.filter(c => c.status !== "disposed");
        return active.some(c => c.bureau === "RB") && active.some(c => c.bureau === "PGRC");
      })
      .map(([pid, cs]) => ({
        pid, cs,
        rb: cs.filter(c => c.bureau === "RB" && c.status !== "disposed"),
        pgrc: cs.filter(c => c.bureau === "PGRC" && c.status !== "disposed"),
        name: cs[0]?.institution_name ?? pid,
        region: cs[0]?.region ?? "—",
      }));
  }, [cases]);

  // Ageing distribution for analytics
  const ageingBuckets = useMemo(() => {
    const active = cases.filter(c => c.status !== "disposed");
    const lt15 = active.filter(c => (c.ageing_days ?? 0) < 15).length;
    const mid = active.filter(c => (c.ageing_days ?? 0) >= 15 && (c.ageing_days ?? 0) <= 30).length;
    const gt30 = active.filter(c => (c.ageing_days ?? 0) > 30).length;
    return [
      { label: "< 15 days", count: lt15, color: "bg-white/40" },
      { label: "15–30 days", count: mid, color: "bg-rose-500" },
      { label: "> 30 days", count: gt30, color: "bg-red-500" },
    ];
  }, [cases]);

  const REGIONS = useMemo(() => ["ALL", ...Array.from(new Set(cases.map(c => c.region))).sort()], [cases]);

  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      await exportCasesAsPdf({
        cases: filteredCases,
        bureauFilter,
        statusFilter,
        regionFilter,
        searchQ,
        userName: user?.name || "Officer",
        userRole: user?.role || "super_admin",
        userBureau: user?.bureau || "National Portal",
        userRegion: user?.region || "HQ (New Delhi)",
      });
    } catch (err: any) {
      toast.error("Export failed: " + (err?.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  }, [filteredCases, bureauFilter, statusFilter, regionFilter, searchQ, user]);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Page Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600/30 to-red-500/20 grid place-items-center border border-red-500/30">
              <Gavel className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AICTE Complaint Dashboard</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                PS26264 · Integrated Monitoring — RB · PGRC · Regional Offices
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!HAS_BACKEND && (
              <span className="text-[10px] bg-white/10 text-white/60 border border-white/15 px-2 py-1 rounded-full">
                Demo Mode
              </span>
            )}
            <button
              id="file-complaint-btn"
              onClick={() => setIsFilingModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-900/30 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              File Complaint
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10 transition-all"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              Refresh
            </button>
            <button
              id="export-cases-btn"
              onClick={handleExportPdf}
              disabled={exporting}
              title="Export current filtered cases list as official AICTE PDF report"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/25 text-xs text-primary hover:bg-primary/25 transition-all disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {exporting ? "Exporting..." : "Export"}
            </button>
          </div>
        </div>

        {/* ── KPI Grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <div className="col-span-2 md:col-span-1">
            <KpiTile label="Total Received" value={kpi.total} icon={FileText} sub="All bureaus" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <KpiTile label="Under Process" value={kpi.under_process} icon={Clock} color="bg-red-500/20" sub="Active pipeline" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <KpiTile label="Escalated" value={kpi.escalated} icon={AlertTriangle} color="bg-red-500/20" sub="Priority cases" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <KpiTile label="Disposed" value={kpi.disposed} icon={CheckCircle2} color="bg-white/10" sub="Resolved" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <KpiTile label="Transferred" value={kpi.transferred} icon={ArrowUpRight} color="bg-rose-500/20" sub="Bureau → Bureau" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <KpiTile label="SLA Breached" value={kpi.sla_breached} icon={AlertOctagon} color="bg-red-600/30" pulse={kpi.sla_breached > 0} sub="Past deadline" />
          </div>
          <div className="col-span-2">
            <div className={cn(
              "glass-card p-4 flex flex-col gap-2 hover:border-red-500/30 transition-all duration-200 group relative overflow-hidden",
              kpi.overlapping_institutions > 0 && "border-red-500/40 bg-red-500/5"
            )}>
              {kpi.overlapping_institutions > 0 && (
                <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none rounded-xl" />
              )}
              <div className="flex items-center justify-between relative z-10">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 grid place-items-center">
                  <Siren className="w-4 h-4 text-red-400 animate-pulse" />
                </div>
                {kpi.overlapping_institutions > 0 && (
                  <span className="text-[9px] bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">
                    ALERT
                  </span>
                )}
              </div>
              <div className="relative z-10">
                <div className="text-2xl font-bold tabular-nums text-red-300">{kpi.overlapping_institutions}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Overlapping Institutions</div>
                <div className="text-[10px] text-red-400/60 mt-0.5">RB ∩ PGRC concurrent</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bureau Breakdown Bar ──────────────────────────────────── */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-primary" /> Bureau Workload
            </h2>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />RB: {kpi.by_bureau.RB}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />PGRC: {kpi.by_bureau.PGRC}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white/40 inline-block" />RO: {kpi.by_bureau.RO}</span>
            </div>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden">
            {kpi.total > 0 && (
              <>
                <div className="bg-red-600 transition-all" style={{ width: `${(kpi.by_bureau.RB / kpi.total) * 100}%` }} title={`RB: ${kpi.by_bureau.RB}`} />
                <div className="bg-rose-400 transition-all" style={{ width: `${(kpi.by_bureau.PGRC / kpi.total) * 100}%` }} title={`PGRC: ${kpi.by_bureau.PGRC}`} />
                <div className="bg-white/30 transition-all" style={{ width: `${(kpi.by_bureau.RO / kpi.total) * 100}%` }} title={`RO: ${kpi.by_bureau.RO}`} />
              </>
            )}
          </div>
        </div>

        {/* ── Main Tabs ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1">
          {([
            ["cases", "All Cases", FileText],
            ["overlaps", `Overlap Alerts (${overlapInstitutions.length})`, Siren],
            ["institutions", "Institutions", Building2],
            ["analytics", "Analytics", BarChart3],
          ] as [typeof activeTab, string, any][]).map(([k, label, Icon]) => (
            <button
              key={k}
              id={`cases-tab-${k}`}
              onClick={() => setActiveTab(k)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                activeTab === k
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-secondary/40 border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── TAB: All Cases ─────────────────────────────────────────── */}
        {activeTab === "cases" && (
          <div className="glass-card overflow-hidden">
            {/* Filters */}
            <div className="px-4 py-3 border-b border-border/30 flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="flex items-center gap-2 bg-secondary/40 border border-border/30 rounded-lg px-2.5 py-1.5 flex-1 min-w-[180px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search by ID, institution, category…"
                  className="bg-transparent text-xs outline-none flex-1 placeholder:text-muted-foreground/60"
                  id="cases-search-input"
                />
                {searchQ && <button onClick={() => setSearchQ("")}><X className="w-3 h-3 text-muted-foreground hover:text-white" /></button>}
              </div>
              {/* Bureau filter */}
              <select value={bureauFilter} onChange={e => setBureauFilter(e.target.value as Bureau)} className="h-8 px-2 rounded-lg bg-input border border-border/30 text-xs text-white" id="cases-bureau-filter">
                <option value="ALL">All Bureaus</option>
                <option value="RB">RB (Regulation Bureau)</option>
                <option value="PGRC">PGRC</option>
                <option value="RO">RO (Regional Office)</option>
              </select>
              {/* Status filter */}
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as CaseStatus)} className="h-8 px-2 rounded-lg bg-input border border-border/30 text-xs text-white" id="cases-status-filter">
                <option value="ALL">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              {/* Region filter */}
              <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} className="h-8 px-2 rounded-lg bg-input border border-border/30 text-xs text-white" id="cases-region-filter">
                {REGIONS.map(r => <option key={r} value={r}>{r === "ALL" ? "All Regions" : r}</option>)}
              </select>
              {/* Responsive Pagination Controls */}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[11px] text-muted-foreground font-medium">
                  {startCaseIndex}–{endCaseIndex} of {totalCasesCount} cases
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCasePage(p => Math.max(1, p - 1))}
                    disabled={casePage <= 1}
                    className="p-1 rounded-md border border-border/30 bg-secondary/40 hover:bg-secondary text-foreground disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-all"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCasePage(p => Math.min(totalCasePages, p + 1))}
                    disabled={casePage >= totalCasePages}
                    className="p-1 rounded-md border border-border/30 bg-secondary/40 hover:bg-secondary text-foreground disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-all"
                    title="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px]">
                <thead>
                  <tr className="border-b border-border/20">
                    {["Case ID", "Institution", "Institution Code", "Bureau", "Category", "Status", "Ageing", "Region", "Actions"].map(h => (
                      <th key={h} className={cn("px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground", h === "Actions" ? "text-right" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {totalCasesCount === 0 && (
                    <tr><td colSpan={9} className="px-3 py-8 text-center text-xs text-muted-foreground">No cases match your filters.</td></tr>
                  )}
                  {paginatedCases.map(c => (
                    <CaseRow
                      key={c.case_id}
                      c={c}
                      onView={setSelectedCase}
                      onViewProfile={setSelectedProfile}
                      onEdit={setEditingCase}
                      onDelete={handleDeleteCase}
                      canManage={canManageCases}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom pagination toolbar when multiple pages */}
            {totalCasePages > 1 && (
              <div className="px-4 py-2.5 border-t border-border/20 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Showing {startCaseIndex} to {endCaseIndex} of {totalCasesCount} cases ({pageSize} per page)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCasePage(p => Math.max(1, p - 1))}
                    disabled={casePage <= 1}
                    className="px-2.5 py-1 text-xs rounded-lg border border-border/30 bg-secondary/40 hover:bg-secondary text-foreground disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-all"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-semibold px-2 text-primary">
                    {casePage} / {totalCasePages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCasePage(p => Math.min(totalCasePages, p + 1))}
                    disabled={casePage >= totalCasePages}
                    className="px-2.5 py-1 text-xs rounded-lg border border-border/30 bg-secondary/40 hover:bg-secondary text-foreground disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Overlap Alerts ────────────────────────────────────── */}
        {activeTab === "overlaps" && (
          <div className="space-y-3">
            {overlapInstitutions.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-white/50 mx-auto mb-2" />
                <div className="text-sm text-white/70">No cross-bureau overlaps detected</div>
                <div className="text-xs text-muted-foreground mt-1">All institutions have isolated bureau proceedings.</div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-1">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-semibold text-red-300">
                    {overlapInstitutions.length} institution{overlapInstitutions.length > 1 ? "s" : ""} require cross-bureau coordination
                  </span>
                </div>
                {overlapInstitutions.map(({ pid, rb, pgrc, name, region }) => (
                  <OverlapAlertCard
                    key={pid}
                    aictePid={pid}
                    institutionName={name}
                    region={region}
                    rbCases={rb}
                    pgrcCases={pgrc}
                    analysis={
                      pid === "1-109723481" ? {
                        overlap_score: 0.88,
                        overlap_type: "definite_overlap",
                        shared_root_cause: "Faculty appointment and remuneration non-compliance",
                        recommended_action: "Initiate Joint RB+PGRC Hearing on Faculty Management",
                        reason: "The RB case addresses faculty cadre ratio while PGRC addresses non-payment of salaries. Both trace to the same root cause: the institution's failure to maintain adequate permanent faculty on compliant terms."
                      } : pid === "1-376234110" ? {
                        overlap_score: 0.92,
                        overlap_type: "definite_overlap",
                        shared_root_cause: "Unauthorized fee collection violating AICTE fee norms",
                        recommended_action: "Consolidate under RB with PGRC observer status",
                        reason: "The RB case covers excess fee collection under miscellaneous heads while PGRC is handling a capitation fee complaint. Both are manifestations of the same fee regulation violation."
                      } : {
                        overlap_score: 0.65,
                        overlap_type: "possible_overlap",
                        shared_root_cause: "Potential shared institutional compliance failure",
                        recommended_action: "Monitor for parallel proceedings — recommend officer communication",
                        reason: "Cases from different bureaus targeting the same institution — coordination advisable."
                      }
                    }
                    onViewProfile={setSelectedProfile}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* ── TAB: Institutions ────────────────────────────────────── */}
        {activeTab === "institutions" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from(new Set(cases.map(c => c.aicte_pid))).map(pid => {
              const instCases = cases.filter(c => c.aicte_pid === pid);
              const active = instCases.filter(c => c.status !== "disposed");
              const hasOverlap = active.some(c => c.bureau === "RB") && active.some(c => c.bureau === "PGRC");
              const name = instCases[0]?.institution_name ?? pid;
              const region = instCases[0]?.region ?? "—";
              return (
                <button
                  key={pid}
                  onClick={() => setSelectedProfile(pid)}
                  className={cn(
                    "glass-card p-4 text-left hover:border-primary/30 transition-all group",
                    hasOverlap && "border-red-500/30 bg-red-500/5 hover:border-red-500/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-8 h-8 rounded-lg grid place-items-center shrink-0",
                        hasOverlap ? "bg-red-500/20" : "bg-primary/10 group-hover:bg-primary/20"
                      )}>
                        {hasOverlap ? <Siren className="w-4 h-4 text-red-400" /> : <Building2 className="w-4 h-4 text-primary" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{name}</div>
                        <div className="text-[10px] font-mono text-primary/70 mt-0.5">{pid}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasOverlap && <span className="text-[9px] font-bold text-red-300 bg-red-500/20 border border-red-500/30 px-1.5 py-0.5 rounded-full">OVERLAP</span>}
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{region}</span>
                    <span className="text-[10px] text-muted-foreground">{instCases.length} total cases</span>
                    <span className="text-[10px] text-red-400">{active.length} active</span>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {Array.from(new Set(instCases.map(c => c.bureau))).map(b => <BureauBadge key={b} bureau={b} />)}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── TAB: Analytics ────────────────────────────────────────── */}
        {activeTab === "analytics" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bureau distribution */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5"><Layers className="w-4 h-4 text-primary" />Bureau Distribution</h3>
              <div className="space-y-3">
                {[
                  { label: "Regulation Bureau (RB)", count: kpi.by_bureau.RB, color: "bg-red-600", textColor: "text-red-400" },
                  { label: "PGRC (Grievance Cell)", count: kpi.by_bureau.PGRC, color: "bg-rose-400", textColor: "text-rose-300" },
                  { label: "Regional Offices (RO)", count: kpi.by_bureau.RO, color: "bg-white/30", textColor: "text-white/60" },
                ].map(b => (
                  <div key={b.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/70">{b.label}</span>
                      <span className={cn("text-xs font-bold tabular-nums", b.textColor)}>{b.count}</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-700", b.color)}
                        style={{ width: kpi.total > 0 ? `${(b.count / kpi.total) * 100}%` : "0%" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Case ageing */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-primary" />Case Ageing Analysis</h3>
              <div className="space-y-3">
                {ageingBuckets.map(b => (
                  <div key={b.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/70">{b.label}</span>
                      <span className="text-xs font-bold tabular-nums text-white/80">{b.count} cases</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-700", b.color)}
                        style={{ width: cases.filter(c => c.status !== "disposed").length > 0
                          ? `${(b.count / cases.filter(c => c.status !== "disposed").length) * 100}%` : "0%" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status breakdown */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-primary" />Status Breakdown</h3>
              <div className="space-y-2">
                {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
                  const count = cases.filter(c => c.status === status).length;
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <StatusBadge status={status} />
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-white/20 transition-all duration-700"
                          style={{ width: kpi.total > 0 ? `${(count / kpi.total) * 100}%` : "0%" }} />
                      </div>
                      <span className="text-xs text-white/60 tabular-nums w-4">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Complainant types */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5"><Users className="w-4 h-4 text-primary" />Complainant Types</h3>
              <div className="space-y-3">
                {Array.from(new Set(cases.map(c => c.complainant_type))).map(type => {
                  const count = cases.filter(c => c.complainant_type === type).length;
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white/70">{type}</span>
                        <span className="text-xs font-bold tabular-nums text-white/80">{count}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60 transition-all duration-700"
                          style={{ width: kpi.total > 0 ? `${(count / kpi.total) * 100}%` : "0%" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Institution Profile Drawer ──────────────────────────────── */}
      {selectedProfile && (
        <InstitutionDrawer pid={selectedProfile} liveCases={cases} onClose={() => setSelectedProfile(null)} />
      )}

      {/* ── Case Detail Modal ──────────────────────────────────────── */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedCase(null)} />
          <div className="relative w-full max-w-lg bg-card border border-border/40 rounded-2xl shadow-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <BureauBadge bureau={selectedCase.bureau} />
                  <span className="text-[11px] font-mono text-primary/80">{selectedCase.case_id}</span>
                  <StatusBadge status={selectedCase.status} />
                  {selectedCase.sla_breached && (
                    <span className="text-[10px] font-bold text-red-400 bg-red-500/20 border border-red-500/30 px-1.5 py-0.5 rounded-full">SLA BREACHED</span>
                  )}
                </div>
                <h2 className="font-semibold text-sm mt-2 leading-snug">{selectedCase.title}</h2>
              </div>
              <button onClick={() => setSelectedCase(null)} className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {[
                ["Institution", selectedCase.institution_name],
                ["Institution Code", selectedCase.institution_code || selectedCase.aicte_pid],
                ["Region", selectedCase.region],
                ["Bureau", selectedCase.bureau],
                ["Category", selectedCase.category],
                ["Status", selectedCase.status],
                ["Ageing", `${selectedCase.ageing_days ?? 0} days`],
                ["Submitted By", selectedCase.complainant_name || selectedCase.complainant_type || "Public"],
                ["Complainant Email", selectedCase.complainant_email || "N/A"],
                ["Received At", selectedCase.received_at ? new Date(selectedCase.received_at).toLocaleDateString() : (selectedCase.created_at ? new Date(selectedCase.created_at).toLocaleDateString() : "N/A")],
              ].map(([k, v]) => (
                <div key={k} className="bg-secondary/30 rounded-lg p-2">
                  <div className="text-muted-foreground text-[9px] uppercase tracking-wider">{k}</div>
                  <div className="text-white/80 mt-0.5 font-medium truncate">{v}</div>
                </div>
              ))}
            </div>
            {selectedCase.description && (
              <div className="bg-secondary/20 border border-border/20 rounded-lg p-3 text-xs text-white/70 leading-relaxed">
                {selectedCase.description}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setSelectedProfile(selectedCase.aicte_pid); setSelectedCase(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/25 text-xs text-primary hover:bg-primary/25 transition-all"
              >
                <Eye className="w-3.5 h-3.5" /> View Institution Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── File Complaint Modal (Integrated Database Persistence) ── */}
      {isFilingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !submittingComplaint && setIsFilingModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-card border border-border/50 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2 text-white">
                  <Gavel className="w-4 h-4 text-red-500" />
                  File AICTE Complaint
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Direct submission to persistent VigilOS database with atomic Case ID generation
                </p>
              </div>
              <button
                onClick={() => !submittingComplaint && setIsFilingModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-white hover:bg-secondary/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFileComplaintSubmit} className="space-y-3.5 text-xs">
              {/* Institution Selection */}
              <div>
                <label className="block text-[11px] font-semibold text-white/80 mb-1">Target Institution</label>
                <select
                  value={complaintForm.aicte_pid}
                  onChange={(e) => setComplaintForm({ ...complaintForm, aicte_pid: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg bg-secondary/40 border border-border/50 text-white text-xs outline-none focus:border-primary"
                  required
                >
                  {availableInstitutions.map((inst) => (
                    <option key={inst.aicte_pid} value={inst.aicte_pid} className="bg-neutral-900 text-white">
                      {inst.institution_name} ({inst.aicte_pid}) — {inst.region}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bureau & Complainant Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-white/80 mb-1">Responsible Bureau</label>
                  <select
                    value={complaintForm.bureau}
                    onChange={(e) => setComplaintForm({ ...complaintForm, bureau: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-secondary/40 border border-border/50 text-white text-xs outline-none focus:border-primary"
                  >
                    <option value="PGRC" className="bg-neutral-900 text-white">PGRC (Grievance Redressal)</option>
                    <option value="RB" className="bg-neutral-900 text-white">RB (Regulation Bureau)</option>
                    <option value="RO" className="bg-neutral-900 text-white">RO (Regional Office)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-white/80 mb-1">Complainant Role</label>
                  <select
                    value={complaintForm.complainant_type}
                    onChange={(e) => setComplaintForm({ ...complaintForm, complainant_type: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-secondary/40 border border-border/50 text-white text-xs outline-none focus:border-primary"
                  >
                    <option value="Student" className="bg-neutral-900 text-white">Student</option>
                    <option value="Faculty" className="bg-neutral-900 text-white">Faculty</option>
                    <option value="Stakeholder" className="bg-neutral-900 text-white">Parent / Stakeholder</option>
                    <option value="Institutional User" className="bg-neutral-900 text-white">Institutional Representative</option>
                    <option value="Public" className="bg-neutral-900 text-white">Public Citizen</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-semibold text-white/80 mb-1">Complaint Category</label>
                <select
                  value={complaintForm.category}
                  onChange={(e) => setComplaintForm({ ...complaintForm, category: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg bg-secondary/40 border border-border/50 text-white text-xs outline-none focus:border-primary"
                  required
                >
                  <option value="Capitation Fee" className="bg-neutral-900 text-white">Capitation Fee</option>
                  <option value="Faculty Deficiency" className="bg-neutral-900 text-white">Faculty Deficiency</option>
                  <option value="Non-payment of Salary" className="bg-neutral-900 text-white">Non-payment of Salary</option>
                  <option value="Ragging" className="bg-neutral-900 text-white">Ragging / Harassment</option>
                  <option value="Infrastructure Deficiency" className="bg-neutral-900 text-white">Infrastructure Deficiency</option>
                  <option value="Admissions Irregularity" className="bg-neutral-900 text-white">Admissions Irregularity</option>
                  <option value="Academic Issues" className="bg-neutral-900 text-white">Academic Issues</option>
                  <option value="Fee Regulation Violation" className="bg-neutral-900 text-white">Fee Regulation Violation</option>
                  <option value="Service Matters" className="bg-neutral-900 text-white">Service Matters</option>
                </select>
              </div>

              {/* Title / Subject */}
              <div>
                <label className="block text-[11px] font-semibold text-white/80 mb-1">Subject / Summary</label>
                <input
                  type="text"
                  value={complaintForm.title}
                  onChange={(e) => setComplaintForm({ ...complaintForm, title: e.target.value })}
                  placeholder="e.g. Demand for excess capitation fee during admission"
                  className="w-full h-9 px-3 rounded-lg bg-secondary/40 border border-border/50 text-white text-xs outline-none focus:border-primary"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-white/80 mb-1">Detailed Description</label>
                <textarea
                  rows={4}
                  value={complaintForm.description}
                  onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                  placeholder="Provide complete facts, specific departments, affected students or faculty..."
                  className="w-full p-3 rounded-lg bg-secondary/40 border border-border/50 text-white text-xs outline-none focus:border-primary resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFilingModalOpen(false)}
                  disabled={submittingComplaint}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingComplaint}
                  className="bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5"
                >
                  {submittingComplaint ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Submitting to Database...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Submit Authoritative Complaint
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Case Modal (Roles above Nodal Officer) ─────────────── */}
      {editingCase && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-xl w-full border border-primary/40 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border/30 bg-primary/10">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Edit Case Record</h3>
                  <p className="text-[11px] font-mono text-muted-foreground">ID: {editingCase.case_id} • {editingCase.institution_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCase(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCaseEdit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Bureau */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Bureau Jurisdiction *
                  </label>
                  <select
                    value={editBureau}
                    onChange={(e) => setEditBureau(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-input border border-border/40 text-foreground text-xs outline-none focus:border-primary"
                    required
                  >
                    <option value="RB" className="bg-neutral-900 text-white">RB (Regulation Bureau)</option>
                    <option value="PGRC" className="bg-neutral-900 text-white">PGRC (Grievance Cell)</option>
                    <option value="RO" className="bg-neutral-900 text-white">RO (Regional Office)</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Case Status *
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-input border border-border/40 text-foreground text-xs outline-none focus:border-primary"
                    required
                  >
                    <option value="received" className="bg-neutral-900 text-white">Received</option>
                    <option value="under_process" className="bg-neutral-900 text-white">Under Process</option>
                    <option value="transferred" className="bg-neutral-900 text-white">Transferred</option>
                    <option value="escalated" className="bg-neutral-900 text-white">Escalated</option>
                    <option value="disposed" className="bg-neutral-900 text-white">Disposed</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Case Category *
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-input border border-border/40 text-foreground text-xs outline-none focus:border-primary"
                  required
                >
                  <option value="Capitation Fee" className="bg-neutral-900 text-white">Capitation Fee</option>
                  <option value="Faculty Deficiency" className="bg-neutral-900 text-white">Faculty Deficiency</option>
                  <option value="Non-payment of Salary" className="bg-neutral-900 text-white">Non-payment of Salary</option>
                  <option value="Ragging" className="bg-neutral-900 text-white">Ragging / Harassment</option>
                  <option value="Infrastructure Deficiency" className="bg-neutral-900 text-white">Infrastructure Deficiency</option>
                  <option value="Admissions Irregularity" className="bg-neutral-900 text-white">Admissions Irregularity</option>
                  <option value="Academic Issues" className="bg-neutral-900 text-white">Academic Issues</option>
                  <option value="Fee Regulation Violation" className="bg-neutral-900 text-white">Fee Regulation Violation</option>
                  <option value="Service Matters" className="bg-neutral-900 text-white">Service Matters</option>
                  <option value="General Grievance" className="bg-neutral-900 text-white">General Grievance</option>
                </select>
              </div>

              {/* Title / Subject */}
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Case Subject / Title *
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Investigation regarding unauthorized fee collection"
                  className="w-full h-9 px-3 rounded-lg bg-input border border-border/40 text-foreground text-xs outline-none focus:border-primary"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Detailed Case Description
                </label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Specific details, inspection notes, observations..."
                  className="w-full p-3 rounded-lg bg-input border border-border/40 text-foreground text-xs outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Assigned Officer */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Assigned Officer
                  </label>
                  <input
                    type="text"
                    value={editAssignedOfficer}
                    onChange={(e) => setEditAssignedOfficer(e.target.value)}
                    placeholder="e.g. Dr. Rajesh Kumar"
                    className="w-full h-9 px-3 rounded-lg bg-input border border-border/40 text-foreground text-xs outline-none focus:border-primary"
                  />
                </div>

                {/* SLA Days */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    SLA Window (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={editSlaDays}
                    onChange={(e) => setEditSlaDays(parseInt(e.target.value, 10) || 30)}
                    className="w-full h-9 px-3 rounded-lg bg-input border border-border/40 text-foreground text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/30">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingCase(null)}
                  disabled={isSavingCase}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingCase}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5"
                >
                  {isSavingCase ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Save Case Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
