import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { 
  Send, Bot, User as UserIcon, Sparkles, Loader2, Plus, Trash2, Pencil,
  Search, Reply, Forward, Tag, MailOpen, Inbox, Star, AlertTriangle, 
  RotateCw, ChevronLeft, ChevronRight, HelpCircle, Settings,
  Grid, CheckSquare, Square, MinusSquare, Mail as MailIcon, Paperclip, X,
  Volume2, MessagesSquare, MessageSquare, Menu, ArrowLeft, Building2, ShieldCheck,
  Check, ExternalLink, Lock, UserCheck, RefreshCw, Users, Info, RotateCcw
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { 
  api, 
  type LiveChatMessage, 
  type CommsMessage, 
  type CommsLabel, 
  type CommsDraft 
} from "@/lib/api";
import { toast } from "sonner";
import { VoiceInputButton, ReadAloudButton } from "@/components/VoiceControls";
import RecipientDirectoryPanel, { type SelectedRecipientItem } from "@/components/comms/RecipientDirectoryPanel";

export const Route = createFileRoute("/comms")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }) as { q?: string; tab?: string },
  component: CommsHubPage,
});

type Folder = "inbox" | "sent" | "drafts" | "trash" | "starred" | `label:${string}`;

export interface DisplayMessageItem {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  ts: number;
  read: boolean;
  starred: boolean;
  folder: string;
  labels?: string[];
  message_ref?: string;
  sender_user_id?: string;
  sender_email?: string;
  sender_name?: string;
  sender_role?: string;
  sender_role_label?: string;
  sender_bureau?: string;
  sender_region?: string;
  sender_institution?: string;
  delivery_type?: string;
  recipients?: Array<{
    recipient_name?: string;
    recipient_email?: string;
    role_label?: string;
    institution?: string;
    is_registered?: boolean | number;
  }>;
  is_internal_backend?: boolean;
}

function CommsHubPage() {
  const { user } = useAuth();
  const searchParams = Route.useSearch() as { q?: string; tab?: string };

  const [mailFolder, setMailFolder] = useState<Folder>("inbox");
  const [mailSelected, setMailSelected] = useState<string | null>(null);
  const [mailSearchQuery, setMailSearchQuery] = useState("");
  const [, forceUpdateMail] = useState(0);

  // Backend comms messages state
  const [backendMessages, setBackendMessages] = useState<CommsMessage[]>([]);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendUnreadCount, setBackendUnreadCount] = useState<number | null>(null);
  const [selectedMessageDetail, setSelectedMessageDetail] = useState<CommsMessage | null>(null);

  // Message selection & bulk operations state
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [isBulkLabelMenuOpen, setIsBulkLabelMenuOpen] = useState(false);
  const [isDetailLabelMenuOpen, setIsDetailLabelMenuOpen] = useState(false);

  // Custom User Labels state
  const [userLabels, setUserLabels] = useState<CommsLabel[]>([]);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");

  // Compose floating window & Recipient directory drawer state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isRecipientPanelOpen, setIsRecipientPanelOpen] = useState(false);
  const [composeRecipients, setComposeRecipients] = useState<SelectedRecipientItem[]>([]);
  const [toInputText, setToInputText] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeInReplyTo, setComposeInReplyTo] = useState<string | undefined>(undefined);
  const [composeThreadId, setComposeThreadId] = useState<string | undefined>(undefined);
  const [composeExternalEmail, setComposeExternalEmail] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Draft autosave state & idempotency key
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const currentDraftIdRef = useRef<string | null>(null);
  const setDraftId = (id: string | null) => {
    currentDraftIdRef.current = id;
    setCurrentDraftId(id);
  };
  const [draftSaveStatus, setDraftSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [mailPage, setMailPage] = useState(1);
  const MAIL_PAGE_SIZE = 10;
  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36)
  );
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Live Chat state (authoritative database backed)
  const [viewMode, setViewMode] = useState<"mail" | "chat">(() => (searchParams.tab === "chat" ? "chat" : "mail"));
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [mobileFolderOpen, setMobileFolderOpen] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === "super_admin" || (user?.role as string) === "admin" || Boolean(user?.permissions?.includes("users:manage"));

  const filteredChatMessages = useMemo(() => {
    if (!chatSearchQuery.trim()) return chatMessages;
    const q = chatSearchQuery.toLowerCase();
    return chatMessages.filter(
      (m) =>
        m.text?.toLowerCase().includes(q) ||
        m.sender_name?.toLowerCase().includes(q) ||
        m.sender_role?.toLowerCase().includes(q)
    );
  }, [chatMessages, chatSearchQuery]);

  const handleDeleteChat = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this chat message? This action will be audited.")) return;
    try {
      await api.deleteLiveChatMessage(id);
      setChatMessages((prev) => prev.filter((m) => m.id !== id));
      toast.success("Live chat message deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete chat message");
    }
  };


  // Purge legacy mock local storage on mount to eliminate cross-account leakage
  useEffect(() => {
    try {
      localStorage.removeItem("aicte_mail_v3");
      localStorage.removeItem("aicte_mail_v2");
    } catch {/**/}
  }, []);

  // Load custom user labels from backend
  const loadUserLabels = async () => {
    try {
      const labels = await api.getCommsLabels();
      if (Array.isArray(labels)) {
        setUserLabels(labels);
      }
    } catch (err) {
      console.warn("Failed to load user labels:", err);
    }
  };

  useEffect(() => {
    loadUserLabels();
  }, []);

  // Load persistent internal messages from backend
  const loadBackendMessages = async (folder: Folder = mailFolder, query = mailSearchQuery) => {
    setBackendLoading(true);
    try {
      let folderParam: string;
      let labelParam: string | undefined;

      if (folder === "starred") {
        folderParam = "starred";
      } else if (folder === "sent") {
        folderParam = "sent";
      } else if (folder === "trash") {
        folderParam = "trash";
      } else if (folder === "drafts") {
        folderParam = "drafts";
      } else if (typeof folder === "string" && folder.startsWith("label:")) {
        folderParam = "inbox";
        labelParam = folder.slice(6);
      } else {
        folderParam = "inbox";
      }

      const msgs = await api.getCommsMessages(folderParam, query, labelParam);
      if (msgs && Array.isArray(msgs)) {
        setBackendMessages(msgs);
      }
      // Also update unread count
      const countRes = await api.getCommsUnreadCount();
      if (countRes && typeof countRes.unread_count === "number") {
        setBackendUnreadCount(countRes.unread_count);
      }
    } catch (err) {
      console.warn("Backend comms unreachable:", err);
    } finally {
      setBackendLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "mail") {
      setSelectedMessageIds(new Set());
      loadBackendMessages(mailFolder, mailSearchQuery);
    }
  }, [mailFolder, mailSearchQuery, viewMode]);

  // Live Chat Polling (authoritative database backed)
  const fetchLiveChat = async () => {
    try {
      const msgs = await api.getLiveChatMessages();
      if (msgs && Array.isArray(msgs)) {
        setChatMessages(msgs);
      }
    } catch {
      // transient network error, keep current database state
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
  }, [viewMode, chatMessages.length]);

  const handleSendChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatSending) return;

    setChatSending(true);
    const text = chatInput.trim();
    setChatInput("");

    // Optimistic insert
    const tempMsg: LiveChatMessage = {
      id: "temp-" + Date.now(),
      sender_id: user?.id || "anon",
      sender_name: user?.name || "Official",
      sender_role: user?.role || "citizen",
      text,
      created_at: new Date().toISOString(),
    };
    const updated = [...chatMessages, tempMsg];
    setChatMessages(updated);

    try {
      const sent = await api.sendLiveChatMessage(text, user?.name, user?.role);
      setChatMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? sent : m)));
    } catch (err) {
      toast.error("Failed to send message over live chat.");
    } finally {
      setChatSending(false);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  // Helper date formatter
  const formatDetailTimestamp = (isoString?: string) => {
    if (!isoString) return "";
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

  // Format backend messages directly — authoritative and strictly per-user
  const combinedMailItems = useMemo((): DisplayMessageItem[] => {
    return backendMessages.map((bm) => {
      let parsedLabels: string[] = [];
      if (Array.isArray(bm.labels)) {
        parsedLabels = bm.labels;
      } else if (bm.labels_json) {
        try {
          parsedLabels = JSON.parse(bm.labels_json);
        } catch {/**/}
      }

      return {
        id: bm.id,
        from: bm.sender_name || bm.sender_email || "AICTE Official",
        to: bm.to || (bm.recipients?.map((r) => r.recipient_name || r.recipient_email).join(", ") ?? "Recipient"),
        subject: bm.subject || "(No Subject)",
        body: bm.body || "",
        ts: bm.ts || (bm.created_at ? new Date(bm.created_at).getTime() : Date.now()),
        read: bm.read !== undefined ? bm.read : true,
        starred: Boolean(bm.starred),
        folder: bm.folder || "inbox",
        labels: parsedLabels,
        message_ref: bm.message_ref,
        sender_user_id: bm.sender_user_id,
        sender_name: bm.sender_name,
        sender_email: bm.sender_email,
        sender_role: bm.sender_role,
        sender_role_label: bm.sender_role_label,
        sender_bureau: bm.sender_bureau,
        sender_region: bm.sender_region,
        sender_institution: bm.sender_institution,
        delivery_type: bm.delivery_type,
        recipients: bm.recipients,
        is_internal_backend: true,
      };
    }).sort((a, b) => b.ts - a.ts);
  }, [backendMessages]);

  // Mail pagination derived calculations
  const totalMailCount = combinedMailItems.length;
  const totalMailPages = Math.max(1, Math.ceil(totalMailCount / MAIL_PAGE_SIZE));
  const startMailIndex = totalMailCount === 0 ? 0 : (mailPage - 1) * MAIL_PAGE_SIZE + 1;
  const endMailIndex = Math.min(mailPage * MAIL_PAGE_SIZE, totalMailCount);
  const paginatedMailItems = useMemo(
    () => combinedMailItems.slice((mailPage - 1) * MAIL_PAGE_SIZE, mailPage * MAIL_PAGE_SIZE),
    [combinedMailItems, mailPage]
  );

  // Selected message item resolution
  const activeMessageItem = useMemo((): DisplayMessageItem | null => {
    if (!mailSelected) return null;
    if (selectedMessageDetail) {
      let parsedLabels: string[] = [];
      if (Array.isArray(selectedMessageDetail.labels)) {
        parsedLabels = selectedMessageDetail.labels;
      } else if (selectedMessageDetail.labels_json) {
        try {
          parsedLabels = JSON.parse(selectedMessageDetail.labels_json);
        } catch {/**/}
      }

      return {
        id: selectedMessageDetail.id,
        from: selectedMessageDetail.sender_name || selectedMessageDetail.sender_email || "AICTE Official",
        to: selectedMessageDetail.to || "Recipient",
        subject: selectedMessageDetail.subject || "(No Subject)",
        body: selectedMessageDetail.body || "",
        ts: selectedMessageDetail.ts || (selectedMessageDetail.created_at ? new Date(selectedMessageDetail.created_at).getTime() : Date.now()),
        read: true,
        starred: Boolean(selectedMessageDetail.starred),
        folder: selectedMessageDetail.folder || "inbox",
        labels: parsedLabels,
        message_ref: selectedMessageDetail.message_ref,
        sender_user_id: selectedMessageDetail.sender_user_id,
        sender_name: selectedMessageDetail.sender_name,
        sender_email: selectedMessageDetail.sender_email,
        sender_role: selectedMessageDetail.sender_role,
        sender_role_label: selectedMessageDetail.sender_role_label,
        sender_bureau: selectedMessageDetail.sender_bureau,
        sender_region: selectedMessageDetail.sender_region,
        sender_institution: selectedMessageDetail.sender_institution,
        delivery_type: selectedMessageDetail.delivery_type,
        recipients: selectedMessageDetail.recipients,
        is_internal_backend: true,
      };
    }
    return combinedMailItems.find((m) => m.id === mailSelected) || null;
  }, [mailSelected, selectedMessageDetail, combinedMailItems]);

  // Open message or resume draft
  const handleOpenMessage = async (msg: DisplayMessageItem) => {
    // If it's a draft, resume it in Compose
    if (msg.folder === "drafts" || mailFolder === "drafts" || msg.id.startsWith("dft_")) {
      setDraftId(msg.id);
      setComposeSubject(msg.subject === "(No Subject)" ? "" : msg.subject);
      setComposeBody(msg.body || "");
      if (msg.to && msg.to !== "Recipient") {
        const parts = msg.to.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
        setComposeRecipients(
          parts.map((em) => ({
            email: em,
            name: em.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            is_registered: false,
          }))
        );
      } else {
        setComposeRecipients([]);
      }
      setIsComposeOpen(true);
      return;
    }

    setMailSelected(msg.id);
    try {
      const detail = await api.getCommsMessageDetail(msg.id);
      setSelectedMessageDetail(detail);
      // Mark as read on backend if unread
      if (!msg.read) {
        handleMarkRead(msg.id, true);
      }
    } catch (err) {
      console.warn("Failed to load message detail from server:", err);
    }
  };

  const handleToggleStar = async (msgId: string, currentStarred: boolean) => {
    const nextVal = !currentStarred;
    try {
      await api.updateCommsMessageStatus(msgId, { starred: nextVal });
      setBackendMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, starred: nextVal } : m))
      );
      if (selectedMessageDetail && selectedMessageDetail.id === msgId) {
        setSelectedMessageDetail((prev) => prev ? { ...prev, starred: nextVal } : null);
      }
      forceUpdateMail((x) => x + 1);
    } catch (err) {
      console.error("Star toggle error:", err);
    }
  };

  const handleMarkRead = async (msgId: string, read: boolean) => {
    try {
      await api.updateCommsMessageStatus(msgId, { read });
      setBackendMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, read } : m))
      );
      if (selectedMessageDetail && selectedMessageDetail.id === msgId) {
        setSelectedMessageDetail((prev) => prev ? { ...prev, read } : null);
      }
      forceUpdateMail((x) => x + 1);
    } catch (err) {
      console.error("Mark read error:", err);
    }
  };

  const handleDeleteMessage = async (msgId: string, permanent = false) => {
    try {
      await api.deleteCommsMessage(msgId, permanent);
      toast.success(permanent ? "Message permanently deleted from database" : "Message moved to trash");
      setBackendMessages((prev) => prev.filter((m) => m.id !== msgId));
      if (mailSelected === msgId) {
        setMailSelected(null);
        setSelectedMessageDetail(null);
      }
      setSelectedMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(msgId);
        return next;
      });
      loadBackendMessages(mailFolder, mailSearchQuery);
      forceUpdateMail((x) => x + 1);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete message");
    }
  };

  const handleRestoreMessage = async (msgId: string) => {
    try {
      await api.restoreCommsMessage(msgId);
      toast.success("Message restored");
      setBackendMessages((prev) => prev.filter((m) => m.id !== msgId));
      if (mailSelected === msgId) {
        setMailSelected(null);
        setSelectedMessageDetail(null);
      }
      setSelectedMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(msgId);
        return next;
      });
      loadBackendMessages(mailFolder, mailSearchQuery);
      forceUpdateMail((x) => x + 1);
    } catch (err: any) {
      toast.error(err?.message || "Failed to restore message");
    }
  };

  // Selection toggle logic
  const toggleSelectMessage = (msgId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedMessageIds.size === combinedMailItems.length && combinedMailItems.length > 0) {
      setSelectedMessageIds(new Set());
    } else {
      setSelectedMessageIds(new Set(combinedMailItems.map((m) => m.id)));
    }
  };

  // Bulk operations handler
  const handleBulkAction = async (action: string, labelName?: string) => {
    const ids = Array.from(selectedMessageIds);
    if (!ids.length) return;

    try {
      const res = await api.bulkCommsAction({
        message_ids: ids,
        action,
        label_name: labelName,
      });
      toast.success(`Action applied to ${res?.affected_count ?? ids.length} message(s)`);
      setSelectedMessageIds(new Set());
      setIsBulkLabelMenuOpen(false);
      loadBackendMessages(mailFolder, mailSearchQuery);
      forceUpdateMail((x) => x + 1);
    } catch (err: any) {
      toast.error(err?.message || "Bulk action failed");
    }
  };

  // Message Label Assignment
  const handleToggleMessageLabel = async (msgId: string, labelName: string, currentLabels: string[] = []) => {
    const nextLabels = currentLabels.includes(labelName)
      ? currentLabels.filter((l) => l !== labelName)
      : [...currentLabels, labelName];

    try {
      await api.updateCommsLabels(msgId, nextLabels);
      setBackendMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, labels: nextLabels } : m))
      );
      if (selectedMessageDetail && selectedMessageDetail.id === msgId) {
        setSelectedMessageDetail((prev) => prev ? { ...prev, labels: nextLabels } : null);
      }
      forceUpdateMail((x) => x + 1);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update labels");
    }
  };

  // Recipient selection handlers
  const handleToggleRecipient = (recipient: SelectedRecipientItem) => {
    setComposeRecipients((prev) => {
      const exists = prev.some((r) => r.email.toLowerCase() === recipient.email.toLowerCase());
      if (exists) {
        return prev.filter((r) => r.email.toLowerCase() !== recipient.email.toLowerCase());
      } else {
        return [...prev, recipient];
      }
    });
  };

  const handleRemoveRecipient = (email: string) => {
    setComposeRecipients((prev) =>
      prev.filter((r) => r.email.toLowerCase() !== email.toLowerCase())
    );
  };

  const handleAddManualRecipient = (raw: string) => {
    const clean = raw.replace(/,/g, "").trim().toLowerCase();
    if (!clean) return;
    if (composeRecipients.some((r) => r.email.toLowerCase() === clean)) {
      toast.info("Recipient is already added");
      setToInputText("");
      return;
    }
    setComposeRecipients((prev) => [
      ...prev,
      {
        email: clean,
        name: clean.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        is_registered: false,
      },
    ]);
    setToInputText("");
  };

  // ── Debounced Draft Autosave ──
  useEffect(() => {
    if (!isComposeOpen) return;

    const hasContent =
      composeRecipients.length > 0 ||
      toInputText.trim().length > 0 ||
      composeSubject.trim().length > 0 ||
      composeBody.trim().length > 0;

    if (!hasContent) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    setDraftSaveStatus("saving");
    autosaveTimeoutRef.current = setTimeout(async () => {
      try {
        const toEmails = composeRecipients.map((r) => r.email);
        if (toInputText.trim() && !toEmails.includes(toInputText.trim().toLowerCase())) {
          toEmails.push(toInputText.trim().toLowerCase());
        }

        const res = await api.saveCommsDraft({
          draft_id: currentDraftIdRef.current || undefined,
          to: toEmails,
          subject: composeSubject,
          body: composeBody,
        });

        if (res && res.draft_id) {
          setDraftId(res.draft_id);
          setDraftSaveStatus("saved");
          if (mailFolder === "drafts") {
            loadBackendMessages("drafts");
          }
        }
      } catch {
        setDraftSaveStatus("error");
      }
    }, 1500);

    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
  }, [isComposeOpen, composeRecipients, toInputText, composeSubject, composeBody]);

  // Close compose and autosave pending content
  const handleCloseCompose = async () => {
    const hasContent =
      composeRecipients.length > 0 ||
      toInputText.trim().length > 0 ||
      composeSubject.trim().length > 0 ||
      composeBody.trim().length > 0;

    if (hasContent) {
      try {
        const toEmails = composeRecipients.map((r) => r.email);
        if (toInputText.trim() && !toEmails.includes(toInputText.trim().toLowerCase())) {
          toEmails.push(toInputText.trim().toLowerCase());
        }
        const res = await api.saveCommsDraft({
          draft_id: currentDraftIdRef.current || undefined,
          to: toEmails,
          subject: composeSubject,
          body: composeBody,
        });
        if (res && res.draft_id) {
          setDraftId(res.draft_id);
        }
        toast.info("Draft saved");
        if (mailFolder === "drafts") {
          loadBackendMessages("drafts");
        }
      } catch {/**/}
    }

    setIsComposeOpen(false);
    setIsRecipientPanelOpen(false);
    setComposeRecipients([]);
    setToInputText("");
    setComposeSubject("");
    setComposeBody("");
    setDraftId(null);
    setDraftSaveStatus("idle");
  };

  // Discard draft completely
  const handleDiscardDraft = async () => {
    const dId = currentDraftIdRef.current;
    if (dId) {
      try {
        await api.deleteCommsDraft(dId);
        toast.info("Draft discarded");
        if (mailFolder === "drafts") {
          loadBackendMessages("drafts");
        }
      } catch {/**/}
    }
    setDraftId(null);
    setDraftSaveStatus("idle");
    setIsComposeOpen(false);
    setIsRecipientPanelOpen(false);
    setComposeRecipients([]);
    setToInputText("");
    setComposeSubject("");
    setComposeBody("");
  };

  // Send message through authoritative backend
  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSendingMessage) return; // Prevent double submit

    // Collect all recipients
    const finalRecipients = [...composeRecipients];
    if (toInputText.trim()) {
      const clean = toInputText.trim().toLowerCase();
      if (!finalRecipients.some((r) => r.email.toLowerCase() === clean)) {
        finalRecipients.push({
          email: clean,
          name: clean.split("@")[0],
          is_registered: false,
        });
      }
    }

    if (finalRecipients.length === 0) {
      toast.error("Please specify at least one recipient.");
      return;
    }

    if (!composeBody.trim()) {
      toast.error("Message body cannot be empty.");
      return;
    }

    setIsSendingMessage(true);
    const toEmails = finalRecipients.map((r) => r.email);
    const cleanSubj = composeSubject.trim() || "(No Subject)";
    const cleanBody = composeBody.trim();

    try {
      const res = await api.sendCommsMessage({
        to: toEmails,
        subject: cleanSubj,
        body: cleanBody,
        in_reply_to: composeInReplyTo,
        thread_id: composeThreadId,
        send_external_email: composeExternalEmail,
        idempotency_key: idempotencyKeyRef.current,
        draft_id: currentDraftIdRef.current || undefined,
      });

      if (res && res.ok) {
        toast.success(`Message transmitted! Reference: ${res.message_ref}`);
      } else {
        toast.success("Message dispatched successfully!");
      }

      // Reset compose state & regenerate fresh idempotency key
      idempotencyKeyRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2) + Date.now().toString(36);
      setDraftId(null);
      setDraftSaveStatus("idle");
      setIsComposeOpen(false);
      setIsRecipientPanelOpen(false);
      setComposeRecipients([]);
      setToInputText("");
      setComposeSubject("");
      setComposeBody("");
      setComposeInReplyTo(undefined);
      setComposeThreadId(undefined);

      // Refresh sent folder
      setMailFolder("sent");
      setMailSelected(null);
      setSelectedMessageDetail(null);
      loadBackendMessages("sent");
      forceUpdateMail((x) => x + 1);
    } catch (err: any) {
      console.error("Message dispatch failure:", err);
      toast.error(err?.message || "Failed to deliver message. Check backend connectivity.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleReply = (m: DisplayMessageItem) => {
    setComposeInReplyTo(m.id);
    setComposeThreadId(m.id);
    setComposeSubject(m.subject.startsWith("Re:") ? m.subject : `Re: ${m.subject}`);
    setComposeRecipients([
      {
        email: m.sender_email || m.from,
        name: m.sender_name || m.from,
        role_label: m.sender_role_label,
        institution: m.sender_institution,
        is_registered: true,
      },
    ]);
    setComposeBody(`\n\n--- In reply to official transmittal from ${m.sender_name || m.from} ---\n${m.body}`);
    setIsComposeOpen(true);
  };

  const handleForward = (m: DisplayMessageItem) => {
    setComposeInReplyTo(undefined);
    setComposeThreadId(undefined);
    setComposeSubject(m.subject.startsWith("Fwd:") ? m.subject : `Fwd: ${m.subject}`);
    setComposeRecipients([]);
    setComposeBody(`\n\n--- Forwarded AICTE VigilOS Transmittal ---\nFrom: ${m.sender_name} (${m.sender_email})\nSubject: ${m.subject}\nRef: ${m.message_ref || "N/A"}\n\n${m.body}`);
    setIsComposeOpen(true);
  };

  return (
    <AppLayout>
      <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-5.5rem)] max-h-[calc(100dvh-8rem)] md:max-h-[calc(100dvh-5.5rem)] flex flex-col overflow-hidden bg-background rounded-2xl border border-border/40 shadow-xs min-h-0">
        
        {/* Top Header Bar */}
        <header className="h-16 border-b border-border/40 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-card/40 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileFolderOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-sm">
              <MessagesSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Communications & Messaging</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold hidden xs:inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Secure communications hub with verified institutional delivery
              </p>
            </div>
          </div>

          {/* ── RESTORED SEARCH BOX (Between heading/description and switcher control) ── */}
          <div className="flex-1 max-w-md mx-2 sm:mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={viewMode === "mail" ? mailSearchQuery : chatSearchQuery}
                onChange={(e) => {
                  if (viewMode === "mail") {
                    setMailSearchQuery(e.target.value);
                  } else {
                    setChatSearchQuery(e.target.value);
                  }
                }}
                placeholder={
                  viewMode === "mail"
                    ? "Search mailbox by sender, subject, body..."
                    : "Search live chat messages..."
                }
                className="w-full h-10 pl-10 pr-9 rounded-xl bg-secondary/50 hover:bg-secondary/70 border border-border/40 text-xs sm:text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
              {(viewMode === "mail" ? mailSearchQuery : chatSearchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    if (viewMode === "mail") setMailSearchQuery("");
                    else setChatSearchQuery("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ── RESTORED OLD SWITCHING BUTTON DESIGN ── */}
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

            <button
              onClick={() => {
                loadBackendMessages(mailFolder, mailSearchQuery);
                fetchLiveChat();
              }}
              className="p-2 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/40 transition-colors cursor-pointer"
              title="Refresh communications"
            >
              <RotateCw className={cn("w-4 h-4", backendLoading && "animate-spin text-primary")} />
            </button>
          </div>

        </header>

        {/* Main Workspace Body */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          
          {/* Main Layout Container */}
          <div className="flex-1 min-h-0 flex overflow-hidden">
            
            {/* Mobile Drawer Backdrop */}
            {mobileFolderOpen && (
              <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden animate-in fade-in duration-200"
                onClick={() => setMobileFolderOpen(false)}
              />
            )}

            {/* Sidebar / Folders Navigation */}
            <aside
              className={cn(
                "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border/40 flex flex-col p-4 transition-transform lg:static lg:translate-x-0 duration-200",
                mobileFolderOpen ? "translate-x-0" : "-translate-x-full"
              )}
            >
              {/* Compose Button */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setDraftId(null);
                    setDraftSaveStatus("idle");
                    setIsComposeOpen(true);
                    setMobileFolderOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-sm transition-all border border-border/40 hover:border-border cursor-pointer shadow-sm group"
                >
                  <Pencil className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span>Compose</span>
                </button>
              </div>

              {/* Navigation Folders */}
              <div className="space-y-1">
                {[
                  {
                    k: "inbox" as Folder,
                    icon: Inbox,
                    label: "Inbox",
                    count: backendUnreadCount !== null ? backendUnreadCount : undefined,
                    activeColor: "text-red-500 bg-red-500/10 font-bold",
                  },
                  {
                    k: "starred" as Folder,
                    icon: Star,
                    label: "Starred",
                    activeColor: "text-amber-400 bg-amber-500/10 font-bold",
                  },
                  {
                    k: "sent" as Folder,
                    icon: Send,
                    label: "Sent",
                    activeColor: "text-red-500 bg-red-500/10 font-bold",
                  },
                  {
                    k: "drafts" as Folder,
                    icon: Pencil,
                    label: "Drafts",
                    activeColor: "text-red-400 bg-red-500/10 font-bold",
                  },
                  {
                    k: "trash" as Folder,
                    icon: Trash2,
                    label: "Trash",
                    activeColor: "text-red-500 bg-red-500/10 font-bold",
                  },
                ].map((f) => {
                  const isSelected = viewMode === "mail" && mailFolder === f.k;
                  return (
                    <button 
                      key={f.k as string} 
                      onClick={() => { 
                        setViewMode("mail"); 
                        setMailFolder(f.k); 
                        setMailSelected(null); 
                        setSelectedMessageDetail(null);
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

              {/* Recipient Directory Launcher in Sidebar */}
              <div className="mt-4 pt-3 border-t border-border/20">
                <button
                  type="button"
                  onClick={() => {
                    setIsRecipientPanelOpen(true);
                    setMobileFolderOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-secondary/40 hover:bg-primary/10 text-primary border border-border/30 hover:border-primary/40 font-bold text-xs sm:text-sm transition-all cursor-pointer"
                  title="Open user & institution directory"
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span className="truncate">User Directory</span>
                </button>
              </div>

              {/* Labels Section */}
              <div className="mt-6 border-t border-border/20 pt-4">
                <div className="flex items-center justify-between px-3.5 mb-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                    Labels
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingLabel((v) => !v)}
                    className="p-1 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Create new label"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Inline new label creation form */}
                {isCreatingLabel && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newLabelName.trim()) return;
                      try {
                        await api.createCommsLabel({ name: newLabelName.trim() });
                        toast.success(`Label "${newLabelName.trim()}" created`);
                        setNewLabelName("");
                        setIsCreatingLabel(false);
                        loadUserLabels();
                      } catch (err: any) {
                        toast.error(err?.message || "Failed to create label");
                      }
                    }}
                    className="px-3.5 mb-2 flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="New label..."
                      className="w-full text-xs bg-secondary/40 border border-border/40 rounded px-2 py-1 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="p-1 rounded bg-primary/20 hover:bg-primary/30 text-primary cursor-pointer shrink-0"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingLabel(false);
                        setNewLabelName("");
                      }}
                      className="p-1 rounded hover:bg-secondary/60 text-muted-foreground cursor-pointer shrink-0"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}

                <div className={cn("space-y-1 pr-1", userLabels.length > 3 ? "max-h-[114px] overflow-y-auto scrollbar-thin" : "")}>
                  {userLabels.map((l) => {
                    const isSelected = mailFolder === `label:${l.name}`;
                    return (
                      <div key={l.name} className="group/lbl flex items-center justify-between rounded-full hover:bg-secondary/60 pr-1">
                        <button 
                          onClick={() => { 
                            setMailFolder(`label:${l.name}`); 
                            setMailSelected(null); 
                            setSelectedMessageDetail(null);
                            setMobileFolderOpen(false);
                          }}
                          className={cn(
                            "flex-1 flex items-center gap-3 px-3.5 py-2 text-xs sm:text-sm text-left transition-all text-muted-foreground cursor-pointer",
                            isSelected ? "text-red-400 bg-red-500/10 font-bold rounded-full" : "hover:text-foreground"
                          )}
                        >
                          <Tag className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span className="truncate">{l.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete label "${l.name}"?`)) {
                              await api.deleteCommsLabel(l.name);
                              if (mailFolder === `label:${l.name}`) {
                                setMailFolder("inbox");
                              }
                              loadUserLabels();
                            }
                          }}
                          className="opacity-0 group-hover/lbl:opacity-100 p-1 text-muted-foreground/50 hover:text-destructive cursor-pointer transition-opacity"
                          title="Delete label"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* Email Workspace / Main Panel */}
            <main className="flex-1 min-h-0 flex flex-col bg-background overflow-hidden relative">
              {viewMode === "chat" ? (
                /* LIVE CHAT VIEW */
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden animate-fade-in">
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                    {filteredChatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 my-auto">
                        <div className="w-14 h-14 rounded-2xl bg-secondary/50 border border-border/40 flex items-center justify-center text-muted-foreground">
                          <MessagesSquare className="w-7 h-7 text-primary/70" />
                        </div>
                        <div className="font-bold text-base text-foreground">
                          {chatSearchQuery ? "No matching chat messages found" : "No Live Chat Messages Yet"}
                        </div>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          {chatSearchQuery
                            ? `No officer broadcast matches "${chatSearchQuery}". Clear search to view all messages.`
                            : "Send a message below to broadcast to all regional grievance officers and bureaus in real-time. All messages are stored permanently in the database."}
                        </p>
                      </div>
                    ) : (
                      filteredChatMessages.map((msg) => {
                        const isMe = msg.sender_id === user?.id;
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex flex-col max-w-[85%] sm:max-w-[70%] group",
                              isMe ? "ml-auto items-end" : "mr-auto items-start"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-muted-foreground">
                              <span className="font-semibold text-foreground">{isMe ? "You" : msg.sender_name}</span>
                              <span className="text-[10px] uppercase font-mono bg-secondary px-1.5 py-0.2 rounded border border-border/40">
                                {msg.sender_role}
                              </span>
                              <span>
                                {new Date(msg.created_at || Date.now()).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteChat(msg.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                                  title="Permanently delete message (Administrator)"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div
                              className={cn(
                                "p-3 rounded-2xl text-sm leading-relaxed",
                                isMe
                                  ? "bg-primary text-primary-foreground rounded-tr-none shadow-sm"
                                  : "bg-card border border-border/50 text-foreground rounded-tl-none"
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


                  {/* Chat Input */}
                  <div className="shrink-0 p-3 border-t border-border/40 bg-card/30">
                    <form onSubmit={handleSendChat} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Type your message... (Press Enter to send)"
                        className="flex-1 bg-secondary/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary text-foreground"
                      />
                      <button
                        type="submit"
                        disabled={chatSending || !chatInput.trim()}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground p-2.5 rounded-xl cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                </div>
              ) : activeMessageItem ? (
                /* GMAIL EMAIL DETAIL VIEW */
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden animate-fade-in">
                  {/* Detail toolbar */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card/10 gap-2">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => {
                          setMailSelected(null);
                          setSelectedMessageDetail(null);
                        }} 
                        className="p-2 rounded-full hover:bg-secondary/40 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Back to list"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      {mailFolder === "trash" ? (
                        <>
                          <button 
                            onClick={() => handleRestoreMessage(activeMessageItem.id)}
                            className="p-2 rounded-full hover:bg-secondary/40 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                            title="Restore message"
                          >
                            <RotateCcw className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteMessage(activeMessageItem.id, true)}
                            className="p-2 rounded-full hover:bg-secondary/40 text-destructive cursor-pointer"
                            title="Delete permanently from database"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => handleDeleteMessage(activeMessageItem.id, false)}
                          className="p-2 rounded-full hover:bg-secondary/40 text-destructive cursor-pointer"
                          title="Move to trash"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}

                      <button 
                        onClick={() => handleMarkRead(activeMessageItem.id, false)}
                        className="p-2 rounded-full hover:bg-secondary/40 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Mark as unread"
                      >
                        <MailOpen className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 relative">
                      {/* Assign Label Menu */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsDetailLabelMenuOpen((v) => !v)}
                          className="p-2 rounded-full hover:bg-secondary/40 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Assign Labels"
                        >
                          <Tag className="w-5 h-5" />
                        </button>

                        {isDetailLabelMenuOpen && (
                          <div className="absolute right-0 top-full mt-1 w-52 bg-[#18181b] border border-border/80 rounded-xl shadow-2xl p-1.5 z-50 space-y-1 backdrop-blur-none">
                            <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b border-border/40">
                              Labels
                            </div>
                            {userLabels.map((lbl) => {
                              const hasLabel = activeMessageItem.labels?.includes(lbl.name);
                              return (
                                <div key={lbl.name} className="flex items-center justify-between gap-1 px-2 py-1 rounded-lg text-xs hover:bg-secondary text-foreground transition-colors">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleMessageLabel(activeMessageItem.id, lbl.name, activeMessageItem.labels)}
                                    className="flex-1 flex items-center justify-between text-left cursor-pointer py-0.5"
                                  >
                                    <span>{lbl.name}</span>
                                    {hasLabel && <Check className="w-3.5 h-3.5 text-primary" />}
                                  </button>
                                  {hasLabel && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleMessageLabel(activeMessageItem.id, lbl.name, [lbl.name]);
                                      }}
                                      className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 cursor-pointer"
                                      title={`Remove label ${lbl.name}`}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => handleToggleStar(activeMessageItem.id, activeMessageItem.starred)} 
                        className="p-2 rounded-full hover:bg-secondary/40 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Toggle star"
                      >
                        <Star className={cn("w-5 h-5", activeMessageItem.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
                      </button>
                    </div>
                  </div>

                  {/* Email content */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 scrollbar-thin">
                    
                    {/* Subject header */}
                    <div className="space-y-1">
                      <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                        {activeMessageItem.subject}
                      </h2>
                      {activeMessageItem.labels && activeMessageItem.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {activeMessageItem.labels.map((l) => (
                            <span key={l} className="text-[10px] uppercase font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                              {l}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Authoritative VigilOS Sender Identity Card */}
                    <div className="bg-gradient-to-r from-primary/10 via-card to-secondary/30 border border-primary/30 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-primary/15 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-xs">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs uppercase font-extrabold tracking-wider text-primary flex items-center gap-1.5">
                              <span>Verified Official Sender Identity</span>
                              <Check className="w-3.5 h-3.5" />
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              VigilOS Official Communication Network
                            </div>
                          </div>
                        </div>

                        {activeMessageItem.message_ref && (
                          <div className="flex items-center gap-1.5 bg-background/80 border border-border/60 px-2.5 py-1 rounded-lg">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Ref:</span>
                            <span className="text-xs font-mono font-bold text-foreground">{activeMessageItem.message_ref}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div>
                          <div className="text-[11px] text-muted-foreground font-medium">Official Name</div>
                          <div className="font-bold text-foreground text-sm flex items-center gap-1">
                            <span>{activeMessageItem.sender_name || activeMessageItem.from}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground/80 font-mono truncate">
                            {activeMessageItem.sender_email || activeMessageItem.from}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-muted-foreground font-medium">Designation / Role</div>
                          <div className="font-bold text-foreground">
                            {activeMessageItem.sender_role_label || "AICTE Official"}
                          </div>
                          <div className="text-[11px] text-primary/80 font-semibold uppercase tracking-wider">
                            {activeMessageItem.sender_role || "Officer"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-muted-foreground font-medium">Bureau / Department</div>
                          <div className="font-bold text-foreground truncate">
                            {activeMessageItem.sender_institution || activeMessageItem.sender_bureau || "National Portal HQ"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {activeMessageItem.sender_region || "HQ (New Delhi)"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-muted-foreground font-medium">Transmittal Time</div>
                          <div className="font-bold text-foreground">
                            {formatDetailTimestamp(activeMessageItem.ts ? new Date(activeMessageItem.ts).toISOString() : undefined)}
                          </div>
                          <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Encrypted & Audited
                          </div>
                        </div>
                      </div>

                      {/* Recipient list summary */}
                      <div className="text-[11px] text-muted-foreground/80 border-t border-border/20 pt-2 flex items-center gap-1.5">
                        <span className="font-bold text-foreground/80">Delivered To:</span>
                        <span className="truncate">{activeMessageItem.to}</span>
                      </div>
                    </div>

                    {/* Message Body */}
                    <div className="prose prose-invert max-w-none text-sm sm:text-base leading-relaxed bg-card/30 p-5 rounded-2xl border border-border/25">
                      <div className="whitespace-pre-wrap text-foreground/90 font-normal">
                        {activeMessageItem.body}
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center gap-3 pt-4 border-t border-border/30">
                      <button 
                        onClick={() => handleReply(activeMessageItem)}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 py-2.5 rounded-xl cursor-pointer text-sm shadow-md shadow-primary/20 transition-all"
                      >
                        <Reply className="w-4 h-4" /> Reply
                      </button>
                      <button 
                        onClick={() => handleForward(activeMessageItem)}
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
                    <div className="flex items-center gap-2">
                      {/* Checkbox for Select All */}
                      <button 
                        onClick={toggleSelectAll}
                        className="p-2 rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground cursor-pointer"
                        title={
                          selectedMessageIds.size === 0
                            ? "Select all"
                            : selectedMessageIds.size === combinedMailItems.length
                            ? "Deselect all"
                            : "Select all"
                        }
                      >
                        {selectedMessageIds.size === 0 ? (
                          <Square className="w-4 h-4" />
                        ) : selectedMessageIds.size === combinedMailItems.length ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <MinusSquare className="w-4 h-4 text-primary" />
                        )}
                      </button>

                      {/* If messages are selected, render bulk action buttons */}
                      {selectedMessageIds.size > 0 ? (
                        <div className="flex items-center gap-1.5 animate-fade-in">
                          <span className="text-xs font-bold text-foreground px-1.5">
                            {selectedMessageIds.size} selected
                          </span>

                          {mailFolder === "trash" ? (
                            <>
                              <button
                                onClick={() => handleBulkAction("restore")}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold cursor-pointer"
                                title="Restore selected"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="hidden sm:inline">Restore</span>
                              </button>
                              <button
                                onClick={() => handleBulkAction("delete_permanently")}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/15 hover:bg-destructive/25 text-destructive text-xs font-semibold cursor-pointer"
                                title="Delete permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Delete permanently</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleBulkAction("trash")}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-destructive text-xs font-semibold cursor-pointer"
                                title="Move to trash"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Trash</span>
                              </button>
                              <button
                                onClick={() => handleBulkAction("read")}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold cursor-pointer"
                                title="Mark read"
                              >
                                <MailOpen className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Mark read</span>
                              </button>
                              <button
                                onClick={() => handleBulkAction("unread")}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold cursor-pointer"
                                title="Mark unread"
                              >
                                <MailIcon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Mark unread</span>
                              </button>

                              {/* Bulk Label Dropdown */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setIsBulkLabelMenuOpen((v) => !v)}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold cursor-pointer"
                                  title="Apply label"
                                >
                                  <Tag className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Label</span>
                                </button>

                                {isBulkLabelMenuOpen && (
                                  <div className="absolute left-0 top-full mt-1 w-52 bg-[#18181b] border border-border/80 rounded-xl shadow-2xl p-1.5 z-50 space-y-1 backdrop-blur-none">
                                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b border-border/40 flex items-center justify-between">
                                      <span>Apply / Remove Label</span>
                                    </div>
                                    {userLabels.map((lbl) => (
                                      <div key={lbl.name} className="flex items-center justify-between gap-1 px-2 py-1 rounded-lg text-xs hover:bg-secondary text-foreground transition-colors">
                                        <button
                                          type="button"
                                          onClick={() => handleBulkAction("add_label", lbl.name)}
                                          className="flex-1 flex items-center justify-between text-left cursor-pointer py-0.5"
                                          title={`Add label ${lbl.name}`}
                                        >
                                          <span>{lbl.name}</span>
                                          <Plus className="w-3 h-3 text-emerald-400" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleBulkAction("remove_label", lbl.name)}
                                          className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 cursor-pointer"
                                          title={`Remove label ${lbl.name} from selected`}
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </>
                          )}

                          <button
                            onClick={() => setSelectedMessageIds(new Set())}
                            className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Clear selection"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        /* Normal refresh button when no messages are selected */
                        <button 
                          onClick={() => {
                            loadBackendMessages(mailFolder, mailSearchQuery);
                            forceUpdateMail((x) => x + 1);
                          }}
                          className="p-2 rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Refresh list"
                        >
                          <RotateCw className={cn("w-4 h-4", backendLoading && "animate-spin text-primary")} />
                        </button>
                      )}
                    </div>
                    
                    {/* Pagination UI */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                      <span>{startMailIndex}–{endMailIndex} of {totalMailCount}</span>
                      <div className="flex items-center gap-0.5">
                        <button 
                          type="button"
                          onClick={() => setMailPage((p) => Math.max(1, p - 1))}
                          disabled={mailPage <= 1}
                          className="p-1.5 rounded hover:bg-secondary/45 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed text-foreground transition-colors"
                          title="Previous page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => setMailPage((p) => Math.min(totalMailPages, p + 1))}
                          disabled={mailPage >= totalMailPages}
                          className="p-1.5 rounded hover:bg-secondary/45 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed text-foreground transition-colors"
                          title="Next page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Email List view */}
                  <div className="flex-1 overflow-y-auto scrollbar-thin">
                    {backendLoading && combinedMailItems.length === 0 ? (
                      <div className="py-20 text-center space-y-3">
                        <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
                        <p className="text-xs text-muted-foreground font-medium">Loading messages...</p>
                      </div>
                    ) : combinedMailItems.length === 0 ? (
                      <div className="py-20 text-center text-base text-muted-foreground space-y-2 px-4">
                        <MailIcon className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                        <div className="font-bold">No mail conversations in this folder</div>
                        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                          Messages or notifications will appear here once received.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/20">
                        {paginatedMailItems.map((m) => {
                          const isUnread = !m.read && mailFolder === "inbox";
                          const isSelected = selectedMessageIds.has(m.id);
                          return (
                            <div 
                              key={m.id}
                              className={cn(
                                "w-full flex flex-col sm:flex-row sm:items-center px-3.5 sm:px-4 py-3 sm:py-3.5 transition-all text-left relative hover:bg-secondary/35 group border-b border-border/20 cursor-pointer gap-2 sm:gap-4",
                                isSelected ? "bg-primary/10" : isUnread ? "bg-red-500/5 font-semibold text-foreground" : "text-muted-foreground/90"
                              )}
                              onClick={() => handleOpenMessage(m)}
                            >
                              {/* Left strip indicator for unread emails */}
                              {isUnread && (
                                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-600" />
                              )}

                              {/* Top line on mobile: Controls, Sender, Date */}
                              <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                                <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button 
                                    onClick={() => toggleSelectMessage(m.id)}
                                    className="text-muted-foreground/45 hover:text-foreground cursor-pointer"
                                    title={isSelected ? "Deselect" : "Select"}
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    )}
                                  </button>
                                  <button 
                                    onClick={() => handleToggleStar(m.id, m.starred)}
                                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                                  >
                                    <Star className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", m.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                                  </button>
                                </div>

                                {/* Sender Field with Registered Badge */}
                                <div className={cn("truncate text-sm sm:text-base flex-1 sm:w-56 sm:shrink-0 sm:flex-initial flex items-center gap-1.5", isUnread ? "text-foreground font-bold" : "text-muted-foreground font-medium")}>
                                  <span className="truncate">
                                    {mailFolder === "sent" ? `To: ${m.to}` : (m.sender_name || m.from)}
                                  </span>
                                  {m.sender_role_label && (
                                    <span className="text-[10px] px-1 py-0.2 rounded bg-secondary text-muted-foreground shrink-0 border border-border/40 hidden md:inline">
                                      {m.sender_role_label}
                                    </span>
                                  )}
                                </div>

                                {/* Mobile date timestamp */}
                                <span className="sm:hidden text-[11px] text-muted-foreground font-semibold shrink-0">
                                  {new Date(m.ts).toLocaleDateString([], { month: "short", day: "numeric" })}
                                </span>
                              </div>

                              {/* Subject & Body Snippet + Reference Badge + Labels */}
                              <div className="flex-1 min-w-0 flex items-baseline gap-1.5 text-xs sm:text-base pl-6 sm:pl-0">
                                {m.message_ref && (
                                  <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded shrink-0 hidden lg:inline">
                                    {m.message_ref}
                                  </span>
                                )}

                                {m.labels && m.labels.length > 0 && (
                                  <span className="flex items-center gap-1 shrink-0">
                                    {m.labels.map((lbl) => (
                                      <span key={lbl} className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-bold uppercase">
                                        {lbl}
                                      </span>
                                    ))}
                                  </span>
                                )}

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
                                  {mailFolder === "trash" ? (
                                    <>
                                      <button 
                                        onClick={() => handleRestoreMessage(m.id)}
                                        className="p-1.5 rounded hover:bg-secondary/65 text-emerald-400 cursor-pointer"
                                        title="Restore"
                                      >
                                        <RotateCcw className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteMessage(m.id, true)}
                                        className="p-1.5 rounded hover:bg-secondary/65 text-destructive cursor-pointer"
                                        title="Delete permanently"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button 
                                        onClick={() => handleDeleteMessage(m.id, false)}
                                        className="p-1.5 rounded hover:bg-secondary/65 text-destructive cursor-pointer"
                                        title="Move to trash"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={() => handleMarkRead(m.id, !m.read)}
                                        className="p-1.5 rounded hover:bg-secondary/65 text-foreground cursor-pointer"
                                        title={m.read ? "Mark unread" : "Mark read"}
                                      >
                                        <MailOpen className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
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

        {/* Android / Mobile Floating Compose FAB */}
        {viewMode === "mail" && !isComposeOpen && (
          <button
            type="button"
            id="mobile-compose-fab"
            onClick={() => {
              setDraftId(null);
              setDraftSaveStatus("idle");
              setIsComposeOpen(true);
            }}
            className="lg:hidden fixed bottom-6 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-2xl active:scale-95 transition-all cursor-pointer border border-primary-foreground/20"
            title="Compose message"
          >
            <Pencil className="w-5 h-5" />
            <span className="text-sm font-semibold">Compose</span>
          </button>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ── FLOATING GMAIL-STYLE DOCK: RECIPIENT DIRECTORY & COMPOSE BOX ── */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {(isComposeOpen || isRecipientPanelOpen) && (
          <div className="fixed inset-x-2 bottom-2 sm:inset-auto sm:bottom-0 sm:right-8 z-50 flex flex-col sm:flex-row items-center sm:items-end justify-end gap-2 pointer-events-none max-w-full sm:max-w-[calc(100vw-280px)]">
            {/* Recipient Directory (Adjacent to the left of the compose box) */}
            <RecipientDirectoryPanel
              isOpen={isRecipientPanelOpen}
              onClose={() => setIsRecipientPanelOpen(false)}
              selectedRecipients={composeRecipients}
              onToggleRecipient={handleToggleRecipient}
              currentUserEmail={user?.email}
              isComposeOpen={isComposeOpen}
              onOpenCompose={() => setIsComposeOpen(true)}
            />

            {/* Floating Gmail-Style Compose Box */}
            {isComposeOpen && (
              <div className="pointer-events-auto w-full sm:w-[540px] max-w-full bg-card border border-border/50 rounded-2xl sm:rounded-t-2xl sm:rounded-b-none shadow-2xl flex flex-col overflow-hidden animate-scale-in max-h-[85vh] sm:max-h-[85vh]">
                {/* Header toolbar */}
                <div className="bg-secondary/40 px-4 py-3 flex items-center justify-between border-b border-border/30 select-none">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-foreground">
                      {currentDraftId ? "Edit Draft" : "New Message"}
                    </span>
                    {draftSaveStatus === "saving" && (
                      <span className="text-xs text-muted-foreground animate-pulse flex items-center gap-1 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                      </span>
                    )}
                    {draftSaveStatus === "saved" && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                        <Check className="w-3 h-3" /> Saved
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={handleCloseCompose} 
                      className="text-muted-foreground hover:text-destructive p-1 cursor-pointer"
                      title="Save and close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Compose inputs */}
                <form 
                  onSubmit={handleSendMessage} 
                  className="p-4 space-y-3 flex flex-col"
                >
                  <div className="border-b border-border/20 py-1.5 flex items-center gap-2 text-base">
                    <button
                      type="button"
                      id="comms-recipient-directory-toggle"
                      onClick={() => setIsRecipientPanelOpen((prev) => !prev)}
                      className="p-1 -ml-1 rounded hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                      title={isRecipientPanelOpen ? "Close User Directory" : "Open User Directory"}
                      aria-label="Toggle User Directory"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <span className="text-muted-foreground font-bold shrink-0 w-8 select-none">To</span>
                    <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
                      {composeRecipients.map((recip) => (
                        <span
                          key={recip.email}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary text-foreground border border-border/40 shadow-2xs"
                        >
                          <span className="truncate max-w-[150px]">{recip.name || recip.email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(recip.email)}
                            className="text-muted-foreground hover:text-destructive p-0.5 rounded-full"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        value={toInputText}
                        onChange={(e) => setToInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.key === "Enter" || e.key === "," || e.key === "Tab") && toInputText.trim()) {
                            e.preventDefault();
                            handleAddManualRecipient(toInputText.trim());
                          }
                        }}
                        placeholder={composeRecipients.length === 0 ? "recipient@aicte.gov.in..." : ""}
                        className="flex-1 min-w-[120px] bg-transparent border-0 focus:outline-none font-semibold text-foreground text-base"
                      />
                    </div>
                  </div>

                  <div className="border-b border-border/20 py-1.5 flex items-center gap-2 text-base">
                    <span className="text-muted-foreground font-bold shrink-0 w-16 select-none">Subject</span>
                    <input 
                      required 
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      placeholder="Message subject..."
                      className="w-full bg-transparent border-0 focus:outline-none font-semibold text-foreground text-base" 
                    />
                  </div>

                  <textarea 
                    required 
                    rows={11} 
                    placeholder="Write your message..." 
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    className="w-full bg-transparent border-0 focus:outline-none text-base resize-none text-foreground py-2" 
                  />

                  {/* Footer actions */}
                  <div className="flex items-center justify-between border-t border-border/20 pt-4">
                    <div className="flex items-center gap-2">
                      <button 
                        type="submit" 
                        disabled={isSendingMessage}
                        className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold px-6 py-2.5 rounded-xl cursor-pointer text-sm shadow-md shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
                      >
                        {isSendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        <span>Send</span>
                      </button>
                      <label className="p-2 rounded-xl border border-border/40 hover:border-primary/40 text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center">
                        <input type="file" multiple className="hidden" />
                        <Paperclip className="w-4 h-4" />
                      </label>
                    </div>
                    
                    <button 
                      type="button" 
                      onClick={handleDiscardDraft}
                      className="text-sm font-semibold text-muted-foreground hover:text-destructive px-3 py-2 cursor-pointer transition-colors"
                    >
                      Discard Draft
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

      </div>
    </AppLayout>
  );
}
