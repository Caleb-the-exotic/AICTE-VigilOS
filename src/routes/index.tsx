import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Activity, Users, Clock, TrendingUp, FileText, Bot, Zap, ArrowUpRight, FlaskConical, CalendarOff, Wrench, AlertTriangle, Timer, Gavel, ChevronDown } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { requestsStore, STATUS_STYLES } from "@/lib/requests-store";
import { useAuth } from "@/lib/auth";
import DarkVeil from "@/components/ui/DarkVeil";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const nav = useNavigate();
  const { user } = useAuth();
  // Reactive store revision: increments when localStorage changes (e.g. new request created)
  const [storeRev, setStoreRev] = useState(0);
  useEffect(() => {
    const onStorage = () => setStoreRev((x) => x + 1);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const reqs = useMemo(() => requestsStore.list(), [storeRev]);
  const isLeader = user?.role === "hod" || user?.role === "admin";

  const stats = useMemo(() => {
    const total = reqs.length;
    const approved = reqs.filter((r) => r.status === "approved").length;
    const pending = reqs.filter((r) => r.status === "pending" || r.status === "in_review").length;
    const stale = reqs.filter((r) => (r.status === "pending" || r.status === "in_review") && (Date.now() - +new Date(r.createdAt)) > 86_400_000).length;
    return [
      { label: "Total Requests", value: String(total), icon: Activity, change: "+12%" },
      { label: "Approved", value: String(approved), icon: TrendingUp, change: "+5%" },
      { label: "Pending", value: String(pending), icon: Clock, change: "—" },
      { label: "Avg Response", value: "2.4h", icon: Timer, change: "-18%" },
    ];
  }, [reqs]);

  const hodWidgets = useMemo(() => ({
    stale: reqs.filter((r) => (r.status === "pending" || r.status === "in_review") && (Date.now() - +new Date(r.createdAt)) > 86_400_000),
    todaysOd: reqs.filter((r) => { const t = new Date().setHours(0, 0, 0, 0); const s = new Date(r.startDate).setHours(0, 0, 0, 0); return s === t && r.status === "approved"; }),
    rejectedRate: Math.round((reqs.filter((r) => r.status === "rejected").length / Math.max(1, reqs.length)) * 100),
  }), [reqs]);

  return (
    <AppLayout noPadding>
      <div className="relative min-h-screen">
        {/* Full-width background DarkVeil — fills entire viewport from top 0 */}
        <div className="absolute top-0 left-0 right-0 h-screen overflow-hidden pointer-events-none z-0" style={{ background: "#000" }}>
          <div className="w-full h-full relative">
            <DarkVeil
              hueShift={-125}
              noiseIntensity={0}
              scanlineIntensity={0}
              speed={0.5}
              scanlineFrequency={0}
              warpAmount={0}
              resolutionScale={1}
            />
            {/* Smooth vertical fade — only fades at the very bottom edge */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent from-65% to-background pointer-events-none" />
          </div>
        </div>

        {/* Centered logo and Title in the middle of the screen */}
        <div className="relative z-10 flex flex-col items-center justify-center h-screen text-center px-4">
          <div className="flex flex-col items-center gap-6 animate-fade-in">
            {/* AICTE Official Logo */}
            <img
              src="/aicte-logo.png"
              alt="AICTE Official Logo"
              className="w-56 h-56 md:w-72 md:h-72 lg:w-96 lg:h-96 max-h-[40vh] object-contain shrink-0"
            />
            <div className="text-center flex flex-col items-center">
              <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight font-display text-white leading-none">
                Vigil<span className="text-gradient-red">OS</span>
              </h1>
              <p className="text-base md:text-xl text-muted-foreground mt-3 font-medium tracking-wide">
                AICTE Complaint & Cross-Bureau Intelligence Platform
              </p>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("features-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="mt-12 md:mt-16 px-8 py-3.5 rounded-2xl text-base font-semibold tracking-wide text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:via-rose-500 hover:to-red-500 border border-red-500/40 shadow-[0_0_25px_rgba(220,38,38,0.45)] hover:shadow-[0_0_35px_rgba(220,38,38,0.7)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer flex items-center gap-2.5 group"
              >
                <span>View features</span>
                <ChevronDown className="w-5 h-5 text-white/80 group-hover:translate-y-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div id="features-section" className="space-y-5 max-w-7xl mx-auto px-4 md:px-6 pb-12 relative z-10">
          <div className="relative overflow-hidden rounded-2xl border border-border/30 p-7 animate-fade-up noise bg-background/40 backdrop-blur-xl">
            <div className="absolute inset-0 grid-bg opacity-[0.35]" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="relative flex w-2.5 h-2.5">
                  <span className="absolute inset-0 rounded-full bg-green-500 animate-ember-pulse" />
                  <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-green-500" />
                </span>
                <span className="text-xs text-green-400 font-medium tracking-wide">System Online</span>
              </div>
              <h2 className="font-display text-2xl font-bold leading-tight">Welcome back, <span className="text-primary">{user?.name || "there"}</span></h2>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">VigilOS handles institutional complaint cases, cross-bureau overlap detection, approvals, and AI intelligence — all in one place.</p>
              <div className="flex gap-2.5 mt-5 flex-wrap">
                <Button variant="neon" size="sm" onClick={() => nav({ to: "/cases" })} className="btn-glow magnet"><Gavel className="w-3.5 h-3.5" /> AICTE Complaints & Overlaps</Button>
                <Button variant="outline" size="sm" onClick={() => nav({ to: "/comms", search: { tab: "chat" } })} className="magnet"><Activity className="w-3.5 h-3.5" /> Bureau Copilot</Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: "AICTE Oversight", desc: "Cross-bureau complaint & overlap monitoring", icon: Gavel, to: "/cases" },
              { label: "Bureau Notices", desc: "Inter-bureau orders, email alerts & hearing updates", icon: Activity, to: "/comms" },
              { label: "AICTE Helpdesk & ROs", desc: "Headquarters & 8 Regional Offices assistance", icon: Users, to: "/help" },
            ].map((a, i) => (
              <button key={a.label} onClick={() => nav({ to: a.to })} className="glass-card p-4 text-left hover:border-primary/30 transition-all group animate-fade-in" style={{ animationDelay: `${0.15 + i * 0.05}s` }}>
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 grid place-items-center group-hover:bg-primary/20"><a.icon className="w-4 h-4 text-primary" /></div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
                <div className="text-sm font-medium mt-3">{a.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{a.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
