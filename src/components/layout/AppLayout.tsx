import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import AppSidebar from "./AppSidebar";
import AnimatedBackground from "../AnimatedBackground";
import ShortcutsModal from "../ShortcutsModal";
import BottomTabs from "../BottomTabs";
import { CommandPalette, useCommandPalette } from "../CommandPalette";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function AppLayout({
  children,
  requireAuth = true,
  noPadding = false,
}: {
  children: ReactNode;
  requireAuth?: boolean;
  noPadding?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();

  useEffect(() => { if (!loading && requireAuth && !user) navigate({ to: "/login" }); }, [loading, user, requireAuth, navigate]);

  // ── Keyboard shortcuts ───────────────────────────────────────────
  useEffect(() => {
    let gPress = false; let gT: ReturnType<typeof setTimeout> | null = null;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "?") { e.preventDefault(); setShowShortcuts(true); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); return; }
      if (e.key.toLowerCase() === "g") { gPress = true; if (gT) clearTimeout(gT); gT = setTimeout(() => { gPress = false; }, 800); return; }
      if (gPress) {
        if (e.key.toLowerCase() === "d") navigate({ to: "/" });
        if (e.key.toLowerCase() === "r") navigate({ to: "/cases" });
        if (e.key.toLowerCase() === "n") navigate({ to: "/cases" });
        if (e.key.toLowerCase() === "c") navigate({ to: "/chat" });
        if (e.key.toLowerCase() === "h") navigate({ to: "/help" });
        gPress = false;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, setCmdOpen]);

  if (loading) return <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">Loading…</div>;

  const handlePaletteAction = (action: string) => {
    if (action === "logout") {
      localStorage.removeItem("aicte_token");
      navigate({ to: "/login" });
    } else if (action === "focus-chat") {
      navigate({ to: "/comms" });
    } else if (action === "new-leave") {
      navigate({ to: "/cases" });
    } else if (action === "new-lab") {
      navigate({ to: "/cases" });
    } else if (action === "new-complaint") {
      navigate({ to: "/cases" });
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <AnimatedBackground />

      {/* Sidebar — desktop only */}
      <div className="hidden md:block fixed top-0 left-0 h-full z-50">
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>

      <main className={cn(noPadding ? "pt-0" : "pt-4", "pb-20 md:pb-6 min-h-screen transition-all duration-300 relative z-10", "ml-0", collapsed ? "md:ml-16" : "md:ml-64")}>
        <div className={noPadding ? "" : "p-4 md:p-6"}>{children}</div>
      </main>

      <BottomTabs />
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {/* Global Command Palette */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onAction={handlePaletteAction}
      />
    </div>
  );
}
