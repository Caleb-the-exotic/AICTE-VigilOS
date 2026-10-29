import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Gavel, MessageSquare, Bell, UserCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const tabs = [
  { to: "/",             icon: Home,          label: "Home"     },
  { to: "/cases",        icon: Gavel,         label: "Cases"    },
  { to: "/comms",        icon: MessageSquare, label: "Messages" },
  { to: "/help",         icon: HelpCircle,    label: "Help"     },
  { to: "/notifications",icon: Bell,          label: "Alerts"   },
  { to: "/profile",      icon: UserCircle,    label: "Profile"  },
];

export default function BottomTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await api.getUnreadNotificationsCount();
        if (res && typeof res.unread_count === "number") {
          setUnreadNotifs(res.unread_count);
        }
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    const onUpdated = () => fetchCount();
    window.addEventListener("aicte_notification_updated", onUpdated);
    window.addEventListener("focus", onUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener("aicte_notification_updated", onUpdated);
      window.removeEventListener("focus", onUpdated);
    };
  }, []);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border/30 safe-area-pb print:hidden">
      <ul className="grid grid-cols-6">
        {tabs.map((t) => {
          const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
          const isNotifs = t.to === "/notifications";
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[9px] font-medium transition-colors active:scale-95 relative",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative flex items-center justify-center">
                  <t.icon className={cn("w-[18px] h-[18px] shrink-0", active && "drop-shadow-[0_0_6px_rgba(220,38,38,0.6)]")} />
                  {isNotifs && unreadNotifs > 0 && (
                    <span className="absolute -top-1.5 -right-2 text-[8px] font-bold font-mono bg-red-600 text-white rounded-full px-1 min-w-[14px] h-3.5 flex items-center justify-center ring-1 ring-background">
                      {unreadNotifs > 99 ? "99+" : unreadNotifs}
                    </span>
                  )}
                </div>
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
