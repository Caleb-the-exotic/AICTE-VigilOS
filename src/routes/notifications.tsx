import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Bell, CheckCircle2, AlertCircle, Info, Building2, CheckCheck,
  RefreshCw, ArrowUpRight, ShieldAlert, Clock, Inbox, ChevronLeft, ChevronRight, Trash2
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { api, type OfficerNotification, HAS_BACKEND } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({ component: NotificationsPage });

function formatTimeAgo(isoString: string): string {
  try {
    const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return isoString;
  }
}

function getIconAndColor(type: string) {
  switch (type) {
    case "institution_registration":
      return { icon: Building2, color: "text-primary bg-primary/10 border-primary/25" };
    case "registration_approved":
      return { icon: CheckCircle2, color: "text-primary bg-primary/10 border-primary/25" };
    case "registration_rejected":
      return { icon: ShieldAlert, color: "text-primary bg-primary/10 border-primary/25" };
    case "case_alert":
      return { icon: AlertCircle, color: "text-primary bg-primary/10 border-primary/25" };
    default:
      return { icon: Info, color: "text-primary bg-primary/10 border-primary/25" };
  }
}

function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<OfficerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const userRole = (user?.role || (user as any)?.role_key || "").toLowerCase();
  const isAdmin = userRole === "super_admin" || userRole === "admin" || userRole === "bureau_head";

  const fetchNotifications = useCallback(async () => {
    if (!HAS_BACKEND) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.getNotifications(filter === "unread");
      setNotifications(data || []);
    } catch (err: any) {
      console.warn("Could not load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleFilterChange = (newFilter: "all" | "unread") => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleNotificationClick = async (notif: OfficerNotification) => {
    if (!notif.is_read) {
      try {
        await api.markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: 1 } : n))
        );
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("aicte_notification_updated"));
        }
      } catch (e) {
        console.warn("Failed to mark read:", e);
      }
    }
    if (notif.action_url) {
      navigate({ to: notif.action_url as any });
    }
  };

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("aicte_notification_updated"));
      }
      toast.success("All notifications marked as read");
    } catch (err: any) {
      toast.error(err?.message || "Failed to mark all as read");
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    try {
      await api.deleteNotification(notifId);
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("aicte_notification_updated"));
      }
      toast.success("Notification deleted from database");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete notification");
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to permanently delete all notifications from the database? This action cannot be undone.")) return;
    setIsDeletingAll(true);
    try {
      await api.deleteAllNotifications();
      setNotifications([]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("aicte_notification_updated"));
      }
      toast.success("All notifications deleted from database");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete notifications");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const totalPages = Math.ceil(notifications.length / ITEMS_PER_PAGE) || 1;
  const paginatedNotifications = notifications.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const startIndex = notifications.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, notifications.length);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 grid place-items-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Notifications</h1>
              <p className="text-[11px] text-muted-foreground">
                Authoritative updates on institution registrations and regulatory proceedings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && notifications.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={isDeletingAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all cursor-pointer disabled:opacity-50"
                title="Admin: Clear All Notifications from Database"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                {isDeletingAll ? "Deleting..." : "Clear All"}
              </button>
            )}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isMarkingAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 border border-border/40 text-xs font-semibold text-foreground hover:bg-secondary transition-all cursor-pointer disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5 text-primary" />
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={fetchNotifications}
              disabled={loading}
              className="p-1.5 rounded-lg bg-secondary/40 border border-border/30 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-border/30 pb-2">
          <button
            type="button"
            onClick={() => handleFilterChange("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              filter === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange("unread")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
              filter === "unread"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Unread
            {unreadCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] grid place-items-center font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Notifications List */}
        <div className="space-y-2">
          {loading && notifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
              Loading notifications from database...
            </div>
          ) : paginatedNotifications.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground glass-card p-8 space-y-2">
              <Inbox className="w-8 h-8 mx-auto text-muted-foreground/30" />
              <div className="text-sm font-semibold text-foreground">No notifications found</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {filter === "unread"
                  ? "You have caught up with all regulatory alerts and registration submissions."
                  : "Notifications triggered by institution self-registration or regulatory case updates will appear here."}
              </p>
            </div>
          ) : (
            paginatedNotifications.map((n) => {
              const { icon: Icon, color } = getIconAndColor(n.type);
              const isUnread = !n.is_read;

              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "glass-card p-4 flex items-start gap-3 transition-all cursor-pointer relative overflow-hidden group",
                    isUnread
                      ? "border-primary/40 bg-primary/[0.03] shadow-md shadow-primary/5 hover:border-primary/60"
                      : "hover:border-border opacity-85 hover:opacity-100"
                  )}
                >
                  {isUnread && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                  )}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl grid place-items-center shrink-0 border",
                      color
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-foreground truncate flex items-center gap-2">
                        {n.title}
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {formatTimeAgo(n.created_at)}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteNotification(e, n.id)}
                            className="p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Admin: Delete Notification"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                      {n.body}
                    </div>
                    {n.action_url && (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-primary mt-2 group-hover:underline">
                        <span>Review Application</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls (10 notifications per page) */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-border/30 text-xs text-muted-foreground">
            <div>
              Showing <span className="font-semibold text-foreground">{startIndex}</span> to{" "}
              <span className="font-semibold text-foreground">{endIndex}</span> of{" "}
              <span className="font-semibold text-foreground">{notifications.length}</span> notifications
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-border/40 bg-secondary/30 hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                      currentPage === pageNum
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary/20 hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-border/40 bg-secondary/30 hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
