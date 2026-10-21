import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCircle2, AlertCircle, Info } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";

export const Route = createFileRoute("/notifications")({ component: Notifications });

const items = [
  { type: "ok", title: "REQ-1024 approved", body: "Dr. Sharma approved your hackathon OD.", time: "10m ago" },
  { type: "info", title: "New message in AI Chat", body: "Assistant responded to your last query.", time: "1h ago" },
  { type: "warn", title: "REQ-1022 needs more info", body: "Reviewer requested venue details.", time: "3h ago" },
  { type: "ok", title: "Lab 3 booked", body: "Slot confirmed for Friday 10–12.", time: "Yesterday" },
];

const icon = { ok: CheckCircle2, warn: AlertCircle, info: Info } as const;
const color = { ok: "text-green-400", warn: "text-red-400", info: "text-primary" } as const;

function Notifications() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Notifications</h1>
        </div>
        <div className="space-y-2">
          {items.map((n, i) => {
            const Icon = icon[n.type as keyof typeof icon];
            return (
              <div key={i} className="glass-card p-4 flex items-start gap-3 hover:border-primary/30 transition-colors">
                <div className={`w-9 h-9 rounded-lg bg-secondary/60 grid place-items-center ${color[n.type as keyof typeof color]}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{n.time}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
