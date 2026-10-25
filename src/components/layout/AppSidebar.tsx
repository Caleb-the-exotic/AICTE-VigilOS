import { useEffect, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, GitGraph, Shield, Brain, Settings, Bot,
  MessageSquare, ChevronLeft, FileText, Inbox, Mail, MessagesSquare,
  BarChart3, Users, ClipboardList, Plus, HelpCircle, Calendar,
  Sun, Moon, LogOut, FileStack, Bell, Sparkles, Gavel
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, formatRole } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { mailStore } from "@/lib/mail-store";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  badge?: () => number;
}

const coreNavItems: NavItem[] = [
  { title: "Dashboard",      url: "/",            icon: LayoutDashboard },
  { title: "Cases",          url: "/cases",       icon: Gavel },
  { title: "Messages",       url: "/comms",        icon: MessageSquare, badge: () => mailStore.unread() },
  { title: "Help & Support", url: "/help",         icon: HelpCircle },
];

const adminNavItem: NavItem = { title: "Admin", url: "/admin", icon: Shield };

interface Props { collapsed: boolean; onToggle: () => void }

export default function AppSidebar({ collapsed, onToggle }: Props) {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [, force] = useState(0);

  useEffect(() => {
    const f = () => force((x) => x + 1);
    window.addEventListener("mail-updated", f);
    window.addEventListener("dm-updated", f);
    return () => { window.removeEventListener("mail-updated", f); window.removeEventListener("dm-updated", f); };
  }, []);

  const role = user?.role ?? "approval_officer";
  const items = user?.role === "super_admin" ? [...coreNavItems, adminNavItem] : coreNavItems;

  return (
    <aside className={cn("fixed left-0 top-0 h-full z-40 border-r border-border/30 transition-all duration-300 flex flex-col bg-gradient-to-b from-sidebar to-background/95 scrollbar-thin", collapsed ? "w-16" : "w-64")}>
      <div className="h-14 flex items-center px-4 border-b border-border/30">
        <Link to="/" className="flex items-center gap-2.5 group">
          <img src="/aicte-logo.png" alt="AICTE Emblem" className="w-8 h-8 object-contain shrink-0" />
          {!collapsed && <span className="text-base font-bold tracking-tight">Vigil<span className="text-gradient-red">OS</span></span>}
        </Link>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto scrollbar-thin">
        <ul className="space-y-0.5 px-2">
          {items.map((item) => {
            const isActive = pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url));
            const badge = item.badge?.() || 0;
            return (
              <li key={item.title + item.url}>
                <Link to={item.url} className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium relative",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  collapsed && "justify-center px-0")} title={collapsed ? item.title : undefined}>
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-primary" />}
                  <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
                  {!collapsed && <span className="flex-1">{item.title}</span>}
                  {!collapsed && badge > 0 && <span className="text-[9px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{badge}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-2 border-t border-border/30 space-y-1">
        {/* Theme Toggle */}
        <button onClick={toggleTheme} className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground", collapsed && "justify-center px-0")} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
          {!collapsed && <span className="flex-1 text-left">Theme</span>}
        </button>

        {/* Notifications */}
        <Link to="/notifications" className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground", collapsed && "justify-center px-0")} title={collapsed ? "Notifications" : undefined}>
          <Bell className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="flex-1 text-left">Notifications</span>}
        </Link>

        {/* Profile Link */}
        <Link to="/profile" className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground", collapsed && "justify-center px-0")} title={collapsed ? user?.name : undefined}>
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-primary/50 grid place-items-center text-[9px] font-bold text-primary-foreground shrink-0">
            {(user?.name || "U").slice(0, 1).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="text-left min-w-0 flex-1">
              <div className="text-xs font-semibold leading-none truncate">{user?.name || "Guest"}</div>
              <div className="text-[10px] text-primary/80 font-medium leading-none mt-1">{formatRole(user?.role)}</div>
            </div>
          )}
        </Link>

        {/* Logout */}
        <button onClick={() => { logout(); navigate({ to: "/login" }); }} className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-primary", collapsed && "justify-center px-0")} aria-label="Logout">
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="flex-1 text-left">Logout</span>}
        </button>

        {/* Collapse Button */}
        <button onClick={onToggle} className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-secondary/60 mt-1" aria-label="Toggle sidebar">
          <ChevronLeft className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", collapsed && "rotate-180")} />
        </button>
      </div>
    </aside>
  );
}
