import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import AppSidebar from "./AppSidebar";
import AnimatedBackground from "../AnimatedBackground";
import ShortcutsModal from "../ShortcutsModal";
import OnboardingTour from "../OnboardingTour";
import BottomTabs from "../BottomTabs";
import { CommandPalette, useCommandPalette } from "../CommandPalette";
import { FloatingActionButton } from "../FloatingActionButton";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Menu, Search, X } from "lucide-react";

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

  // FAB-driven slide-in search bar state
  const [fabSearchOpen, setFabSearchOpen] = useState(false);
  const [fabSearchQuery, setFabSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();

  useEffect(() => { if (!loading && requireAuth && !user) navigate({ to: "/login" }); }, [loading, user, requireAuth, navigate]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // ── FAB Search auto-dismiss logic ────────────────────────────────
  const resetSearchTimer = useCallback(() => {
    if (searchDismissTimer.current) clearTimeout(searchDismissTimer.current);
    searchDismissTimer.current = setTimeout(() => {
      setFabSearchOpen(false);
      setFabSearchQuery("");
    }, 6000);
  }, []);

  const handleFabSearchOpen = useCallback(() => {
    setFabSearchOpen(true);
    resetSearchTimer();
    setTimeout(() => searchInputRef.current?.focus(), 80);
  }, [resetSearchTimer]);

  const handleFabSearchClose = useCallback(() => {
    setFabSearchOpen(false);
    setFabSearchQuery("");
    if (searchDismissTimer.current) clearTimeout(searchDismissTimer.current);
  }, []);

  // Reset timer on any typing activity while search is open
  useEffect(() => {
    if (!fabSearchOpen) return;
    const handler = () => resetSearchTimer();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fabSearchOpen, resetSearchTimer]);

  useEffect(() => () => { if (searchDismissTimer.current) clearTimeout(searchDismissTimer.current); }, []);

  // ── Submit FAB search → open command palette ──────────────────────
  const handleFabSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFabSearchClose();
    setCmdOpen(true);
  };

  // ── Keyboard shortcuts ───────────────────────────────────────────
  useEffect(() => {
    let gPress = false; let gT: ReturnType<typeof setTimeout> | null = null;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "?") { e.preventDefault(); setShowShortcuts(true); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); return; }
      if (e.key === "Escape" && fabSearchOpen) { handleFabSearchClose(); return; }
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
  }, [navigate, fabSearchOpen, handleFabSearchClose, setCmdOpen]);

  if (loading) return <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">Loading…</div>;

  const handlePaletteAction = (action: string) => {
    if (action === "logout") {
      localStorage.removeItem("aicte_token");
      navigate({ to: "/login" });
    } else if (action === "focus-chat") {
      navigate({ to: "/ai-activity" });
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

      {/* FAB-triggered slide-in search bar — appears at top-right when Search radial button clicked */}
      <div
        className={cn(
          "fixed top-3 right-4 z-30 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          fabSearchOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-3 pointer-events-none"
        )}
      >
        <form onSubmit={handleFabSearchSubmit} className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-primary pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={fabSearchQuery}
            onChange={(e) => { setFabSearchQuery(e.target.value); resetSearchTimer(); }}
            placeholder="Search cases, institutions, bureaus…"
            className={cn(
              "pl-10 pr-10 py-2 rounded-xl text-sm w-72 md:w-96 h-10",
              "bg-background/95 border border-primary/40 text-white",
              "placeholder:text-white/40 backdrop-blur-md shadow-lg",
              "focus:outline-none focus:border-primary focus:shadow-[0_0_20px_rgba(220,38,38,0.35)]",
              "transition-all duration-200"
            )}
            onKeyDown={(e) => {
              if (e.key === "Escape") { handleFabSearchClose(); }
              else if (e.key === "Enter") { handleFabSearchSubmit(e as any); }
            }}
          />
          <button
            type="button"
            onClick={handleFabSearchClose}
            className="absolute right-3 p-1 rounded text-white/40 hover:text-white/80 transition-colors"
            aria-label="Close search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

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

      {/* Sticky Radial FAB — right-center, desktop only */}
      <div className="hidden md:block">
        <FloatingActionButton
          onSearchOpen={() => setCmdOpen(true)}
        />
      </div>
    </div>
  );
}
