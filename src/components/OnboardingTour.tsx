import { useEffect, useState } from "react";
import { Sparkles, X, ArrowRight } from "lucide-react";

const KEY = "aicte_tour_done_v1";
const STEPS = [
  { title: "Welcome to VigilOS", body: "AICTE-aligned cross-bureau complaint monitoring, overlap prevention, and autonomous intelligence." },
  { title: "Submit an OD in seconds", body: "Click 'New Request' or use the AI quick-draft to convert natural language into a request." },
  { title: "Stay in the loop", body: "Track status with the timeline, chat with reviewers, and get notifications across mail, in-app, and push." },
  { title: "Press ? anytime", body: "See keyboard shortcuts. Use G then D/R/N/C to navigate without the mouse." },
];

export default function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => { if (typeof window !== "undefined" && !localStorage.getItem(KEY)) setOpen(true); }, []);
  const dismiss = () => { localStorage.setItem(KEY, "1"); setOpen(false); };
  if (!open) return null;
  const step = STEPS[i];
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-background/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="glass-card glass-card-glow max-w-md w-full p-6 relative">
        <button onClick={dismiss} className="absolute top-3 right-3 p-1 hover:bg-secondary/60 rounded"><X className="w-4 h-4" /></button>
        <div className="w-10 h-10 rounded-xl bg-primary/15 grid place-items-center mb-3"><Sparkles className="w-5 h-5 text-primary" /></div>
        <h2 className="text-lg font-bold">{step.title}</h2>
        <p className="text-sm text-muted-foreground mt-2">{step.body}</p>
        <div className="flex items-center justify-between mt-5">
          <div className="flex gap-1">{STEPS.map((_, j) => <div key={j} className={`w-1.5 h-1.5 rounded-full ${j === i ? "bg-primary" : "bg-secondary"}`} />)}</div>
          <div className="flex gap-2">
            <button onClick={dismiss} className="text-xs text-muted-foreground hover:text-foreground">Skip</button>
            <button onClick={() => i === STEPS.length - 1 ? dismiss() : setI(i + 1)} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground flex items-center gap-1 neon-glow">
              {i === STEPS.length - 1 ? "Done" : "Next"} <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
