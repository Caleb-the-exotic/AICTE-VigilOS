import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Calendar, User, Tag, FileText, CheckCircle2, XCircle, Download, ArrowLeft, MessageSquare,
  Paperclip, ShieldAlert, History, Send, Copy, Trash2, RefreshCcw, HelpCircle, Edit3, Eye, Sparkles, Clock
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { requestsStore, STATUS_STYLES, type PolicyFinding } from "@/lib/requests-store";
import { useAuth } from "@/lib/auth";
import { api, HAS_BACKEND } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/requests/$id")({ component: RequestDetail });

function generatePolicy(): PolicyFinding[] {
  return [
    { rule: "AICTE attendance ≥ 75%", status: "pass", detail: "Student stands at 87% YTD attendance." },
    { rule: "No overlapping OD", status: "pass", detail: "No prior approved OD in this window." },
    { rule: "Mid-term exam conflict check", status: "warn", detail: "Falls 2 days before semester exam." },
    { rule: "Faculty advisor concurrence", status: "pass", detail: "Advisor signature on file." },
    { rule: "Event proof attached", status: "pass", detail: "Invitation letter verified by classifier." },
  ];
}

function RequestDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [, force] = useState(0);
  const r = useMemo(() => requestsStore.byId(id), [id]);
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [comment, setComment] = useState("");

  if (!r) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto text-center py-20">
          <h1 className="text-xl font-bold">Request not found</h1>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => nav({ to: "/requests" })}>Back to list</Button>
        </div>
      </AppLayout>
    );
  }

  const isOwner = user?.id === r.studentId || user?.name === r.studentName;
  const canReview = user && (user.role === "approval_officer" || user.role === "bureau_head" || user.role === "super_admin");
  const policy = r.policy ?? generatePolicy();

  const decide = (status: "approved" | "rejected") => {
    if (status === "rejected" && !rejectReason.trim()) { toast.error("Reason is required to reject"); return; }
    requestsStore.update(r.id, {
      status,
      reviewer: user?.name,
      reviewerNote: status === "rejected" ? rejectReason : (note || undefined),
      policy: status === "rejected" ? policy : undefined,
    }, user?.name, status === "rejected" ? `Reason: ${rejectReason}` : undefined);
    toast.success(`Request ${status}`);
    force((x) => x + 1);
  };

  const withdraw = () => {
    requestsStore.withdraw(r.id, user?.name || "Citizen");
    toast.success("Request withdrawn");
    force((x) => x + 1);
  };

  const submitDraft = () => {
    requestsStore.update(r.id, { status: "pending" }, user?.name, "Submitted draft");
    toast.success("Draft submitted");
    force((x) => x + 1);
  };

  const duplicate = () => {
    const copy = requestsStore.create({
      title: r.title + " (copy)", category: r.category, description: r.description,
      startDate: r.startDate, endDate: r.endDate,
      studentId: user?.id || r.studentId, studentName: user?.name || r.studentName,
      attachments: r.attachments,
    }, { status: "draft", parentId: r.id });
    toast.success("Cloned as draft");
    nav({ to: "/requests/$id", params: { id: copy.id } });
  };

  const resubmit = () => {
    const copy = requestsStore.create({
      title: r.title, category: r.category, description: r.description,
      startDate: r.startDate, endDate: r.endDate,
      studentId: user?.id || r.studentId, studentName: user?.name || r.studentName,
      attachments: r.attachments,
    }, { parentId: r.id });
    toast.success("Re-submitted as new request");
    nav({ to: "/requests/$id", params: { id: copy.id } });
  };

  const explainRejection = () => {
    const prompt = `Why was OD request ${r.id} (${r.category} — ${r.title}) rejected? Reason given: "${r.reviewerNote}". What can the student do next?`;
    nav({ to: "/chat", search: { q: prompt } });
  };

  const submitComment = () => {
    if (!comment.trim()) return;
    requestsStore.addComment(r.id, user?.name || "Anonymous", comment.trim());
    setComment("");
    force((x) => x + 1);
  };

  const exportPdf = () => {
    if (HAS_BACKEND) { window.open(api.exportPdfUrl(r.id), "_blank"); return; }
    const text = `VigilOS — OD Request\n\nID: ${r.id}\nTitle: ${r.title}\nCategory: ${r.category}\nStudent: ${r.studentName}\nFrom: ${new Date(r.startDate).toLocaleDateString()}\nTo: ${new Date(r.endDate).toLocaleDateString()}\nStatus: ${r.status}\n\nDescription:\n${r.description}\n\nReviewer: ${r.reviewer || "—"}\nNote: ${r.reviewerNote || "—"}\n`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${r.id}.txt`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Mock export downloaded.");
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-4 print:max-w-full">
        <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
          <Button variant="ghost" size="sm" onClick={() => nav({ to: "/requests" })}><ArrowLeft className="w-4 h-4" /> Back</Button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md border ${STATUS_STYLES[r.status]}`}>
              {r.status.replace("_", " ")}
            </span>
            <Button variant="outline" size="sm" onClick={() => window.print()}><FileText className="w-4 h-4" /> Print</Button>
            <Button variant="outline" size="sm" onClick={exportPdf}><Download className="w-4 h-4" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={duplicate}><Copy className="w-4 h-4" /> Duplicate</Button>
            {isOwner && r.status === "draft" && (
              <>
                <Button variant="outline" size="sm" onClick={() => nav({ to: "/requests/new", search: { edit: r.id } })}><Edit3 className="w-4 h-4" /> Edit</Button>
                <Button variant="neon" size="sm" onClick={submitDraft}><Send className="w-4 h-4" /> Submit</Button>
              </>
            )}
            {isOwner && (r.status === "pending" || r.status === "in_review") && (
              <Button variant="destructive" size="sm" onClick={withdraw}><Trash2 className="w-4 h-4" /> Withdraw</Button>
            )}
            {isOwner && r.status === "rejected" && (
              <Button variant="neon" size="sm" onClick={resubmit}><RefreshCcw className="w-4 h-4" /> Re-submit</Button>
            )}
          </div>
        </div>

        <div className="glass-card glass-card-glow p-6 animate-fade-in">
          <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
            {r.id}
            {r.parentId && <Link to="/requests/$id" params={{ id: r.parentId }} className="text-primary hover:underline">· parent {r.parentId}</Link>}
          </div>
          <h1 className="text-xl font-bold mt-1">{r.title}</h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 text-xs">
            <Info icon={<User className="w-3.5 h-3.5" />} label="Student" value={r.studentName} />
            <Info icon={<Tag className="w-3.5 h-3.5" />} label="Category" value={r.category} />
            <Info icon={<Calendar className="w-3.5 h-3.5" />} label="From" value={new Date(r.startDate).toLocaleDateString()} />
            <Info icon={<Calendar className="w-3.5 h-3.5" />} label="To" value={new Date(r.endDate).toLocaleDateString()} />
          </div>

          {/* Progress Flow Tracker */}
          <div className="mt-6 border-t border-border/20 pt-6">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Progress Flow Tracker
            </div>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 bg-secondary/15 p-4 rounded-xl border border-border/30">
              {[
                { label: "Submitted", icon: Clock, done: true },
                { label: "AI Classified", icon: Sparkles, done: true },
                { label: "Under Review", icon: Eye, done: r.status !== "pending" && r.status !== "draft" },
                { label: r.status === "rejected" ? "Rejected" : r.status === "withdrawn" ? "Withdrawn" : "Approved", icon: r.status === "rejected" ? XCircle : r.status === "withdrawn" ? XCircle : CheckCircle2, done: r.status === "approved" || r.status === "rejected" || r.status === "withdrawn" },
              ].map((s, i, arr) => (
                <div key={s.label} className="flex-1 flex items-center gap-2 min-w-[130px]">
                  <div className={cn(
                    "w-8 h-8 rounded-full grid place-items-center border shrink-0",
                    s.done 
                      ? "bg-primary/15 border-primary/40 text-primary neon-glow" 
                      : "bg-secondary/40 border-border/30 text-muted-foreground"
                  )}>
                    <s.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-[11px] font-bold text-foreground">{s.label}</div>
                  {i < arr.length - 1 && (
                    <div className={cn(
                      "flex-1 h-px hidden sm:block",
                      s.done ? "bg-primary/40" : "bg-border/40"
                    )} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5"><FileText className="w-3.5 h-3.5" /> Description</div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{r.description || "—"}</p>
          </div>

          {r.attachments && r.attachments.length > 0 && (
            <div className="mt-5">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5"><Paperclip className="w-3.5 h-3.5" /> Attachments ({r.attachments.length})</div>
              <ul className="space-y-1.5">
                {r.attachments.map((a, i) => (
                  <li key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary/40 border border-border/30">
                    <span className="truncate">{a.name}</span>
                    <span className="text-muted-foreground">{(a.size / 1024).toFixed(1)} KB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.reviewer && (
            <div className="mt-5 p-3 rounded-lg bg-secondary/40 border border-border/30">
              <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center justify-between">
                <span>Reviewer · {r.reviewer}</span>
                {r.status === "rejected" && (
                  <button onClick={explainRejection} className="text-primary hover:underline flex items-center gap-1 text-[11px]">
                    <HelpCircle className="w-3 h-3" /> Explain this rejection
                  </button>
                )}
              </div>
              <div className="text-sm">{r.reviewerNote || "—"}</div>
            </div>
          )}
        </div>

        {(r.status === "rejected" || canReview) && (
          <div className="glass-card p-5 animate-fade-in print:hidden">
            <div className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <ShieldAlert className="w-4 h-4 text-primary" /> Policy engine results
              {r.status === "rejected" && <span className="text-[10px] text-red-400 ml-1">· rejection basis</span>}
            </div>
            <ul className="space-y-1.5">
              {policy.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-secondary/30 border border-border/30">
                  <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${p.status === "pass" ? "bg-green-500" : p.status === "warn" ? "bg-red-500" : "bg-red-500"}`} />
                  <div className="flex-1">
                    <div className="font-medium">{p.rule}</div>
                    <div className="text-muted-foreground">{p.detail}</div>
                  </div>
                  <span className={`text-[9px] uppercase font-semibold ${p.status === "pass" ? "text-green-400" : p.status === "warn" ? "text-red-400" : "text-red-400"}`}>{p.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canReview && r.status !== "approved" && r.status !== "rejected" && r.status !== "withdrawn" && r.status !== "draft" && (
          <div className="glass-card p-4 space-y-3 animate-fade-in print:hidden">
            <div className="text-sm font-semibold flex items-center gap-1.5"><MessageSquare className="w-4 h-4 text-primary" /> Reviewer decision</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Approval note (optional)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-input border border-border/30 text-sm input-glow focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Rejection reason (required to reject)</label>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3}
                  placeholder="e.g., Falls during exam week"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-input border border-border/30 text-sm input-glow focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="destructive" size="sm" onClick={() => decide("rejected")}><XCircle className="w-4 h-4" /> Reject</Button>
              <Button variant="neon" size="sm" onClick={() => decide("approved")}><CheckCircle2 className="w-4 h-4" /> Approve</Button>
            </div>
          </div>
        )}

        {/* Timeline + comments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
          <div className="glass-card p-5">
            <div className="text-sm font-semibold flex items-center gap-1.5 mb-3"><History className="w-4 h-4 text-primary" /> Activity timeline</div>
            <ol className="relative border-l border-border/40 ml-2 space-y-3">
              {(r.activity || []).slice().reverse().map((a) => (
                <li key={a.id} className="ml-3">
                  <div className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-primary/60 border border-background" />
                  <div className="text-xs font-medium">{a.message}</div>
                  <div className="text-[10px] text-muted-foreground">{a.actor} · {new Date(a.ts).toLocaleString()}</div>
                </li>
              ))}
            </ol>
          </div>

          <div className="glass-card p-5 flex flex-col">
            <div className="text-sm font-semibold flex items-center gap-1.5 mb-3"><MessageSquare className="w-4 h-4 text-primary" /> Discussion</div>
            <div className="flex-1 space-y-2 mb-3 max-h-64 overflow-auto scrollbar-thin">
              {(r.comments || []).length === 0 && <div className="text-xs text-muted-foreground">No comments yet. Start the discussion.</div>}
              {(r.comments || []).map((c) => (
                <div key={c.id} className="text-xs p-2.5 rounded-lg bg-secondary/30 border border-border/30">
                  <div className="font-medium">{c.author} <span className="text-muted-foreground font-normal">· {new Date(c.ts).toLocaleString()}</span></div>
                  <div className="mt-1 whitespace-pre-wrap">{c.text}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment…"
                onKeyDown={(e) => e.key === "Enter" && submitComment()}
                className="flex-1 h-9 px-3 rounded-lg bg-input border border-border/30 text-xs input-glow focus:outline-none" />
              <Button variant="neon" size="sm" onClick={submitComment}><Send className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-secondary/40 border border-border/30">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon} {label}</div>
      <div className="text-sm font-medium mt-1">{value}</div>
    </div>
  );
}
