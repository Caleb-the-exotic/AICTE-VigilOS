import { useState, useMemo } from "react";
import {
  UserX,
  Shield,
  KeyRound,
  UserCheck,
  Search,
  Filter,
  Clock,
  Trash2,
  Lock,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  User,
  History,
  FileCheck,
  Building,
  BellOff,
  Layers,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface OfficerPersonnelAudit {
  id: number;
  user_id: string;
  changed_by: string;
  action: string;
  old_role_key?: string;
  new_role_key?: string;
  old_bureau_code?: string;
  new_bureau_code?: string;
  old_region_code?: string;
  new_region_code?: string;
  created_at: string;
  target_name: string;
  target_email: string;
  actor_name: string;
  actor_email: string;
  deletion_reason?: string;
  is_deleted_user: number;
  domain: string;
}

export interface OfficerSystemAudit {
  id: number;
  session_id: string;
  actor_role: string;
  action: string;
  target: string;
  result: string;
  created_at: string;
  domain: string;
}

interface Props {
  personnelAudits: OfficerPersonnelAudit[];
  systemAudits: OfficerSystemAudit[];
  deletedUsersCount: number;
  statusChangesCount: number;
  loading?: boolean;
}

export function OfficerAuditSubpage({
  personnelAudits,
  systemAudits,
  deletedUsersCount,
  statusChangesCount,
  loading = false,
}: Props) {
  const [filterMode, setFilterMode] = useState<"all" | "deleted_users" | "account_governance" | "system_purges">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAudit, setSelectedAudit] = useState<any | null>(null);

  // Group and format actions
  const allEvents = useMemo(() => {
    const list: Array<{
      id: string;
      category: "deleted_user" | "personnel" | "system";
      action_code: string;
      action_title: string;
      actor: string;
      target: string;
      details: string;
      created_at: string;
      notInNotifications: boolean;
      badge: string;
      raw: any;
    }> = [];

    // Personnel Audits (Includes deleted users, profile changes, role assignments, 2FA)
    personnelAudits.forEach((pa) => {
      const isDeleted = pa.action === "USER_PERMANENTLY_DELETED" || pa.is_deleted_user === 1;
      const isStatusChange = pa.action.startsWith("STATUS_CHANGE");
      const is2FA = pa.action.startsWith("2FA_");
      const isPassword = pa.action.includes("PASSWORD");

      let actionTitle = pa.action.replace(/_/g, " ");
      if (isDeleted) actionTitle = "Personnel Account Permanently Deleted";
      else if (pa.action === "CREATE_USER") actionTitle = "New Personnel Account Provisioned";
      else if (pa.action === "UPDATE_ASSIGNMENT") actionTitle = "Role / Bureau / Region Assignment Re-allocated";
      else if (pa.action === "UPDATE_PROFILE") actionTitle = "Officer Account Credentials Updated";
      else if (pa.action === "STATUS_CHANGE_ACTIVE") actionTitle = "Account Re-activated";
      else if (pa.action === "STATUS_CHANGE_INACTIVE") actionTitle = "Account Deactivated";
      else if (is2FA) actionTitle = pa.action === "2FA_ENABLED" ? "Two-Factor Authentication Enforced" : "Two-Factor Authentication Disabled";

      list.push({
        id: `pa-${pa.id}`,
        category: isDeleted ? "deleted_user" : "personnel",
        action_code: pa.action,
        action_title: actionTitle,
        actor: `${pa.actor_name} (${pa.actor_email})`,
        target: `${pa.target_name} (${pa.target_email || pa.user_id})`,
        details: isDeleted
          ? `Reason: ${pa.deletion_reason || "Permanently purged from database by administrator. Tokens revoked."}`
          : pa.old_role_key && pa.new_role_key
            ? `Changed designation from ${pa.old_role_key.toUpperCase()} to ${pa.new_role_key.toUpperCase()} (${pa.new_bureau_code || "HQ"} / ${pa.new_region_code || "HQ"})`
            : `System execution on target account ${pa.target_name}.`,
        created_at: pa.created_at,
        // Crucial distinction: deletions, 2FA, password changes, deactivations are NOT sent as public notifications
        notInNotifications: true,
        badge: isDeleted ? "Purged Account" : "Access Governance",
        raw: pa,
      });
    });

    // System Audits (Case deletion, bulk notification purge, linking)
    systemAudits.forEach((sa) => {
      const isPurge = sa.action === "NOTIFICATIONS_BULK_DELETED" || sa.action === "NOTIFICATION_DELETED" || sa.action === "CASE_DELETE";
      let title = sa.action.replace(/_/g, " ");
      if (sa.action === "CASE_DELETE") title = "Regulatory Grievance Record Deleted";
      else if (sa.action === "NOTIFICATIONS_BULK_DELETED") title = "Notifications Database Bulk Cleared";
      else if (sa.action === "NOTIFICATION_DELETED") title = "Notification Record Expunged";
      else if (sa.action === "CASES_LINKED") title = "Proceedings Consolidated & Linked";
      else if (sa.action === "CASES_UNLINKED") title = "Proceedings Detached / Unlinked";

      list.push({
        id: `sa-${sa.id}`,
        category: "system",
        action_code: sa.action,
        action_title: title,
        actor: sa.result.includes(" by ") ? sa.result.split(" by ")[1].trim() : sa.actor_role,
        target: sa.target,
        details: sa.result,
        created_at: sa.created_at,
        notInNotifications: isPurge,
        badge: isPurge ? "Purge / Destruction" : "Regulatory Action",
        raw: sa,
      });
    });

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [personnelAudits, systemAudits]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      if (filterMode === "deleted_users" && ev.category !== "deleted_user") return false;
      if (filterMode === "account_governance" && ev.category !== "personnel") return false;
      if (filterMode === "system_purges" && ev.category !== "system") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          ev.action_title.toLowerCase().includes(q) ||
          ev.actor.toLowerCase().includes(q) ||
          ev.target.toLowerCase().includes(q) ||
          ev.details.toLowerCase().includes(q) ||
          ev.action_code.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [allEvents, filterMode, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-card p-4 rounded-2xl border border-red-500/30 bg-red-950/15 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 grid place-items-center shrink-0 border border-red-500/30">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-red-300 tracking-wider">Deleted Accounts</div>
            <div className="text-xl font-extrabold text-white font-mono mt-0.5">{deletedUsersCount}</div>
            <div className="text-[10px] text-muted-foreground">Excluded from notifications</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-amber-500/30 bg-amber-950/15 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 grid place-items-center shrink-0 border border-amber-500/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Personnel Changes</div>
            <div className="text-xl font-extrabold text-white font-mono mt-0.5">{personnelAudits.length}</div>
            <div className="text-[10px] text-muted-foreground">Roles, status & 2FA modifications</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-blue-500/30 bg-blue-950/15 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 grid place-items-center shrink-0 border border-blue-500/30">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">Internal Operations</div>
            <div className="text-xl font-extrabold text-white font-mono mt-0.5">{systemAudits.length}</div>
            <div className="text-[10px] text-muted-foreground">Case & notification purge audit</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-secondary/20 p-3.5 rounded-2xl border border-border/40">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
              filterMode === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-white"
            )}
          >
            All Officer Actions ({allEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("deleted_users")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
              filterMode === "deleted_users"
                ? "bg-red-600 text-white border-red-600 shadow-sm"
                : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-white"
            )}
          >
            <UserX className="w-3.5 h-3.5 text-red-400" />
            <span>Deleted Accounts ({deletedUsersCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("account_governance")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
              filterMode === "account_governance"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-white"
            )}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Access & Role Governance ({personnelAudits.length - deletedUsersCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("system_purges")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
              filterMode === "system_purges"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-white"
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purges & Operations ({systemAudits.length})</span>
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, officer, or target..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-background/60 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
          />
        </div>
      </div>

      {/* Main Audit List */}
      <div className="glass-card rounded-2xl border border-border/40 overflow-hidden shadow-xl">
        <div className="p-3.5 border-b border-border/30 flex items-center justify-between text-xs text-muted-foreground bg-secondary/10">
          <span className="font-semibold text-foreground flex items-center gap-2">
            <History className="w-4 h-4 text-primary" /> Officer Operations & Invisible Audit Trail
          </span>
          <span className="font-mono text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <BellOff className="w-3 h-3" /> Includes events excluded from public notifications
          </span>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-xs space-y-1">
            <AlertTriangle className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
            <p>No officer audit records found matching your filter criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {filteredEvents.map((ev) => (
              <div
                key={ev.id}
                onClick={() => setSelectedAudit(ev)}
                className="p-4 hover:bg-secondary/30 transition-colors flex items-start justify-between gap-4 cursor-pointer group"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className={cn(
                    "w-9 h-9 rounded-xl grid place-items-center shrink-0 border mt-0.5",
                    ev.category === "deleted_user" ? "bg-red-500/20 text-red-400 border-red-500/40" :
                      ev.category === "personnel" ? "bg-amber-500/15 text-amber-300 border-amber-500/30" :
                        "bg-blue-500/15 text-blue-300 border-blue-500/30"
                  )}>
                    {ev.category === "deleted_user" && <UserX className="w-4 h-4" />}
                    {ev.category === "personnel" && <KeyRound className="w-4 h-4" />}
                    {ev.category === "system" && <Trash2 className="w-4 h-4" />}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white group-hover:text-primary transition-colors truncate">
                        {ev.action_title}
                      </span>
                      <span className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider",
                        ev.category === "deleted_user" ? "bg-red-950/70 text-red-300 border border-red-600/40" :
                          ev.category === "personnel" ? "bg-amber-950/70 text-amber-300 border border-amber-600/40" :
                            "bg-blue-950/70 text-blue-300 border border-blue-600/40"
                      )}>
                        {ev.badge}
                      </span>
                      {ev.notInNotifications && (
                        <span className="text-[10px] text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1 font-mono">
                          <BellOff className="w-3 h-3" /> Hidden from Notifications
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span><strong>Executing Official:</strong> {ev.actor}</span>
                      <span>·</span>
                      <span><strong>Target:</strong> <span className="text-foreground">{ev.target}</span></span>
                    </div>

                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5 line-clamp-1">{ev.details}</p>
                  </div>
                </div>

                <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(ev.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <div className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    Inspect Entry <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Detail Modal */}
      {selectedAudit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setSelectedAudit(null)}
        >
          <div
            className="w-full max-w-xl bg-card border border-border/60 rounded-2xl p-6 shadow-2xl relative space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border/30 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-primary font-mono flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Officer Audit Record · {selectedAudit.action_code}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">{selectedAudit.action_title}</h3>
                <p className="text-xs text-amber-400 flex items-center gap-1 mt-0.5 font-mono">
                  <BellOff className="w-3 h-3" /> Non-Notification Audit Event
                </p>
              </div>
              <button
                onClick={() => setSelectedAudit(null)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
                <div className="text-muted-foreground font-semibold">Authoritative Event Summary:</div>
                <div className="text-sm text-foreground font-medium">{selectedAudit.details}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Executing Official</span>
                  <div className="font-semibold text-white truncate">{selectedAudit.actor}</div>
                </div>
                <div className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Affected Target</span>
                  <div className="font-semibold text-white truncate">{selectedAudit.target}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Timestamp</span>
                  <div className="font-mono text-muted-foreground text-[11px]">
                    {new Date(selectedAudit.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Domain Classification</span>
                  <div className="font-semibold text-primary">{selectedAudit.badge}</div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAudit(null)}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors"
              >
                Close Audit Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

