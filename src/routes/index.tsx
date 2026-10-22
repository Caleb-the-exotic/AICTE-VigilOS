import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { ArrowUpRight, Gavel, ChevronDown, ShieldAlert, Bell, Building2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { requestsStore } from "@/lib/requests-store";
import { useAuth } from "@/lib/auth";
import DarkVeil from "@/components/ui/DarkVeil";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const nav = useNavigate();
  const { user } = useAuth();

  const [storeRev, setStoreRev] = useState(0);
  useEffect(() => {
    const onStorage = () => setStoreRev((x) => x + 1);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleScrollToFeatures = () => {
    const el = document.getElementById("key-features-section");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <AppLayout noPadding>
      <div className="relative min-h-screen">
        {/* Background */}
        <div className="absolute top-0 left-0 right-0 h-screen overflow-hidden pointer-events-none z-0" style={{ background: "#000" }}>
          <div className="w-full h-full relative">
            <DarkVeil hueShift={-125} noiseIntensity={0} scanlineIntensity={0} speed={0.5} scanlineFrequency={0} warpAmount={0} resolutionScale={1} />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent from-65% to-background pointer-events-none" />
          </div>
        </div>

        {/* Hero — centered logo & title */}
        <div className="relative z-10 flex flex-col items-center justify-center h-screen text-center px-4">
          <div className="flex flex-col items-center gap-6 animate-fade-in">
            <img src="/aicte-logo.png" alt="AICTE Official Logo" className="w-56 h-56 md:w-72 md:h-72 lg:w-96 lg:h-96 max-h-[40vh] object-contain shrink-0" />
            <div className="text-center flex flex-col items-center">
              <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight font-display text-white leading-none">
                Vigil<span className="text-gradient-red">OS</span>
              </h1>
              <p className="text-base md:text-xl text-muted-foreground mt-3 font-medium tracking-wide">
                AICTE Complaint & Cross-Bureau Intelligence Platform
              </p>
              <button
                type="button"
                onClick={handleScrollToFeatures}
                className="mt-12 md:mt-16 px-8 py-3.5 rounded-2xl text-base font-semibold tracking-wide text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:via-rose-500 hover:to-red-500 border border-red-500/40 shadow-[0_0_25px_rgba(220,38,38,0.45)] hover:shadow-[0_0_35px_rgba(220,38,38,0.7)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer flex items-center gap-2.5 group"
              >
                <span>View features</span>
                <ChevronDown className="w-5 h-5 text-white/80 group-hover:translate-y-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div id="features-section" className="space-y-10 max-w-7xl mx-auto px-4 md:px-6 pb-6 relative z-10">

          {/* Welcome Card */}
          <div className="relative overflow-hidden rounded-2xl border border-red-500/20 p-6 sm:p-8 animate-fade-up bg-card/60 backdrop-blur-2xl shadow-[0_0_40px_-15px_rgba(220,38,38,0.12)]">
            <div className="absolute inset-0 grid-bg opacity-[0.2]" />
            <div className="relative z-10">
              <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight text-white">
                Welcome back, <span className="text-primary">{user?.name || "Caleb"}</span>
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                VigilOS handles institutional complaint cases, cross-bureau overlap detection, approvals, and AI intelligence — all in one place.
              </p>
              <div className="flex gap-3 mt-5 flex-wrap">
                <Button variant="neon" size="sm" onClick={() => nav({ to: "/cases" })} className="btn-glow cursor-pointer">
                  <Gavel className="w-3.5 h-3.5 mr-1.5" /> Open Complaints Dashboard
                </Button>
              </div>
            </div>
          </div>

          {/* Key Features Section */}
          <div id="key-features-section" className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Key <span className="text-primary">Features</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-2">Core capabilities of the VigilOS platform</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Feature 1 */}
              <div
                onClick={() => nav({ to: "/cases" })}
                className="group relative rounded-2xl border border-white/10 bg-card/70 hover:bg-card/90 backdrop-blur-sm p-6 flex flex-col gap-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_0_30px_rgba(220,38,38,0.15)] cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-primary group-hover:bg-red-500/20 transition-all shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                    AICTE Oversight
                  </h3>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wider mt-0.5">
                    Cross-bureau complaint & overlap monitoring
                  </p>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  Monitor complaint proceedings across RB, PGRC, and Regional Offices. Detect cross-bureau institutional overlaps in real-time and prevent contradictory administrative directives.
                </p>

                <div className="flex items-center gap-1 text-xs font-semibold text-red-400 pt-3 border-t border-white/10 group-hover:translate-x-0.5 transition-transform">
                  <span>Explore Cases & Overlaps</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Feature 2 */}
              <div
                onClick={() => nav({ to: "/comms" })}
                className="group relative rounded-2xl border border-white/10 bg-card/70 hover:bg-card/90 backdrop-blur-sm p-6 flex flex-col gap-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_0_30px_rgba(220,38,38,0.15)] cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-primary group-hover:bg-red-500/20 transition-all shrink-0">
                  <Bell className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                    Bureau Notices
                  </h3>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wider mt-0.5">
                    Inter-bureau orders, email alerts & hearing updates
                  </p>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  Issue show-cause notices, transfer directives, and summonses across bureaus. Maintain tamper-evident audit trails for all official vigilance orders with automated deadline alerts.
                </p>

                <div className="flex items-center gap-1 text-xs font-semibold text-red-400 pt-3 border-t border-white/10 group-hover:translate-x-0.5 transition-transform">
                  <span>View Communication Hub</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Feature 3 */}
              <div
                onClick={() => nav({ to: "/help" })}
                className="group relative rounded-2xl border border-white/10 bg-card/70 hover:bg-card/90 backdrop-blur-sm p-6 flex flex-col gap-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_0_30px_rgba(220,38,38,0.15)] cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-primary group-hover:bg-red-500/20 transition-all shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                    AICTE Helpdesk & ROs
                  </h3>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wider mt-0.5">
                    Headquarters & 8 Regional Offices assistance
                  </p>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  Connect AICTE HQ with all 8 Regional Offices across India. Access nodal officers, submit jurisdictional escalations, and fast-track institutional grievance resolution.
                </p>

                <div className="flex items-center gap-1 text-xs font-semibold text-red-400 pt-3 border-t border-white/10 group-hover:translate-x-0.5 transition-transform">
                  <span>Access Helpdesk & RO Directory</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
