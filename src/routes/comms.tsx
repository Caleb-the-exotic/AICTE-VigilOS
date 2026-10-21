import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { 
  Send, Bot, User as UserIcon, Sparkles, Loader2, Plus, Trash2, Pencil,
  Search, Reply, Forward, Tag, MailOpen, Inbox, Star, AlertTriangle, 
  RotateCw, MoreVertical, ChevronLeft, ChevronRight, HelpCircle, Settings,
  Grid, CheckSquare, Square, Mail as MailIcon, Paperclip, X, Minimize2, Maximize2,
  Volume2
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { mailStore, DEFAULT_LABELS, type Mail } from "@/lib/mail-store";
import { toast } from "sonner";
import { VoiceInputButton, ReadAloudButton } from "@/components/VoiceControls";

export const Route = createFileRoute("/comms")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }) as { q?: string },
  component: CommsHubPage,
});

type Folder = Mail["folder"] | "starred" | `label:${string}`;

function CommsHubPage() {
  const { user } = useAuth();
  const searchParams = Route.useSearch() as { q?: string };

  const [mailFolder, setMailFolder] = useState<Folder>("inbox");
  const [mailSelected, setMailSelected] = useState<string | null>(null);
  const [mailComposing, setMailComposing] = useState<null | { to?: string; subject?: string; body?: string; inReplyTo?: string; threadId?: string }>(null);
  const [mailSearchQuery, setMailSearchQuery] = useState("");
  const [, forceUpdateMail] = useState(0);

  const mailItems = useMemo(() => {
    if (mailSearchQuery.trim()) return mailStore.search(mailSearchQuery);
    if (mailFolder === "starred") return mailStore.starred();
    if (typeof mailFolder === "string" && mailFolder.startsWith("label:")) return mailStore.byLabel(mailFolder.slice(6));
    return mailStore.list(mailFolder as Mail["folder"]);
  }, [mailFolder, mailSearchQuery, forceUpdateMail]);

  const mailCurrent = mailSelected ? mailStore.byId(mailSelected) : null;
  const mailThread = mailCurrent?.threadId ? mailStore.thread(mailCurrent.threadId) : [];

  const mailReplyTo = (m: Mail) => setMailComposing({ to: m.from, subject: m.subject.startsWith("Re:") ? m.subject : "Re: " + m.subject, body: `\n\n--- Original ---\n${m.body}`, inReplyTo: m.id, threadId: m.threadId });
  const mailForwardOf = (m: Mail) => setMailComposing({ subject: "Fwd: " + m.subject, body: `\n\n--- Forwarded ---\nFrom: ${m.from}\n\n${m.body}` });

  useEffect(() => {
    const f = () => forceUpdateMail((x) => x + 1);
    window.addEventListener("mail-updated", f);
    return () => window.removeEventListener("mail-updated", f);
  }, []);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-4 px-2 md:px-4">
        {/* ── GMAIL STYLE MAILBOX VIEW ── */}
        <div className="h-[calc(100vh-6rem)] flex flex-col bg-background/95 rounded-2xl border border-border/40 overflow-hidden shadow-2xl">
            
            {/* Top Search bar - Gmail Style */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card/65 gap-4">
              <div className="flex items-center gap-3 flex-1 max-w-2xl">
                <div className="relative w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    value={mailSearchQuery} 
                    onChange={(e) => setMailSearchQuery(e.target.value)} 
                    placeholder="Search mail" 
                    className="w-full h-11 pl-10 pr-4 rounded-full bg-background border border-border/40 text-base text-foreground placeholder-muted-foreground input-glow focus:outline-none" 
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button className="p-2.5 rounded-full hover:bg-secondary/40 text-muted-foreground hover:text-foreground" aria-label="Help">
                  <HelpCircle className="w-5 h-5" />
                </button>
                <button className="p-2.5 rounded-full hover:bg-secondary/40 text-muted-foreground hover:text-foreground" aria-label="Settings">
                  <Settings className="w-5 h-5" />
                </button>
                <button className="p-2.5 rounded-full hover:bg-secondary/40 text-muted-foreground hover:text-foreground" aria-label="Apps">
                  <Grid className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary select-none text-base">
                  {(user?.name || "U").slice(0, 1).toUpperCase()}
                </div>
              </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Sidebar: Navigation & Labels */}
              <aside className="w-64 border-r border-border/30 flex flex-col p-3 bg-secondary/15 shrink-0">
                {/* Gmail Style Compose button */}
                <button 
                  onClick={() => setMailComposing({})} 
                  className="mb-4 py-3 px-6 bg-primary hover:bg-primary/95 text-primary-foreground font-extrabold rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-base w-full"
                >
                  <Pencil className="w-5 h-5" /> Compose
                </button>

                {/* Folders Navigation */}
                <div className="space-y-1">
                  {[
                    { k: "inbox" as Folder, icon: Inbox, label: "Inbox", count: mailStore.unread(), activeColor: "text-red-500 bg-red-500/10 font-bold" },
                    { k: "starred" as Folder, icon: Star, label: "Starred", activeColor: "text-green-500 bg-green-500/10 font-bold" },
                    { k: "sent" as Folder, icon: Send, label: "Sent", activeColor: "text-red-500 bg-red-500/10 font-bold" },
                    { k: "drafts" as Folder, icon: Pencil, label: "Drafts", activeColor: "text-green-500 bg-green-500/10 font-bold" },
                    { k: "trash" as Folder, icon: Trash2, label: "Trash", activeColor: "text-red-500 bg-red-500/10 font-bold" },
                  ].map((f) => {
                    const isSelected = mailFolder === f.k;
                    return (
                      <button 
                        key={f.k as string} 
                        onClick={() => { setMailFolder(f.k); setMailSelected(null); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-base text-left transition-all hover:bg-secondary/60 text-muted-foreground",
                          isSelected ? f.activeColor : "hover:text-foreground"
                        )}
                      >
                        <f.icon className="w-5 h-5 shrink-0" />
                        <span className="flex-1 truncate">{f.label}</span>
                        {f.count ? (
                          <span className="text-xs font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            {f.count}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {/* Labels Section */}
                <div className="mt-6 border-t border-border/20 pt-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground px-3.5 mb-2 font-bold">
                    Labels
                  </div>
                  <div className="space-y-1">
                    {DEFAULT_LABELS.map((l) => {
                      const isSelected = mailFolder === `label:${l}`;
                      return (
                        <button 
                          key={l} 
                          onClick={() => { setMailFolder(`label:${l}`); setMailSelected(null); }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3.5 py-2 rounded-full text-sm text-left transition-all hover:bg-secondary/60 text-muted-foreground",
                            isSelected ? "text-green-500 bg-green-500/10 font-bold" : "hover:text-foreground"
                          )}
                        >
                          <Tag className="w-4 h-4 text-green-500 shrink-0" />
                          <span className="truncate">{l}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </aside>

              {/* Central Panel: List or Detailed view */}
              <main className="flex-1 flex flex-col bg-background overflow-hidden">
                {mailSelected && mailCurrent ? (
                  /* GMAIL DETAIL VIEW PANEL */
                  <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                    {/* Detail toolbar */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card/10 gap-2">
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setMailSelected(null)} 
                          className="p-2 rounded-full hover:bg-secondary/40 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Back to list"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => { mailStore.moveToTrash(mailCurrent.id); setMailSelected(null); forceUpdateMail((x) => x + 1); toast.success("Moved to trash"); }}
                          className="p-2 rounded-full hover:bg-secondary/40 text-destructive cursor-pointer"
                          title="Delete message"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => { mailStore.markRead(mailCurrent.id, false); setMailSelected(null); forceUpdateMail((x) => x + 1); toast.success("Marked as unread"); }}
                          className="p-2 rounded-full hover:bg-secondary/40 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Mark as unread"
                        >
                          <MailOpen className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => { mailStore.toggleStar(mailCurrent.id); forceUpdateMail((x) => x + 1); }} 
                          className="p-2 rounded-full hover:bg-secondary/40 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Star className={cn("w-5 h-5", mailCurrent.starred ? "fill-green-400 text-green-400" : "text-muted-foreground")} />
                        </button>
                      </div>
                    </div>

                    {/* Email content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                      <div className="space-y-2">
                        <h2 className="text-xl font-extrabold tracking-tight text-foreground md:text-2xl">
                          {mailCurrent.subject}
                        </h2>
                        {mailCurrent.labels && mailCurrent.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {mailCurrent.labels.map((l) => (
                              <span key={l} className="text-[10px] uppercase font-bold bg-green-500/10 text-green-400 px-2 py-0.5 rounded-md border border-green-500/20">
                                {l}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Sender details */}
                      <div className="flex items-center justify-between border-b border-border/20 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-secondary border border-border/40 flex items-center justify-center font-bold text-foreground">
                            {mailCurrent.from.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-base font-bold text-foreground">
                              {mailCurrent.from}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              to {mailCurrent.to === "me" ? "me" : mailCurrent.to}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(mailCurrent.ts).toLocaleString()}
                        </div>
                      </div>

                      {/* Thread rendering */}
                      <div className="space-y-4">
                        {mailThread.map((m) => (
                          <div key={m.id} className="bg-secondary/10 border border-border/20 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="font-bold text-foreground">{m.from}</span>
                              <span>{new Date(m.ts).toLocaleString()}</span>
                            </div>
                            <pre className="text-base leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                              {m.body}
                            </pre>
                            {m.attachments && m.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-3 border-t border-border/20">
                                {m.attachments.map((att, idx) => (
                                  <div key={idx} className="flex items-center gap-2 bg-background border border-border/40 px-3 py-1.5 rounded-lg text-xs font-semibold">
                                    <Paperclip className="w-3.5 h-3.5 text-primary" />
                                    <span>{att.name} ({(att.size / 1024).toFixed(1)} KB)</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Bottom action reply buttons */}
                      <div className="flex items-center gap-3 pt-6 border-t border-border/20">
                        <button 
                          onClick={() => mailReplyTo(mailCurrent)}
                          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 py-2.5 rounded-xl cursor-pointer text-sm transition-all"
                        >
                          <Reply className="w-4 h-4" /> Reply
                        </button>
                        <button 
                          onClick={() => mailForwardOf(mailCurrent)}
                          className="flex items-center gap-2 bg-secondary hover:bg-secondary/90 text-foreground font-bold px-4 py-2.5 rounded-xl border border-border/40 cursor-pointer text-sm transition-all"
                        >
                          <Forward className="w-4 h-4" /> Forward
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* GMAIL LIST PANEL */
                  <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                    
                    {/* Action Toolbar */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-card/25 gap-2 select-none">
                      <div className="flex items-center gap-3">
                        <button className="p-2 rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground">
                          <Square className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => forceUpdateMail((x) => x + 1)}
                          className="p-2 rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Refresh list"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Pagination UI */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        <span>1-{mailItems.length} of {mailItems.length}</span>
                        <div className="flex items-center gap-0.5">
                          <button className="p-1.5 rounded hover:bg-secondary/45 disabled:opacity-20" disabled><ChevronLeft className="w-4 h-4" /></button>
                          <button className="p-1.5 rounded hover:bg-secondary/45 disabled:opacity-20" disabled><ChevronRight className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>

                    {/* Email List view */}
                    <div className="flex-1 overflow-y-auto scrollbar-thin">
                      {mailItems.length === 0 ? (
                        <div className="py-20 text-center text-base text-muted-foreground space-y-2">
                          <MailIcon className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                          <div className="font-bold">No mail conversations in this folder</div>
                          <p className="text-xs text-muted-foreground max-w-xs mx-auto">Messages or notifications will appear here once received.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/20">
                          {mailItems.map((m) => {
                            const isUnread = !m.read && mailFolder === "inbox";
                            return (
                              <div 
                                key={m.id}
                                className={cn(
                                  "w-full flex items-center px-4 py-3.5 transition-all text-left relative hover:bg-secondary/35 group border-b border-border/20 cursor-pointer gap-4",
                                  isUnread ? "bg-red-500/5 font-semibold text-foreground" : "text-muted-foreground/90"
                                )}
                                onClick={() => { 
                                  setMailSelected(m.id); 
                                  if (!m.read) { 
                                    mailStore.markRead(m.id); 
                                    forceUpdateMail((x) => x + 1); 
                                  } 
                                }}
                              >
                                {/* Left strip indicator for unread emails */}
                                {isUnread && (
                                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-600" />
                                )}

                                {/* Row Controls */}
                                <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button className="text-muted-foreground/45 hover:text-foreground">
                                    <Square className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => { mailStore.toggleStar(m.id); forceUpdateMail((x) => x + 1); }}
                                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                                  >
                                    <Star className={cn("w-4 h-4", m.starred ? "fill-green-400 text-green-400" : "text-muted-foreground/30")} />
                                  </button>
                                </div>

                                {/* Sender Field */}
                                <div className={cn("w-48 truncate shrink-0 text-base", isUnread ? "text-foreground font-bold" : "text-muted-foreground font-medium")}>
                                  {mailFolder === "sent" ? `To: ${m.to}` : m.from}
                                </div>

                                {/* Subject & Body Snippet */}
                                <div className="flex-1 min-w-0 flex items-baseline gap-2 text-base">
                                  <span className={cn("truncate", isUnread ? "text-foreground font-bold" : "text-foreground/90 font-medium")}>
                                    {m.subject}
                                  </span>
                                  <span className="text-muted-foreground/60 text-sm truncate font-normal">
                                    — {m.body}
                                  </span>
                                </div>

                                {/* Date/Time & Hover Actions */}
                                <div className="shrink-0 flex items-center justify-end min-w-[70px] text-right" onClick={(e) => e.stopPropagation()}>
                                  {/* Normal Timestamp */}
                                  <span className="text-xs text-muted-foreground font-semibold group-hover:hidden">
                                    {new Date(m.ts).toLocaleDateString([], { month: "short", day: "numeric" })}
                                  </span>
                                  {/* Hover Actions */}
                                  <div className="hidden group-hover:flex items-center gap-1.5">
                                    <button 
                                      onClick={() => { mailStore.moveToTrash(m.id); forceUpdateMail((x) => x + 1); toast.success("Moved to trash"); }}
                                      className="p-1.5 rounded hover:bg-secondary/65 text-destructive cursor-pointer"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-4.5 h-4.5" />
                                    </button>
                                    <button 
                                      onClick={() => { mailStore.markRead(m.id, !m.read); forceUpdateMail((x) => x + 1); }}
                                      className="p-1.5 rounded hover:bg-secondary/65 text-foreground cursor-pointer"
                                      title={m.read ? "Mark unread" : "Mark read"}
                                    >
                                      <MailOpen className="w-4.5 h-4.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </main>

            </div>
          </div>

        {/* ── FLOATING GMAIL-STYLE COMPOSE BOX ── */}
        {mailComposing && (
          <div className="fixed bottom-0 right-8 w-[540px] bg-card border border-border/40 rounded-t-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-scale-in">
            {/* Header toolbar */}
            <div className="bg-secondary/40 px-4 py-3 flex items-center justify-between border-b border-border/30 select-none">
              <span className="text-base font-bold text-foreground">New Message</span>
              <div className="flex items-center gap-2">
                <button className="text-muted-foreground hover:text-foreground p-1"><Minimize2 className="w-4 h-4" /></button>
                <button className="text-muted-foreground hover:text-foreground p-1"><Maximize2 className="w-4 h-4" /></button>
                <button 
                  onClick={() => setMailComposing(null)} 
                  className="text-muted-foreground hover:text-destructive p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Compose inputs */}
            <form 
              onSubmit={(e) => { 
                e.preventDefault(); 
                mailStore.send(
                  (e.target as any).to.value, 
                  (e.target as any).subject.value, 
                  (e.target as any).body.value, 
                  { inReplyTo: mailComposing.inReplyTo, threadId: mailComposing.threadId }
                ); 
                toast.success("Message sent successfully!"); 
                setMailComposing(null); 
                setMailFolder("sent"); 
                forceUpdateMail((x) => x + 1); 
              }} 
              className="p-4 space-y-3 flex flex-col"
            >
              <div className="border-b border-border/20 py-1.5 flex items-center gap-2 text-base">
                <span className="text-muted-foreground font-bold shrink-0 w-8">To</span>
                <input 
                  required 
                  name="to"
                  type="email" 
                  defaultValue={mailComposing.to || ""} 
                  className="w-full bg-transparent border-0 focus:outline-none font-semibold text-foreground" 
                />
              </div>
              <div className="border-b border-border/20 py-1.5 flex items-center gap-2 text-base">
                <span className="text-muted-foreground font-bold shrink-0 w-16">Subject</span>
                <input 
                  required 
                  name="subject"
                  defaultValue={mailComposing.subject || ""} 
                  className="w-full bg-transparent border-0 focus:outline-none font-semibold text-foreground" 
                />
              </div>
              <textarea 
                required 
                name="body"
                rows={11} 
                placeholder="Write your message..." 
                defaultValue={mailComposing.body || ""} 
                className="w-full bg-transparent border-0 focus:outline-none text-base resize-none text-foreground py-2" 
              />

              {/* Footer actions */}
              <div className="flex items-center justify-between border-t border-border/20 pt-4">
                <div className="flex items-center gap-2">
                  <button 
                    type="submit" 
                    className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold px-6 py-2.5 rounded-xl cursor-pointer text-sm shadow-md shadow-primary/20"
                  >
                    Send
                  </button>
                  <label className="p-2 rounded-xl border border-border/40 hover:border-primary/40 text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center">
                    <input type="file" multiple className="hidden" />
                    <Paperclip className="w-4 h-4" />
                  </label>
                </div>
                
                <button 
                  type="button" 
                  onClick={() => {
                    toast.success("Draft saved"); 
                    setMailComposing(null); 
                  }}
                  className="text-sm font-semibold text-muted-foreground hover:text-foreground px-3 py-2 cursor-pointer"
                >
                  Discard Draft
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
