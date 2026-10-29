

import React, { useState } from "react";
import { History, ShieldAlert, AlertOctagon, Clock, User, CheckCircle2, FileText, Send, Calendar, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActionType =
  | "INSPECTION_SCHEDULED"
  | "DOCUMENT_REQUESTED"
  | "SHOW_CAUSE_NOTICE"
  | "HEARING_SUMMONED"
  | "PENALTY_PROPOSED"
  | "STATUS_CHANGE"
  | "OFFICER_REASSIGNED";

export interface CaseAction {
  id: string;
  case_id: string;
  aicte_pid: string;
  bureau: string;
  action_type: ActionType;
  title: string;
  details: string;
  actor: string;
  timestamp: string;
}

export interface ActionConflict {
  action1: CaseAction;
  action2: CaseAction;
  conflict_type: "DUPLICATE_INSPECTION" | "CONCURRENT_DOCUMENT_REQUEST" | "CONTRADICTORY_DIRECTIVE" | "SIMULTANEOUS_HEARING";
  severity: "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
  recommended_remedy: string;
}

export interface ActionHistoryViewerProps {
  caseId: string;
  aictePid: string;
  bureau: string;
  allCasesActions?: CaseAction[];
  onAddAction?: (action: Omit<CaseAction, "id" | "timestamp">) => void;
}

// ── Deterministic Action Conflict Detection Engine ───────────────────────
export function detectActionConflicts(actions: CaseAction[], targetPid: string): ActionConflict[] {
  const conflicts: ActionConflict[] = [];
  const instActions = actions.filter((a) => a.aicte_pid === targetPid);

  for (let i = 0; i < instActions.length; i++) {
    for (let j = i + 1; j < instActions.length; j++) {
      const a1 = instActions[i];
      const a2 = instActions[j];

      // Only evaluate actions from different bureaus or distinct proceedings
      if (a1.case_id === a2.case_id && a1.bureau === a2.bureau) continue;

      // 1. Conflict Rule: Duplicate Surprise Site Inspection Scheduled
      if (a1.action_type === "INSPECTION_SCHEDULED" && a2.action_type === "INSPECTION_SCHEDULED") {
        conflicts.push({
          action1: a1,
          action2: a2,
          conflict_type: "DUPLICATE_INSPECTION",
          severity: "HIGH",
          explanation: `Both ${a1.bureau} (Case ${a1.case_id}) and ${a2.bureau} (Case ${a2.case_id}) have scheduled independent site inspections for this institution.`,
          recommended_remedy: "Consolidate into a Single Joint EVC (Expert Visit Committee) inspection team.",
        });
      }

      // 2. Conflict Rule: Simultaneous Duplicated Document Submission Requests
      if (a1.action_type === "DOCUMENT_REQUESTED" && a2.action_type === "DOCUMENT_REQUESTED") {
        conflicts.push({
          action1: a1,
          action2: a2,
          conflict_type: "CONCURRENT_DOCUMENT_REQUEST",
          severity: "MEDIUM",
          explanation: `Parallel compliance demands issued by ${a1.bureau} and ${a2.bureau}. Institution may receive duplicate requests for faculty affidavits or audited balance sheets.`,
          recommended_remedy: "Federate records in the AICTE 360° Repository so one set of verified compliance documents serves both proceedings.",
        });
      }

      // 3. Conflict Rule: Contradictory Administrative Directives
      if (
        (a1.action_type === "SHOW_CAUSE_NOTICE" && a2.action_type === "HEARING_SUMMONED") ||
        (a1.action_type === "PENALTY_PROPOSED" && a2.action_type === "STATUS_CHANGE")
      ) {
        conflicts.push({
          action1: a1,
          action2: a2,
          conflict_type: "CONTRADICTORY_DIRECTIVE",
          severity: "HIGH",
          explanation: `Contradictory directives: ${a1.bureau} proposed punitive enforcement while ${a2.bureau} is convening an ongoing grievance hearing.`,
          recommended_remedy: "Hold unilateral punitive action in abeyance pending joint inter-bureau coordination.",
        });
      }
    }
  }

  return conflicts;
}

export function ActionHistoryViewer({
  caseId,
  aictePid,
  bureau,
  allCasesActions = [],
  onAddAction,
}: ActionHistoryViewerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionType, setActionType] = useState<ActionType>("INSPECTION_SCHEDULED");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [actor, setActor] = useState("Vigilance Officer");

  // Filter actions for this specific case
  const currentCaseActions = allCasesActions.filter((a) => a.case_id === caseId);

  // Compute live conflicts against all other cases for this same institution
  const activeConflicts = detectActionConflicts(allCasesActions, aictePid);

  const handleCreateAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (onAddAction) {
      onAddAction({
        case_id: caseId,
        aicte_pid: aictePid,
        bureau,
        action_type: actionType,
        title: title.trim(),
        details: details.trim(),
        actor: actor.trim() || "AICTE Official",
      });
    }
    setTitle("");
    setDetails("");
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Conflict Warning Banner if conflicts detected for this institution */}
      {activeConflicts.length > 0 && (
        <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-red-400">
            <AlertOctagon className="w-4 h-4 text-red-500 animate-pulse" />
            <span>Action Conflict Detected Across Bureaus ({activeConflicts.length} Potential Clashes)</span>
          </div>
          <div className="space-y-2">
            {activeConflicts.map((c, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-black/40 border border-red-500/20 text-xs space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-red-300">{c.conflict_type.replace(/_/g, " ")}</span>
                  <span className="px-1.5 py-0.5 rounded font-mono text-[9px] bg-red-950 text-red-400 border border-red-800">
                    {c.severity} SEVERITY
                  </span>
                </div>
                <p className="text-white/80 text-[11px] leading-relaxed">{c.explanation}</p>
                <div className="text-[10px] text-emerald-400 font-medium pt-1">
                  <b>Recommended Remedy:</b> {c.recommended_remedy}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action History Timeline */}
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-border/20 pb-2">
          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <History className="w-4 h-4 text-primary" />
            Official Action Audit Trail ({currentCaseActions.length})
          </h4>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
          >
            {showAddForm ? "Close Form" : "+ Record New Official Action"}
          </button>
        </div>

        {/* Record New Action Inline Form */}
        {showAddForm && (
          <form onSubmit={handleCreateAction} className="p-3 rounded-xl bg-secondary/30 border border-border/40 space-y-2.5 text-xs animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Action Type</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as ActionType)}
                  className="w-full h-8 px-2 rounded-lg bg-input border border-border/40 text-foreground text-xs"
                >
                  <option value="INSPECTION_SCHEDULED">Surprise Site Inspection Scheduled</option>
                  <option value="DOCUMENT_REQUESTED">Compliance Documentation Requested</option>
                  <option value="SHOW_CAUSE_NOTICE">Issue Show-Cause Notice</option>
                  <option value="HEARING_SUMMONED">Summon Principal/Trustee for Hearing</option>
                  <option value="PENALTY_PROPOSED">Regulatory Penalty Proposed</option>
                  <option value="STATUS_CHANGE">Change Case Processing Status</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Authorizing Official</label>
                <input
                  type="text"
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                  placeholder="e.g. Dr. Ramesh Gupta (RB)"
                  className="w-full h-8 px-2 rounded-lg bg-input border border-border/40 text-foreground text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Action Title / Heading</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Surprise Faculty Cadre Verification Inspection on-site"
                className="w-full h-8 px-2 rounded-lg bg-input border border-border/40 text-foreground text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Details & Statutory Reference</label>
              <textarea
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Specify specific order number, designated committee members, or required documents..."
                className="w-full p-2 rounded-lg bg-input border border-border/40 text-foreground text-xs resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-2.5 py-1 text-xs rounded-lg bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-xs rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold cursor-pointer"
              >
                Save Action to Case
              </button>
            </div>
          </form>
        )}

        {/* Timeline list */}
        {currentCaseActions.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground">
            No official administrative actions logged yet for this case.
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {currentCaseActions.map((a) => (
              <div key={a.id} className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    {a.title}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {new Date(a.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                {a.details && (
                  <p className="text-[11px] text-muted-foreground/90 pl-5 leading-relaxed">{a.details}</p>
                )}
                <div className="text-[10px] text-muted-foreground pl-5 flex items-center gap-2 pt-0.5">
                  <span>Authorized by: <b>{a.actor}</b></span>
                  <span>•</span>
                  <span>Bureau: <b>{a.bureau}</b></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

