import { useState, useMemo } from "react";
import {
  Building2,
  FileText,
  UserCheck,
  Search,
  Filter,
  Calendar,
  Clock,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  MapPin,
  Mail,
  User,
  AlertCircle,
  Tag,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  XCircle,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface InstitutionAuditComplaint {
  case_id: string;
  aicte_pid: string;
  institution_name: string;
  region: string;
  bureau: string;
  category: string;
  title: string;
  description: string;
  complainant_name: string;
  complainant_type: string;
  created_at: string;
  status: string;
  event_type: string;
  action_label: string;
}

export interface InstitutionAuditRegistration {
  registration_id: string;
  institution_name: string;
  official_email: string;
  inst_type: string;
  city: string;
  state: string;
  region: string;
  status: string;
  created_at: string;
  rep_name: string;
  rep_designation: string;
  event_type: string;
  action_label: string;
}

export interface InstitutionAuditPortfolio {
  audit_id: number;
  actor_role: string;
  action: string;
  target: string;
  result: string;
  created_at: string;
  event_type: string;
  action_label: string;
}

interface Props {
  complaints: InstitutionAuditComplaint[];
  registrations: InstitutionAuditRegistration[];
  portfolioUpdates: InstitutionAuditPortfolio[];
  loading?: boolean;
}

export function InstitutionAuditSubpage({
  complaints,
  registrations,
  portfolioUpdates,
  loading = false,
}: Props) {
  const [filterType, setFilterType] = useState<"all" | "complaints" | "registrations" | "portfolio">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Normalize all records into a unified chronological activity feed
  const allEvents = useMemo(() => {
    const list: Array<{
      id: string;
      sourceType: "complaint" | "registration" | "portfolio";
      institution_name: string;
      identifier: string;
      title: string;
      subtitle: string;
      region?: string;
      status?: string;
      created_at: string;
      metaBadge: string;
      raw: any;
    }> = [];

    // 1. Complaints
    complaints.forEach((c) => {
      list.push({
        id: `comp-${c.case_id}`,
        sourceType: "complaint",
        institution_name: c.institution_name || "Institution",
        identifier: c.case_id,
        title: c.title,
        subtitle: `${c.bureau} Bureau · ${c.category} · Submitter: ${c.complainant_name || c.complainant_type || "Institution Representative"}`,
        region: c.region,
        status: c.status,
        created_at: c.created_at,
        metaBadge: "Grievance Complaint",
        raw: c,
      });
    });

    // 2. Registrations
    registrations.forEach((r) => {
      list.push({
        id: `reg-${r.registration_id}`,
        sourceType: "registration",
        institution_name: r.institution_name,
        identifier: r.registration_id,
        title: `Self-Registration Application: ${r.institution_name}`,
        subtitle: `Rep: ${r.rep_name || "Authorized Official"} (${r.rep_designation || "Signatory"}) · Email: ${r.official_email}`,
        region: r.region || "State Liaison",
        status: r.status,
        created_at: r.created_at,
        metaBadge: "Onboarding Application",
        raw: r,
      });
    });

    // 3. Portfolio updates
    portfolioUpdates.forEach((p) => {
      list.push({
        id: `port-${p.audit_id}`,
        sourceType: "portfolio",
        institution_name: p.result.includes("(") ? p.result.split("(")[0].replace("Updated portfolio for ", "").trim() : p.target,
        identifier: p.target,
        title: p.result,
        subtitle: `Actor Role: ${p.actor_role} · System Action: ${p.action}`,
        created_at: p.created_at,
        metaBadge: "Portfolio Sync",
        raw: p,
      });
    });

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [complaints, registrations, portfolioUpdates]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      if (filterType === "complaints" && ev.sourceType !== "complaint") return false;
      if (filterType === "registrations" && ev.sourceType !== "registration") return false;
      if (filterType === "portfolio" && ev.sourceType !== "portfolio") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          ev.institution_name.toLowerCase().includes(q) ||
          ev.identifier.toLowerCase().includes(q) ||
          ev.title.toLowerCase().includes(q) ||
          ev.subtitle.toLowerCase().includes(q) ||
          (ev.region || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [allEvents, filterType, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-secondary/20 p-3.5 rounded-2xl border border-border/40">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
              filterType === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-white"
            )}
          >
            All Activity ({allEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("complaints")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
              filterType === "complaints"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-white"
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Complaints Submitted ({complaints.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType("registrations")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
              filterType === "registrations"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-white"
            )}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Applications ({registrations.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType("portfolio")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
              filterType === "portfolio"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-white"
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Profile Syncs ({portfolioUpdates.length})</span>
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search institution, ID, or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-background/60 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
          />
        </div>
      </div>

      {/* Activity List / Table */}
      <div className="glass-card rounded-2xl border border-border/40 overflow-hidden shadow-xl">
        <div className="p-3.5 border-b border-border/30 flex items-center justify-between text-xs text-muted-foreground bg-secondary/10">
          <span className="font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Institution Actions & Filings Log
          </span>
          <span className="font-mono text-[11px]">Showing {filteredEvents.length} verifiable records</span>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-xs space-y-1">
            <AlertCircle className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
            <p>No institution activities match your selected query.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {filteredEvents.map((ev) => (
              <div
                key={ev.id}
                onClick={() => setSelectedItem(ev)}
                className="p-4 hover:bg-secondary/30 transition-colors flex items-start justify-between gap-4 cursor-pointer group"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className={cn(
                    "w-9 h-9 rounded-xl grid place-items-center shrink-0 border mt-0.5",
                    ev.sourceType === "complaint" ? "bg-red-500/15 text-red-400 border-red-500/30" :
                      ev.sourceType === "registration" ? "bg-amber-500/15 text-amber-300 border-amber-500/30" :
                        "bg-blue-500/15 text-blue-300 border-blue-500/30"
                  )}>
                    {ev.sourceType === "complaint" && <FileText className="w-4 h-4" />}
                    {ev.sourceType === "registration" && <Building2 className="w-4 h-4" />}
                    {ev.sourceType === "portfolio" && <ShieldCheck className="w-4 h-4" />}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white group-hover:text-primary transition-colors truncate">
                        {ev.institution_name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary/80 border border-border/40 text-muted-foreground">
                        {ev.identifier}
                      </span>
                      <span className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider",
                        ev.sourceType === "complaint" ? "bg-red-950/60 text-red-300 border border-red-700/40" :
                          ev.sourceType === "registration" ? "bg-amber-950/60 text-amber-300 border border-amber-700/40" :
                            "bg-blue-950/60 text-blue-300 border border-blue-700/40"
                      )}>
                        {ev.metaBadge}
                      </span>
                      {ev.region && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground/60" /> {ev.region}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-foreground/90 font-medium line-clamp-1">{ev.title}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{ev.subtitle}</p>
                  </div>
                </div>

                <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                    <Clock3 className="w-3 h-3" />
                    <span>{new Date(ev.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  {ev.status && (
                    <span className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded-md uppercase",
                      ev.status === "approved" || ev.status === "disposed" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" :
                        ev.status === "pending" || ev.status === "under_process" ? "bg-amber-500/15 text-amber-300 border border-amber-500/30" :
                          "bg-secondary border border-border/40 text-muted-foreground"
                    )}>
                      Status: {ev.status}
                    </span>
                  )}
                  <div className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    View Details <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="w-full max-w-xl bg-card border border-border/60 rounded-2xl p-6 shadow-2xl relative space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border/30 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-primary font-mono">
                  Institution Audit Record · {selectedItem.sourceType.toUpperCase()}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">{selectedItem.institution_name}</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">Reference: {selectedItem.identifier}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/40 space-y-2 text-xs">
              <div className="text-muted-foreground font-semibold">Subject Matter / Action Summary:</div>
              <div className="text-sm text-foreground font-medium">{selectedItem.title}</div>
              <div className="text-[11px] text-muted-foreground">{selectedItem.subtitle}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Recorded Timestamp</span>
                <div className="font-mono text-white text-[11px]">
                  {new Date(selectedItem.created_at).toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Action Category</span>
                <div className="font-semibold text-primary">{selectedItem.metaBadge}</div>
              </div>
            </div>

            {selectedItem.sourceType === "complaint" && selectedItem.raw.description && (
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Full Complaint Narrative</span>
                <div className="p-3 rounded-xl bg-background/80 border border-border/40 text-xs text-foreground/90 max-h-36 overflow-y-auto leading-relaxed">
                  {selectedItem.raw.description}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

