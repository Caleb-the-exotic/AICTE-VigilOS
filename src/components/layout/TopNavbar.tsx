import { useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Sun, Moon, Menu, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, formatRole } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export default function TopNavbar({ sidebarCollapsed, onMenuClick }: { sidebarCollapsed: boolean; onMenuClick?: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-14 z-30 border-b border-border/30 flex items-center justify-between px-3 md:px-5 transition-all duration-300",
        "bg-background/70 backdrop-blur-2xl",
        "left-0",
        sidebarCollapsed ? "md:left-16" : "md:left-64"
      )}
    >
      {/* Left: mobile menu button */}
      <div className="flex items-center gap-2">
        <button onClick={onMenuClick} className="md:hidden p-2 rounded-lg hover:bg-secondary/60" aria-label="Menu">
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Right: actions + profile */}
      <div className="flex items-center gap-1 md:gap-2 ml-auto">
        <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-secondary/60 transition-all text-muted-foreground hover:text-foreground" aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-px h-6 bg-border/40 mx-1 hidden md:block" />

        <Link to="/profile" className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-secondary/60 transition-all">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/50 grid place-items-center text-[11px] font-bold text-primary-foreground">
            {(user?.name || "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="text-left hidden md:block">
            <div className="text-xs font-medium leading-tight">{user?.name || "Guest"}</div>
            <div className="text-[10px] text-muted-foreground leading-tight">{formatRole(user?.role)}</div>
          </div>
        </Link>

        <button
          onClick={() => { logout(); navigate({ to: "/login" }); }}
          className="p-2 rounded-lg hover:bg-secondary/60 transition-all text-muted-foreground hover:text-primary"
          aria-label="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
