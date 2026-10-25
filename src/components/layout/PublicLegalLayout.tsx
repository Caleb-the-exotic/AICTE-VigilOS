// ============================================================
// src/components/layout/PublicLegalLayout.tsx
// ============================================================
// Dedicated public, accessible layout for legal & policy pages.
// Fully readable without authentication, responsive, with sticky TOC.
// ============================================================

import { type ReactNode, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { 
  Shield, FileText, Scale, ArrowLeft, ExternalLink, 
  ChevronRight, ArrowUp, Lock, CheckCircle2, Building2
} from "lucide-react";
import AnimatedBackground from "@/components/AnimatedBackground";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export interface TocSection {
  id: string;
  title: string;
}

interface PublicLegalLayoutProps {
  title: string;
  subtitle: string;
  badge: string;
  lastUpdated: string;
  sections: TocSection[];
  children: ReactNode;
}

export default function PublicLegalLayout({
  title,
  subtitle,
  badge,
  lastUpdated,
  sections,
  children,
}: PublicLegalLayoutProps) {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id || "");
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Track active section for table of contents
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);

      const scrollPosition = window.scrollY + 200;
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id);
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative selection:bg-red-500/30 selection:text-white">
      <AnimatedBackground />

      {/* ── Top Public Header / Navigation ── */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img 
                src="/aicte-logo.png" 
                alt="AICTE Official Emblem" 
                className="w-8 h-8 object-contain shrink-0 group-hover:scale-105 transition-transform" 
              />
              <span className="text-base sm:text-lg font-bold tracking-tight text-white">
                Vigil<span className="text-gradient-red">OS</span>
              </span>
            </Link>
            <span className="hidden md:inline-block text-[11px] font-mono text-muted-foreground border-l border-border/40 pl-3">
              Official Legal Information
            </span>
          </div>

          {/* Quick Nav Switcher */}
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/privacy"
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                pathname === "/privacy"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Privacy Policy</span>
            </Link>

            <Link
              to="/terms"
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                pathname === "/terms"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Terms of Service</span>
            </Link>

            {user ? (
              <Link
                to="/cases"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary/80 hover:bg-secondary text-foreground border border-border/40 transition-all ml-1"
              >
                <span>Dashboard</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-sm shadow-primary/20 ml-1"
              >
                <span>Sign In</span>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* ── Document Hero Banner ── */}
      <section className="relative border-b border-border/30 bg-gradient-to-b from-primary/5 via-transparent to-transparent py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <Link to="/" className="hover:text-primary transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>
            <span>/</span>
            <span className="text-foreground/80 font-medium">{title}</span>
          </div>

          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-semibold tracking-wide">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{badge}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
              {title}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {subtitle}
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground/80 font-mono">
              <span>Last Revised: <strong className="text-foreground font-semibold">{lastUpdated}</strong></span>
              <span>·</span>
              <span>Scope: <strong className="text-foreground font-semibold">aicte-vigil-os.vercel.app</strong></span>
              <span>·</span>
              <span>Version: <strong className="text-foreground font-semibold">2026.10-Official</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Document Body with Sticky Sidebar TOC ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Table of Contents Sidebar */}
          <aside className="lg:col-span-4 xl:col-span-3 sticky top-24 space-y-4">
            <div className="glass-card p-4 rounded-2xl border border-border/40 shadow-xl space-y-3 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin">
              <div className="flex items-center justify-between pb-2 border-b border-border/20">
                <span className="text-xs font-bold uppercase tracking-wider text-white/90 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" /> Table of Contents
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {sections.length} sections
                </span>
              </div>
              <nav className="space-y-1">
                {sections.map((sec, idx) => {
                  const isCurrent = activeSection === sec.id;
                  return (
                    <a
                      key={sec.id}
                      href={`#${sec.id}`}
                      className={cn(
                        "block px-2.5 py-1.5 rounded-lg text-xs transition-all leading-snug",
                        isCurrent
                          ? "bg-primary/20 text-white font-bold border-l-2 border-primary pl-2 shadow-xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                      )}
                    >
                      <span className="text-[10px] opacity-60 font-mono mr-1.5">{idx + 1}.</span>
                      {sec.title}
                    </a>
                  );
                })}
              </nav>

              <div className="pt-3 border-t border-border/20 space-y-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5 text-white/80 font-semibold">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  <span>AICTE VigilOS Registry</span>
                </div>
                <p className="leading-relaxed text-[10px]">
                  Institutional oversight & cross-bureau intelligence portal under AICTE regulatory framework.
                </p>
              </div>
            </div>
          </aside>

          {/* Legal Content Content Area */}
          <main className="lg:col-span-8 xl:col-span-9 space-y-8 glass-card p-6 sm:p-10 rounded-2xl border border-border/40 shadow-2xl leading-relaxed text-sm text-foreground/90">
            {children}
          </main>
        </div>
      </div>

      {/* ── Scroll to Top Floating Button ── */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          title="Return to top"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}

      {/* ── Official Legal Footer ── */}
      <footer className="border-t border-border/40 bg-card/40 backdrop-blur-md mt-16 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center gap-2">
                <img src="/aicte-logo.png" alt="AICTE Emblem" className="w-6 h-6 object-contain" />
                <span className="font-bold text-base text-white">Vigil<span className="text-gradient-red">OS</span></span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                All India Council for Technical Education (AICTE) — Aligned Institutional Complaint & Case Intelligence Platform. Problem Statement PS26264 Integrated Multi-Bureau Redressal Architecture.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">Legal & Compliance</h3>
              <ul className="space-y-1.5 text-muted-foreground">
                <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                <li><a href="mailto:2204caleb2007@gmail.com" className="hover:text-primary transition-colors">Contact: 2204caleb2007@gmail.com</a></li>
                <li><a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors inline-flex items-center gap-1">Google OAuth User Data Policy <ExternalLink className="w-3 h-3 opacity-60" /></a></li>
              </ul>
            </div>

            <div className="space-y-2 text-xs">
              <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">Platform Navigation</h3>
              <ul className="space-y-1.5 text-muted-foreground">
                <li><Link to="/" className="hover:text-primary transition-colors">Portal Home</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Officer & Citizen Sign In</Link></li>
                <li><Link to="/cases" className="hover:text-primary transition-colors">Cases & Complaints</Link></li>
                <li><Link to="/help" className="hover:text-primary transition-colors">Helpdesk & Regional Offices</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-border/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>© 2026 AICTE VigilOS. All statutory regulatory rights reserved.</p>
            <p className="text-[11px] font-mono text-muted-foreground/70">
              Live URL: <a href="https://aicte-vigil-os.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">https://aicte-vigil-os.vercel.app/</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
