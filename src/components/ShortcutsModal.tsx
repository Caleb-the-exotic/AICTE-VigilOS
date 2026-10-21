import { X } from "lucide-react";

export default function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const groups: { title: string; items: [string, string][] }[] = [
    { title: "Navigation", items: [["G then D", "Dashboard"], ["G then R", "Requests"], ["G then N", "New request"], ["G then C", "Chat"], ["G then H", "Help"]] },
    { title: "Global", items: [["Ctrl + K", "Quick search"], ["?", "Show this help"], ["Esc", "Close dialogs"]] },
  ];
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-background/70 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="glass-card glass-card-glow max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold">Keyboard shortcuts</h2><button onClick={onClose} className="p-1 hover:bg-secondary/60 rounded"><X className="w-4 h-4" /></button></div>
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{g.title}</div>
              <ul className="space-y-1">
                {g.items.map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between text-xs">
                    <span>{v}</span>
                    <kbd className="px-2 py-0.5 rounded bg-secondary/60 border border-border/40 font-mono">{k}</kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
