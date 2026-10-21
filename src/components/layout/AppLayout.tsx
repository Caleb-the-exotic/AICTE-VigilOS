import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import AppSidebar from "./AppSidebar";
import AnimatedBackground from "../AnimatedBackground";
import ShortcutsModal from "../ShortcutsModal";
import OnboardingTour from "../OnboardingTour";
import BottomTabs from "../BottomTabs";
import { CommandPalette, useCommandPalette } from "../CommandPalette";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();

  useEffect(() => { if (!loading && requireAuth && !user) navigate({ to: "/login" }); }, [loading, user, requireAuth, navigate]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

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
        if (e.key.toLowerCase() === "r") navigate({ to: "/requests" });
        if (e.key.toLowerCase() === "n") navigate({ to: "/requests/new" });
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
      navigate({ to: "/requests/new" });
    } else if (action === "new-lab") {
      navigate({ to: "/requests/new" });
    } else if (action === "new-complaint") {
      navigate({ to: "/requests/new" });
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <AnimatedBackground />

      {mobileOpen && <div className="md:hidden fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />}

      <div className={cn("fixed top-0 left-0 h-full z-50 transition-transform duration-300", "md:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>

      {/* Floating mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-30 p-2.5 rounded-lg bg-background/80 border border-border/40 shadow-lg backdrop-blur-md text-foreground hover:bg-secondary/80"
        aria-label="Open menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      <main className={cn(noPadding ? "pt-0" : "pt-4", "pb-16 md:pb-6 min-h-screen transition-all duration-300 relative z-10", "ml-0", collapsed ? "md:ml-16" : "md:ml-64")}>
        <div className={noPadding ? "" : "p-4 md:p-6"}>{children}</div>
      </main>

      <BottomTabs />
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {user && <OnboardingTour />}

      {/* Global Command Palette */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onAction={handlePaletteAction}
      />
    </div>
  );
}
