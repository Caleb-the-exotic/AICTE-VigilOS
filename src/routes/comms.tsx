import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { 
  Send, Bot, User as UserIcon, Sparkles, Loader2, Plus, Trash2, Pencil,
  Search, Reply, Forward, Tag, MailOpen, Inbox, Star, AlertTriangle, 
  RotateCw, MoreVertical, ChevronLeft, ChevronRight, HelpCircle, Settings,
  Grid, CheckSquare, Square, Mail as MailIcon, Paperclip, X, Minimize2, Maximize2,
  Volume2, MessagesSquare, MessageSquare, Menu
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { mailStore, DEFAULT_LABELS, type Mail } from "@/lib/mail-store";
import { api, type LiveChatMessage } from "@/lib/api";
import { toast } from "sonner";
import { VoiceInputButton, ReadAloudButton } from "@/components/VoiceControls";

export const Route = createFileRoute("/comms")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }) as { q?: string; tab?: string },
  component: CommsHubPage,
});

type Folder = Mail["folder"] | "starred" | `label:${string}`;

function CommsHubPage() {
  const { user } = useAuth();
  const searchParams = Route.useSearch() as { q?: string; tab?: string };

  const [mailFolder, setMailFolder] = useState<Folder>("inbox");
  const [mailSelected, setMailSelected] = useState<string | null>(null);
  const [mailComposing, setMailComposing] = useState<null | { to?: string; subject?: string; body?: string; inReplyTo?: string; threadId?: string }>(null);
  const [mailSearchQuery, setMailSearchQuery] = useState("");
  const [, forceUpdateMail] = useState(0);

  // Live Chat state
  const [viewMode, setViewMode] = useState<"mail" | "chat">(() => (searchParams.tab === "chat" ? "chat" : "mail"));
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>(() => {
    try {
      const local = localStorage.getItem("aicte_live_chat_msgs");
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [mobileFolderOpen, setMobileFolderOpen] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const fetchLiveChat = async () => {
    try {
      const msgs = await api.getLiveChatMessages();
      if (msgs && Array.isArray(msgs)) {
        setChatMessages(msgs);
        localStorage.setItem("aicte_live_chat_msgs", JSON.stringify(msgs));
      }
    } catch {
      try {
        const local = localStorage.getItem("aicte_live_chat_msgs");
        if (local) setChatMessages(JSON.parse(local));
      } catch {/**/}
    }
  };

  useEffect(() => {
    fetchLiveChat();
    const timer = setInterval(fetchLiveChat, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (viewMode === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, viewMode]);

  const handleSendChatMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    setChatSending(true);

    const tempId = "local-" + Date.now();
    const tempMsg: LiveChatMessage = {
      id: tempId,
      sender_id: user?.id || user?.email || "me",
      sender_name: user?.name || "Officer",
      sender_role: user?.role || "approval_officer",
      text,
      created_at: new Date().toISOString(),
    };

    const updated = [...chatMessages, tempMsg];
    setChatMessages(updated);
    localStorage.setItem("aicte_live_chat_msgs", JSON.stringify(updated));
    setChatInput("");

    try {
      const saved = await api.sendLiveChatMessage(text, user?.name, user?.role);
      if (saved && saved.id) {
        setChatMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)));
      }
    } catch (err) {
      console.warn("Backend offline, message kept locally:", err);
    } finally {
      setChatSending(false);
    }
  };

  const formatChatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }) + " · " + date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      });
    } catch {
      return isoString;
    }
  };

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
      <div className="max-w-7xl mx-auto space-y-4 px-1.5 sm:px-2 md:px-4">
        {/* ── GMAIL STYLE MAILBOX VIEW ── */}
        <div className="h-[calc(100vh-5.5rem)] md:h-[calc(100vh-6rem)] flex flex-col bg-background/95 rounded-2xl border border-border/40 overflow-hidden shadow-2xl relative">
            
            {/* Top Search bar - Gmail Style */}
            <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border/30 bg-card/65 gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                {/* Mobile sidebar toggle button */}
                <button
                  type="button"
                  onClick={() => setMobileFolderOpen((prev) => !prev)}
                  className="md:hidden p-2 rounded-xl bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0 border border-border/30"
                  title="Toggle Folders"
                >
                  <Menu className="w-4 h-4" />
                </button>

                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    value={mailSearchQuery} 
                    onChange={(e) => setMailSearchQuery(e.target.value)} 
                    placeholder="Search mail" 
                    className="w-full h-10 sm:h-11 pl-9 sm:pl-10 pr-3 sm:pr-4 rounded-full bg-background border border-border/40 text-sm sm:text-base text-foreground placeholder-muted-foreground input-glow focus:outline-none" 
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {viewMode === "chat" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("mail");
                      setMailSelected(null);
                    }}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer shadow-md border bg-secondary/80 hover:bg-secondary text-foreground border-border/50 hover:border-primary/50 active:scale-[0.98]"
                    title="Back to Mail view"
                  >
                    <MailIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                    <span>Back to Mail</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("chat");
                      setMailSelected(null);
                    }}
                    className="flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer shadow-md border bg-secondary/60 hover:bg-primary/15 text-foreground border-border/40 hover:border-primary/50 active:scale-[0.98]"
                    title="Open Live Chat"
                  >
                    <MessagesSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                    <span>Live Chat</span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </button>
                )}
              </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">
              
              {/* Mobile Drawer Backdrop */}
              {mobileFolderOpen && (
                <div 
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 md:hidden animate-fade-in"
                  onClick={() => setMobileFolderOpen(false)}
                />
              )}

              {/* Sidebar: Navigation & Labels */}
              <aside 
                className={cn(
                  "border-r border-border/30 flex flex-col p-3 bg-card md:bg-secondary/15 shrink-0 transition-transform duration-200 ease-in-out z-40",
                  "fixed md:static inset-y-0 left-0 w-64 md:w-64 max-w-[80vw]",
                  mobileFolderOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
                )}
              >
                {/* Mobile Drawer Close header */}
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-border/20 md:hidden">
                  <span className="font-bold text-sm text-foreground">Navigation</span>
                  <button
                    onClick={() => setMobileFolderOpen(false)}
                    className="p-1 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Gmail Style Compose button */}
                <button 
                  onClick={() => {
                    setMailComposing({});
                    setMobileFolderOpen(false);
                  }} 
                  className="mb-4 py-2.5 sm:py-3 px-4 sm:px-6 bg-primary hover:bg-primary/95 text-primary-foreground font-extrabold rounded-2xl flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-sm sm:text-base w-full"
                >
                  <Pencil className="w-4 h-4 sm:w-5 sm:h-5" /> Compose
                </button>

                {/* Folders Navigation */}
                <div className="space-y-1">

                  {[
                    { k: "inbox" as Folder, icon: Inbox, label: "Inbox", count: mailStore.unread(), activeColor: "text-red-500 bg-red-500/10 font-bold" },
                    { k: "starred" as Folder, icon: Star, label: "Starred", activeColor: "text-red-400 bg-red-500/10 font-bold" },
                    { k: "sent" as Folder, icon: Send, label: "Sent", activeColor: "text-red-500 bg-red-500/10 font-bold" },
                    { k: "drafts" as Folder, icon: Pencil, label: "Drafts", activeColor: "text-red-400 bg-red-500/10 font-bold" },
                    { k: "trash" as Folder, icon: Trash2, label: "Trash", activeColor: "text-red-500 bg-red-500/10 font-bold" },
                  ].map((f) => {
                    const isSelected = viewMode === "mail" && mailFolder === f.k;
                    return (
                      <button 
                        key={f.k as string} 
                        onClick={() => { 
                          setViewMode("mail"); 
                          setMailFolder(f.k); 
                          setMailSelected(null); 
                          setMobileFolderOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm sm:text-base text-left transition-all hover:bg-secondary/60 text-muted-foreground cursor-pointer",
                          isSelected ? f.activeColor : "hover:text-foreground"
                        )}
                      >
                        <f.icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
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
                          onClick={() => { 
                            setMailFolder(`label:${l}`); 
                            setMailSelected(null); 
                            setMobileFolderOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3.5 py-2 rounded-full text-xs sm:text-sm text-left transition-all hover:bg-secondary/60 text-muted-foreground",
                            isSelected ? "text-red-400 bg-red-500/10 font-bold" : "hover:text-foreground"
                          )}
                        >
                          <Tag className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span className="truncate">{l}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </aside>

              {/* Central Panel: List or Detailed view or Live Chat */}
              <main className="flex-1 flex flex-col bg-background overflow-hidden">
                {viewMode === "chat" ? (
                  /* LIVE CHAT VIEW */
                  <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                    {/* Messages Stream */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scrollbar-thin">
                      {chatMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 my-auto">
                          <div className="w-14 h-14 rounded-2xl bg-secondary/50 border border-border/40 flex items-center justify-center text-muted-foreground">
                            <MessagesSquare className="w-7 h-7 text-primary/70" />
                          </div>
                          <div className="font-bold text-base text-foreground">No Live Chat Messages Yet</div>
                          <p className="text-xs text-muted-foreground max-w-sm">
                            Send a message below to broadcast to all regional grievance officers and bureaus in real-time. All messages are stored permanently with timestamps.
                          </p>
                        </div>
                      ) : (
                        chatMessages.map((msg) => {
                          const isMe = msg.sender_id === (user?.id || user?.email) || msg.sender_name === user?.name;
                          return (
                            <div
                              key={msg.id}
                              className={cn("flex flex-col max-w-[85%] md:max-w-[70%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}
                            >
                              <div className="flex items-center gap-2 mb-1 px-1">
                                <span className="text-xs font-semibold text-foreground/90">
                                  {isMe ? "You" : msg.sender_name}
                                </span>
                                {msg.sender_role && (
                                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 bg-secondary border border-border/40 text-muted-foreground rounded">
                                    {msg.sender_role}
                                  </span>
                                )}
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  {formatChatTime(msg.created_at)}
                                </span>
                              </div>
                              
                              <div
                                className={cn(
                                  "px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words whitespace-pre-wrap",
                                  isMe
                                    ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-tr-sm shadow-primary/20"
                                    : "bg-secondary/40 border border-border/40 text-foreground rounded-tl-sm"
                                )}
                              >
                                {msg.text}
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={chatBottomRef} />
                    </div>

                    {/* Chat Input Bar */}
                    <form
                      onSubmit={handleSendChatMessage}
                      className="p-3 md:p-4 border-t border-border/30 bg-card/25 flex items-center gap-2"
                    >
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendChatMessage();
                            }
                          }}
                          placeholder="Type your message... (Press Enter to send)"
                          className="w-full h-11 pl-4 pr-10 rounded-xl bg-background border border-border/40 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={chatSending || !chatInput.trim()}
                        className="h-11 px-5 bg-primary hover:bg-primary/95 disabled:opacity-40 text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-primary/25 active:scale-[0.98] text-sm shrink-0"
                      >
                        <Send className="w-4 h-4" />
                        <span>Send</span>
                      </button>
                    </form>
                  </div>
                ) : mailSelected && mailCurrent ? (
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
                          <Star className={cn("w-5 h-5", mailCurrent.starred ? "fill-red-400 text-red-400" : "text-muted-foreground")} />
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
                              <span key={l} className="text-[10px] uppercase font-bold bg-red-500/10 text-red-400 px-2 py-0.5 rounded-md border border-red-500/20">
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
                        <div className="py-20 text-center text-base text-muted-foreground space-y-2 px-4">
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
                                  "w-full flex flex-col sm:flex-row sm:items-center px-3.5 sm:px-4 py-3 sm:py-3.5 transition-all text-left relative hover:bg-secondary/35 group border-b border-border/20 cursor-pointer gap-2 sm:gap-4",
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

                                {/* Top line on mobile: Controls, Sender, Date */}
                                <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                                  <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button className="text-muted-foreground/45 hover:text-foreground">
                                      <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    </button>
                                    <button 
                                      onClick={() => { mailStore.toggleStar(m.id); forceUpdateMail((x) => x + 1); }}
                                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                      <Star className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", m.starred ? "fill-red-400 text-red-400" : "text-muted-foreground/30")} />
                                    </button>
                                  </div>

                                  {/* Sender Field */}
                                  <div className={cn("truncate text-sm sm:text-base flex-1 sm:w-48 sm:shrink-0 sm:flex-initial", isUnread ? "text-foreground font-bold" : "text-muted-foreground font-medium")}>
                                    {mailFolder === "sent" ? `To: ${m.to}` : m.from}
                                  </div>

                                  {/* Mobile date timestamp */}
                                  <span className="sm:hidden text-[11px] text-muted-foreground font-semibold shrink-0">
                                    {new Date(m.ts).toLocaleDateString([], { month: "short", day: "numeric" })}
                                  </span>
                                </div>

                                {/* Subject & Body Snippet */}
                                <div className="flex-1 min-w-0 flex items-baseline gap-1.5 text-xs sm:text-base pl-6 sm:pl-0">
                                  <span className={cn("truncate", isUnread ? "text-foreground font-bold" : "text-foreground/90 font-medium")}>
                                    {m.subject}
                                  </span>
                                  <span className="text-muted-foreground/60 text-xs sm:text-sm truncate font-normal hidden xs:inline sm:inline">
                                    — {m.body}
                                  </span>
                                </div>

                                {/* Desktop Date/Time & Hover Actions */}
                                <div className="hidden sm:flex shrink-0 items-center justify-end min-w-[70px] text-right" onClick={(e) => e.stopPropagation()}>
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
          <div className="fixed inset-x-2 sm:inset-x-auto bottom-0 sm:right-8 w-auto sm:w-[540px] max-w-full bg-card border border-border/40 rounded-t-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-scale-in">
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
