import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Gavel, MessageSquare, Bell, UserCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border/30 safe-area-pb print:hidden">
      <ul className="grid grid-cols-6">
        {tabs.map((t) => {
          const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[9px] font-medium transition-colors active:scale-95",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon className={cn("w-[18px] h-[18px] shrink-0", active && "drop-shadow-[0_0_6px_rgba(220,38,38,0.6)]")} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
