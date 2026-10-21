/**
 * FloatingActionButton.tsx — Sticky Radial FAB
 * A central launcher button fixed to the right-center of the viewport.
 * Click → expands to reveal 3 child buttons in an arc.
 *   • AI Chat    → /chat
 *   • Search     → opens the slide-in search bar (auto-dismisses after 6s idle)
 *   • Settings   → /profile
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bot, Search, Settings, Sparkles, X } from "lucide-react";

interface FloatingActionButtonProps {
  onSearchOpen?: () => void;
  onSearchClose?: () => void;
}

// ── Sub-button descriptors ──────────────────────────────────────────
// FAB sits on the RIGHT edge, so children fan LEFT (west arc).
// 220° = upper-left | 180° = straight left | 140° = lower-left
const CHILDREN = [
  {
    id: "chat",
    label: "AI Chat",
    Icon: Bot,
    color: "from-rose-600 to-red-700",
    glow: "shadow-[0_0_24px_rgba(220,38,38,0.6)]",
    angle: 220,
    radius: 125,
  },
  {
    id: "navigate",
    label: "Search",
    Icon: Search,
    color: "from-red-700 to-zinc-900 border border-red-500/30",
    glow: "shadow-[0_0_24px_rgba(220,38,38,0.5)]",
    angle: 180,
    radius: 125,
  },
  {
    id: "settings",
    label: "Settings",
    Icon: Settings,
    color: "from-zinc-800 to-zinc-950 border border-white/15",
    glow: "shadow-[0_0_18px_rgba(0,0,0,0.6)]",
    angle: 140,
    radius: 125,
  },
];

function angleToTranslate(deg: number, radius: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
}

export function FloatingActionButton({
  onSearchOpen,
  onSearchClose,
}: FloatingActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const navigate = useNavigate();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fabRef = useRef<HTMLDivElement>(null);

  // ── Auto-dismiss search after 6 s of keyboard idle ────────────────
  const startIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setSearchActive(false);
      onSearchClose?.();
    }, 6000);
  }, [onSearchClose]);

  // Restart timer on any keyboard activity while search is active
  useEffect(() => {
    if (!searchActive) return;
    const handleKey = () => startIdleTimer();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [searchActive, startIdleTimer]);

  // Cleanup on unmount
  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);

  // ── Close on outside click ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Button click handlers ──────────────────────────────────────────
  const handleChild = (id: string) => {
    setOpen(false);
    if (id === "chat") {
      navigate({ to: "/chat" });
    } else if (id === "navigate") {
      // Open the CommandPalette (page/case navigation panel)
      onSearchOpen?.();
    } else if (id === "settings") {
      navigate({ to: "/profile" });
    }
  };

  return (
    <div
      ref={fabRef}
      className="fixed right-6 top-1/2 -translate-y-1/2 z-[60] select-none"
      style={{ isolation: "isolate" }}
    >
      {/* ── Child buttons ─────────────────────────────────────────── */}
      {CHILDREN.map((child, i) => {
        const { x, y } = angleToTranslate(child.angle, child.radius);
        return (
          <button
            key={child.id}
            aria-label={child.label}
            title={child.label}
            onClick={() => handleChild(child.id)}
            className={`
              absolute left-1/2 top-1/2
              w-[52px] h-[52px] rounded-full
              bg-gradient-to-br ${child.color}
              flex items-center justify-center
              text-white shadow-lg
              transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
              hover:scale-105 active:scale-95
              ${open ? `${child.glow} opacity-100 pointer-events-auto` : "opacity-0 pointer-events-none shadow-none"}
            `}
            style={{
              transform: open
                ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`
                : `translate(-50%, -50%) scale(0.4)`,
              transitionDelay: open ? `${i * 45}ms` : "0ms",
            }}
          >
            <child.Icon className="w-6 h-6" strokeWidth={2.2} />
            {/* Tooltip label */}
            <span
              className={`
                absolute right-full mr-3.5 whitespace-nowrap
                px-3 py-1.5 rounded-lg text-xs font-semibold
                bg-background/95 border border-white/15 text-white/95
                shadow-xl backdrop-blur-md
                transition-all duration-200
                ${open ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"}
              `}
              style={{ transitionDelay: open ? `${70 + i * 40}ms` : "0ms" }}
            >
              {child.label}
            </span>
          </button>
        );
      })}

      {/* ── Parent FAB ────────────────────────────────────────────── */}
      <button
        id="fab-main-btn"
        aria-label={open ? "Close launcher" : "Open launcher"}
        onClick={() => setOpen((o) => !o)}
        className={`
          relative z-10
          w-14 h-14 rounded-full
          flex items-center justify-center
          transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          active:scale-95
          ${open
            ? "bg-gradient-to-br from-white/15 to-white/5 border border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.1)] rotate-45"
            : "bg-gradient-to-br from-primary to-rose-700 border border-primary/40 shadow-[0_0_28px_rgba(220,38,38,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_0_40px_rgba(220,38,38,0.7)] hover:scale-105"
          }
        `}
      >
        {/* Pulsing ring when closed */}
        {!open && (
          <span className="absolute inset-0 rounded-full border border-primary/40 animate-ember-pulse pointer-events-none" />
        )}

        {/* Icon morphs between Sparkles and X */}
        <span
          className={`absolute transition-all duration-200 ${open ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-45 scale-75"}`}
        >
          <X className="w-6 h-6 text-white/80" strokeWidth={2.5} />
        </span>
        <span
          className={`absolute transition-all duration-200 ${open ? "opacity-0 -rotate-45 scale-75" : "opacity-100 rotate-0 scale-100"}`}
        >
          <Sparkles className="w-6 h-6 text-white" strokeWidth={2} />
        </span>
      </button>
    </div>
  );
}
