import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Building2, CheckCircle2, Clock, Eye, Filter, Loader2,
  RefreshCw, Search, X, CheckCheck, XCircle, ExternalLink,
  ArrowUpRight, FileText, AlertCircle, ShieldAlert, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HAS_BACKEND, api, type InstitutionRegistrationRecord } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface InstitutionRegistrationsTabProps {
  onRefreshCases?: () => Promise<void> | void;
}

export default function InstitutionRegistrationsTab({ onRefreshCases }: InstitutionRegistrationsTabProps) {
  const { user } = useAuth();
  const canManage = ["super_admin", "bureau_head", "approval_officer"].includes(user?.role || "");

  // Registrations Queue State
  const [registrations, setRegistrations] = useState<InstitutionRegistrationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQ, setSearchQ] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals State
  const [selectedApp, setSelectedApp] = useState<InstitutionRegistrationRecord | null>(null);
  const [approvingApp, setApprovingApp] = useState<InstitutionRegistrationRecord | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("Approved by reviewing officer");
  const [isApproving, setIsApproving] = useState(false);

  const [rejectingApp, setRejectingApp] = useState<InstitutionRegistrationRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Fetch registrations from PostgreSQL backend
  const fetchRegistrations = useCallback(async () => {
    if (!HAS_BACKEND) return;
    setLoading(true);
    try {
      const res = await api.getInstitutionRegistrations({
        status: statusFilter,
        search: searchQ.trim() || undefined,
        page,
        page_size: 50,
      });
      if (res && res.items) {
        setRegistrations(res.items);
        setTotalCount(res.total);
      }
    } catch (e: any) {
      console.warn("Failed to fetch registrations queue:", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQ, page]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // Handle URL deep link for app_id
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const appIdParam = params.get("app_id");
      if (appIdParam && HAS_BACKEND) {
        api.getInstitutionRegistrationDetail(appIdParam)
          .then((app) => {
            if (app) setSelectedApp(app);
          })
          .catch(() => {});
      }
    }
  }, []);

  // Action handlers
  const handleDeleteRegistration = async (app: InstitutionRegistrationRecord) => {
    if (!window.confirm(`Permanently delete registration for ${app.institution_name} (${app.id})? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await api.deleteInstitutionRegistration(app.id);
      if (res.ok) {
        toast.success(`Registration ${app.id} deleted successfully.`);
        if (selectedApp?.id === app.id) setSelectedApp(null);
        await fetchRegistrations();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete registration");
    }
  };

  const handleApproveConfirm = async () => {
    if (!approvingApp) return;
    setIsApproving(true);
    try {
      const res = await api.approveInstitutionRegistration(approvingApp.id, approvalNotes);
      if (res.ok) {
        toast.success(`Institution ${res.application.institution_name} approved! Assigned PID: ${res.application.created_institution_pid || 'Registered'}`);
        setApprovingApp(null);
        setSelectedApp(null);
        await fetchRegistrations();
        if (onRefreshCases) await onRefreshCases();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("aicte_institution_updated"));
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve application");
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingApp) return;
    if (!rejectionReason.trim()) {
      toast.error("Please enter a valid rejection reason.");
      return;
    }
    setIsRejecting(true);
    try {
      const res = await api.rejectInstitutionRegistration(rejectingApp.id, rejectionReason.trim(), rejectionNotes.trim());
      if (res.ok) {
        toast.success(`Application ${rejectingApp.id} rejected. Reason dispatched to applicant.`);
        setRejectingApp(null);
        setSelectedApp(null);
        await fetchRegistrations();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject application");
    } finally {
      setIsRejecting(false);
    }
  };

  const pendingCount = useMemo(() => {
    return registrations.filter((r) => r.status === "pending").length;
  }, [registrations]);

  return (
    <div className="space-y-4">
      {/* ── Filter & Search Toolbar ─────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30 flex flex-wrap items-center gap-2">
          {/* Search by Name, Code, Application ID, Email */}
          <div className="flex items-center gap-2 bg-secondary/40 border border-border/30 rounded-lg px-2.5 py-1.5 flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search by ID, institution name, code, email..."
              className="bg-transparent text-xs outline-none flex-1 placeholder:text-muted-foreground/60 text-white"
            />
            {searchQ && (
              <button onClick={() => setSearchQ("")}>
                <X className="w-3 h-3 text-muted-foreground hover:text-white" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2 rounded-lg bg-input border border-border/30 text-xs text-white"
          >
            <option value="all">All Applications</option>
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchRegistrations}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/40 border border-border/30 text-xs text-muted-foreground hover:text-foreground transition-all ml-auto cursor-pointer"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh Queue
          </button>
        </div>

        {/* ── Applications Table ────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-border/20 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 text-left">Application ID</th>
                <th className="px-3 py-2.5 text-left">Institution Name</th>
                <th className="px-3 py-2.5 text-left">Code / Type</th>
                <th className="px-3 py-2.5 text-left">Applicant / Rep</th>
                <th className="px-3 py-2.5 text-left">Region & Contact</th>
                <th className="px-3 py-2.5 text-left">Submitted Date</th>
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-left">Reviewer</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && registrations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2 text-primary" />
                    Loading registration applications from PostgreSQL...
                  </td>
                </tr>
              ) : registrations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    No institution registration applications found matching the selected filters.
                  </td>
                </tr>
              ) : (
                registrations.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className="border-b border-border/20 hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    {/* Application ID */}
                    <td className="px-3 py-3">
                      <span className="text-[11px] font-mono font-semibold text-primary">{app.id}</span>
                    </td>

                    {/* Institution Name */}
                    <td className="px-3 py-3">
                      <div className="text-xs font-semibold text-white/90 max-w-[220px] truncate">
                        {app.institution_name}
                      </div>
                      {app.created_institution_pid && (
                        <div className="text-[10px] font-mono text-emerald-400 mt-0.5">
                          PID: {app.created_institution_pid}
                        </div>
                      )}
                    </td>

                    {/* Code & Type */}
                    <td className="px-3 py-3">
                      <div className="text-[11px] font-mono text-muted-foreground">{app.aicte_code || "—"}</div>
                      <div className="text-[10px] text-white/40 truncate max-w-[140px]">{app.inst_type}</div>
                    </td>

                    {/* Representative */}
                    <td className="px-3 py-3">
                      <div className="text-xs text-white/90 font-medium">{app.rep_name || app.applicant_name || "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{app.rep_designation || "Representative"}</div>
                    </td>

                    {/* Region & Email */}
                    <td className="px-3 py-3">
                      <div className="text-[11px] text-white/80">{app.region || "—"} Region</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{app.official_email}</div>
                    </td>

                    {/* Submitted Date */}
                    <td className="px-3 py-3">
                      <span className="text-[11px] text-muted-foreground">
                        {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "—"}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-3 py-3">
                      {app.status === "pending" && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-300 border-amber-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Pending Approval
                        </span>
                      )}
                      {app.status === "approved" && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Approved
                        </span>
                      )}
                      {app.status === "rejected" && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-500/15 text-red-300 border-red-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          Rejected
                        </span>
                      )}
                    </td>

                    {/* Reviewer */}
                    <td className="px-3 py-3">
                      <span className="text-[11px] text-muted-foreground">{app.reviewer_name || "—"}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {app.status === "pending" && canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setApprovingApp(app);
                                setApprovalNotes("Approved by reviewing officer");
                              }}
                              className="px-2 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition-all cursor-pointer"
                              title="Approve Institution"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingApp(app);
                                setRejectionReason("");
                                setRejectionNotes("");
                              }}
                              className="px-2 py-1 rounded-md bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-[11px] font-semibold transition-all cursor-pointer"
                              title="Reject Application"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedApp(app)}
                          className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                          title="View Application Details"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRegistration(app)}
                            className="p-1 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive cursor-pointer transition-colors"
                            title="Delete Registration from Queue"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Application Details ─────────────────────────────── */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedApp(null)} />
          <div className="relative w-full max-w-2xl bg-card border border-border/40 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border/30 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-primary">{selectedApp.id}</span>
                  {selectedApp.status === "pending" && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-300 border-amber-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Pending Approval
                    </span>
                  )}
                  {selectedApp.status === "approved" && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Approved
                    </span>
                  )}
                  {selectedApp.status === "rejected" && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-500/15 text-red-300 border-red-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      Rejected
                    </span>
                  )}
                  {selectedApp.created_institution_pid && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                      PID: {selectedApp.created_institution_pid}
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-white mt-1.5">{selectedApp.institution_name}</h2>
                <div className="text-[11px] text-muted-foreground">
                  Submitted: {selectedApp.submitted_at ? new Date(selectedApp.submitted_at).toLocaleString() : "—"}
                </div>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid Information */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-secondary/30 rounded-lg p-2.5">
                <div className="text-muted-foreground text-[10px] uppercase font-semibold">AICTE Code</div>
                <div className="text-white font-mono mt-0.5">{selectedApp.aicte_code || "Pending Assignment"}</div>
              </div>
              <div className="bg-secondary/30 rounded-lg p-2.5">
                <div className="text-muted-foreground text-[10px] uppercase font-semibold">Type</div>
                <div className="text-white mt-0.5 truncate">{selectedApp.inst_type || "Engineering College"}</div>
              </div>
              <div className="bg-secondary/30 rounded-lg p-2.5">
                <div className="text-muted-foreground text-[10px] uppercase font-semibold">Region & State</div>
                <div className="text-white mt-0.5 truncate">{selectedApp.region || "—"} · {selectedApp.state || "—"}</div>
              </div>
              <div className="bg-secondary/30 rounded-lg p-2.5">
                <div className="text-muted-foreground text-[10px] uppercase font-semibold">Official Email</div>
                <div className="text-white mt-0.5 truncate">{selectedApp.official_email}</div>
              </div>
              <div className="bg-secondary/30 rounded-lg p-2.5">
                <div className="text-muted-foreground text-[10px] uppercase font-semibold">Contact Phone</div>
                <div className="text-white mt-0.5">{selectedApp.contact_phone || "—"}</div>
              </div>
              <div className="bg-secondary/30 rounded-lg p-2.5">
                <div className="text-muted-foreground text-[10px] uppercase font-semibold">City & District</div>
                <div className="text-white mt-0.5 truncate">{selectedApp.city || "—"}, {selectedApp.district || "—"}</div>
              </div>
            </div>

            {/* Representative Details */}
            <div className="bg-secondary/20 border border-border/30 rounded-xl p-3.5 space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Authorized Representative</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Name:</span> <strong className="text-white">{selectedApp.rep_name || "—"}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Designation:</span> <span className="text-white">{selectedApp.rep_designation || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span> <span className="text-white">{selectedApp.rep_email || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span> <span className="text-white">{selectedApp.rep_phone || "—"}</span>
                </div>
              </div>
            </div>

            {/* Address */}
            {selectedApp.address && (
              <div className="bg-secondary/20 border border-border/30 rounded-xl p-3 text-xs space-y-1">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Campus Address</div>
                <div className="text-white/80 leading-relaxed">{selectedApp.address}</div>
              </div>
            )}

            {/* Supporting Documents */}
            <div className="bg-secondary/20 border border-border/30 rounded-xl p-3.5 space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Verification Documents</div>
              {(() => {
                let docs: any[] = [];
                try {
                  docs = typeof selectedApp.documents_json === "string" ? JSON.parse(selectedApp.documents_json) : (selectedApp.documents_json || []);
                } catch {/**/}
                if (!docs || docs.length === 0) {
                  return <div className="text-xs text-muted-foreground">No supporting documents attached.</div>;
                }
                return (
                  <div className="space-y-1.5">
                    {docs.map((d: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between bg-input/60 border border-border/30 rounded-lg px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="font-medium text-white truncate">{d.name}</span>
                          {d.type && <span className="text-[10px] text-muted-foreground">({d.type})</span>}
                        </div>
                        {d.url && (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0 ml-2"
                          >
                            <span>View</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Review Status & Notes / Rejection Reason */}
            {(selectedApp.review_notes || selectedApp.rejection_reason || selectedApp.reviewer_name) && (
              <div className="bg-secondary/20 border border-border/30 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Review Audit Trail</div>
                {selectedApp.reviewer_name && (
                  <div>
                    <span className="text-muted-foreground">Reviewed by:</span> <strong className="text-white">{selectedApp.reviewer_name}</strong>
                    {selectedApp.reviewed_at && <span className="text-muted-foreground ml-2">({new Date(selectedApp.reviewed_at).toLocaleString()})</span>}
                  </div>
                )}
                {selectedApp.review_notes && (
                  <div>
                    <span className="text-muted-foreground">Review Notes:</span>
                    <div className="text-white/80 mt-0.5 bg-input/40 p-2 rounded">{selectedApp.review_notes}</div>
                  </div>
                )}
                {selectedApp.rejection_reason && (
                  <div className="border border-red-500/30 bg-red-500/10 p-2.5 rounded-lg text-red-300">
                    <strong className="block text-red-400 mb-0.5">Rejection Reason:</strong>
                    {selectedApp.rejection_reason}
                  </div>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/30">
              <div>
                {canManage && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteRegistration(selectedApp)}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Registration
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedApp(null)}>
                  Close
                </Button>
                {selectedApp.status === "pending" && canManage && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setRejectingApp(selectedApp);
                        setRejectionReason("");
                        setRejectionNotes("");
                      }}
                      className="bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject Application
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setApprovingApp(selectedApp);
                        setApprovalNotes("Approved by reviewing officer");
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Approve Registration
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Approve Confirmation ───────────────────────────── */}
      {approvingApp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full border border-emerald-500/40 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Confirm Institution Registration Approval</h3>
            </div>

            <div className="text-xs text-white/80 space-y-2 leading-relaxed">
              <p>You are authorizing formal regulatory approval for:</p>
              <div className="bg-secondary/40 border border-emerald-500/30 rounded-lg p-3">
                <div className="font-bold text-sm text-white">{approvingApp.institution_name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Ref: {approvingApp.id} · Region: {approvingApp.region} · Official: {approvingApp.official_email}
                </div>
              </div>
              <p className="text-emerald-300/90 text-[11px]">
                Upon confirmation, this college profile will be committed into the authoritative AICTE PostgreSQL database, admitted into the National Directory, linked to authorized institutional accounts, and an official confirmation email will be dispatched.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Approval Notes / Internal Order Reference
              </label>
              <textarea
                rows={2}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g. Scrutinized against EOA 2026-27 records. All parameters verified."
                className="w-full p-2.5 rounded-lg bg-input border border-border/40 text-foreground text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
              <Button type="button" variant="outline" size="sm" onClick={() => setApprovingApp(null)} disabled={isApproving}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApproveConfirm}
                disabled={isApproving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Committing to PostgreSQL...
                  </>
                ) : (
                  <>
                    <CheckCheck className="w-3.5 h-3.5" />
                    Confirm & Authorize Approval
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Reject Reason ───────────────────────────────────── */}
      {rejectingApp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full border border-red-500/40 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-400">
              <XCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Reject Institution Registration</h3>
            </div>

            <div className="text-xs text-white/80 space-y-2 leading-relaxed">
              <p>You are rejecting the application submitted by:</p>
              <div className="bg-secondary/40 border border-red-500/30 rounded-lg p-3">
                <div className="font-bold text-sm text-white">{rejectingApp.institution_name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Ref: {rejectingApp.id} · Email: {rejectingApp.official_email}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-red-300 mb-1">
                Rejection Reason (Communicated to applicant) <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Specify regulatory non-compliance, missing affiliation documents, or invalid representative credentials..."
                className="w-full p-2.5 rounded-lg bg-input border border-red-500/40 text-foreground text-xs outline-none focus:border-red-500"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Internal Review Notes (Optional)
              </label>
              <input
                type="text"
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Internal audit remarks"
                className="w-full h-8 px-3 rounded-lg bg-input border border-border/40 text-foreground text-xs outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
              <Button type="button" variant="outline" size="sm" onClick={() => setRejectingApp(null)} disabled={isRejecting}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleRejectConfirm}
                disabled={isRejecting}
                className="bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5"
              >
                {isRejecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Recording Rejection...
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    Confirm Rejection & Dispatch Notice
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

