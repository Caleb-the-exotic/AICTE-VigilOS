import React, { useEffect, useState } from "react";
import { RotateCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkspaceLoadingScreenProps {
  heading?: string;
  message?: string;
  progress?: number; // Optional numerical percentage (0-100) when measurable
  onRetry?: () => void;
  className?: string;
}

export function WorkspaceLoadingScreen({
  heading = "Preparing your secure workspace",
  message = "Verifying your session and loading workspace...",
  progress,
  onRetry,
  className,
}: WorkspaceLoadingScreenProps) {
  const [showTimeoutNotice, setShowTimeoutNotice] = useState(false);
  const isMeasurable = typeof progress === "number" && progress >= 0 && progress <= 100;

  // Staged progress fallback for asynchronous initializations without real byte tracking
  const [stagedProgress, setStagedProgress] = useState<number>(isMeasurable ? progress : 15);

  useEffect(() => {
    if (isMeasurable) {
      setStagedProgress(progress);
      return;
    }

    // Meaningful initialization stages
    const timer1 = setTimeout(() => setStagedProgress(35), 400);
    const timer2 = setTimeout(() => setStagedProgress(65), 1100);
    const timer3 = setTimeout(() => setStagedProgress(85), 2200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isMeasurable, progress]);

  // If loading exceeds 9 seconds, show helpful retry option instead of trapping user indefinitely
  useEffect(() => {
    const timeoutTimer = setTimeout(() => {
      setShowTimeoutNotice(true);
    }, 9000);
    return () => clearTimeout(timeoutTimer);
  }, []);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${heading}: ${message}`}
      className={cn(
        "min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground relative overflow-hidden select-none px-4",
        className
      )}
    >
      {/* Background radial atmosphere */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-b from-orange-600/15 via-red-600/10 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(currentColor_1px,transparent_1px)] opacity-[0.04] [background-size:24px_24px] pointer-events-none" />

      {/* Main Content Card */}
      <div className="w-full max-w-lg flex flex-col items-center text-center z-10 space-y-6">
        
        {/* AICTE VigilOS Branding Header */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-secondary/80 border border-border/60 backdrop-blur-md shadow-xs animate-fade-in">
          <img
            src="/aicte-logo.png"
            alt="AICTE Logo"
            className="w-5 h-5 object-contain shrink-0 drop-shadow-xs"
          />
          <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
            AICTE VigilOS <span className="text-orange-500">•</span> Secure Workspace
          </span>
        </div>

        {/* Heading & Contextual Subtitle */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground drop-shadow-sm">
            {heading}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium max-w-md mx-auto">
            {message}
          </p>
        </div>

        {/* ── Glowing Amber Progress Bar Capsule ── */}
        <div className="w-full max-w-md space-y-2">
          <div
            className="w-full h-11 sm:h-12 rounded-2xl bg-secondary/80 dark:bg-neutral-950/80 border border-orange-500/30 p-1.5 relative overflow-hidden backdrop-blur-2xl shadow-[0_0_35px_rgba(249,115,22,0.18)] flex items-center"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={stagedProgress}
          >
            {/* Ambient track texture */}
            <div className="absolute inset-0 bg-gradient-to-b from-foreground/5 to-transparent pointer-events-none rounded-2xl" />

            {/* Glowing Core Bar */}
            <div
              className={cn(
                "h-full rounded-xl transition-all duration-700 ease-out relative flex items-center justify-end pr-3.5",
                "bg-gradient-to-r from-amber-100 via-orange-400 to-orange-500",
                "shadow-[0_0_20px_rgba(249,115,22,0.85),0_0_45px_rgba(234,88,12,0.45),inset_0_0_8px_rgba(255,255,255,0.7)]"
              )}
              style={{ width: `${Math.max(8, Math.min(100, stagedProgress))}%` }}
            >
              {/* Hot White Center Filament */}
              <div className="absolute inset-y-1.5 left-2 right-2 rounded-lg bg-gradient-to-r from-white via-amber-100 to-amber-200/90 blur-[0.5px]" />
              
              {/* Trailing Shimmer Flare */}
              <div className="absolute -right-1 top-0 bottom-0 w-3 rounded-r-xl bg-white shadow-[0_0_15px_#ffffff]" />
            </div>

            {/* Percentage Display */}
            <div className="absolute right-4 font-mono text-xs font-bold text-foreground drop-shadow-xs select-none pointer-events-none">
              {stagedProgress}%
            </div>
          </div>
        </div>

        {/* ── Recoverable Error / Timeout Notice ── */}
        <div className="min-h-[76px] flex flex-col items-center justify-start">
          <div
            className={cn(
              "transition-all duration-300 flex flex-col items-center space-y-2",
              showTimeoutNotice
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 -translate-y-1 pointer-events-none"
            )}
            aria-hidden={!showTimeoutNotice}
          >
            <div className="flex items-center gap-1.5 text-xs text-amber-500 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Workspace initialization taking longer than usual</span>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-card border border-border hover:border-orange-500 text-foreground hover:text-orange-500 transition-all cursor-pointer shadow-md active:scale-95"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Session Connection</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default WorkspaceLoadingScreen;
