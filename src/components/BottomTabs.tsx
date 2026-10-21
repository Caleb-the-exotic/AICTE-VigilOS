import { Link, useRouterState } from "@tanstack/react-router";
import { Home, FileText, Bot, Bell, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/requests-hub", icon: FileText, label: "Requests" },
  { to: "/comms", icon: Bot, label: "AI" },
  { to: "/notifications", icon: Bell, label: "Alerts" },
  { to: "/profile", icon: UserCircle, label: "Me" },
];

export default function BottomTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border/30 print:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
          return (
            <li key={t.to}>
              <Link to={t.to} className={cn("flex flex-col items-center gap-0.5 py-2 text-[10px]", active ? "text-primary" : "text-muted-foreground")}>
                <t.icon className="w-4 h-4" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
