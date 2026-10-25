// ============================================================
// src/components/auth/TwoFactorModal.tsx
// ============================================================
// Modal dialog for verifying 2FA OTP code on login.
// Dispatched via Gmail API v1 to user's registered email address.
// ============================================================

import { useState, useEffect, useRef } from "react";
import { ShieldCheck, Mail, ArrowRight, Loader2, RotateCw, X, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TwoFactorModalProps {
  isOpen: boolean;
  email: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TwoFactorModal({
  isOpen,
  email,
  onClose,
  onSuccess,
}: TwoFactorModalProps) {
  const { login2FA, resend2FA } = useAuth();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input and reset state when opened
  useEffect(() => {
    if (isOpen) {
      setOtp("");
      setCountdown(60);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, email]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim().replace(/\D/g, "");
    if (cleanOtp.length !== 6) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      await login2FA(email, cleanOtp);
      toast.success("Two-factor authentication verified. Welcome to VigilOS!");
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    try {
      await resend2FA(email);
      toast.success(`A fresh 6-digit verification code has been dispatched to ${email}.`);
      setCountdown(60);
      setOtp("");
      inputRef.current?.focus();
    } catch (err: any) {
      toast.error(err?.message || "Failed to resend verification code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md rounded-2xl bg-card border border-border/50 shadow-2xl overflow-hidden p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-secondary/70 transition-colors cursor-pointer"
          title="Back to login"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Heading */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 shadow-inner">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Two-Factor Verification
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            To safeguard your AICTE VigilOS account, enter the 6-digit security code sent to:
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/80 border border-border/50 text-xs font-mono text-primary font-medium">
            <Mail className="w-3.5 h-3.5" />
            <span>{email}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleVerify} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground text-center block">
              6-Digit Security Code
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setOtp(val);
                }}
                placeholder="••••••"
                disabled={loading}
                className="w-full h-13 px-4 rounded-xl bg-input/70 border border-border/40 text-center font-mono text-2xl tracking-[0.45em] placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all disabled:opacity-50"
              />
            </div>
            <p className="text-[11px] text-muted-foreground/80 text-center">
              The code will expire in 10 minutes.
            </p>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading || otp.trim().length !== 6}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-primary/20"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Security Code...</span>
              </>
            ) : (
              <>
                <span>Authenticate & Access</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Resend & Cancel Options */}
        <div className="mt-6 pt-5 border-t border-border/30 flex flex-col items-center gap-3 text-xs">
          <div className="flex items-center justify-between w-full">
            <span className="text-muted-foreground">Didn't receive the email?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={countdown > 0 || resending || loading}
              className={cn(
                "inline-flex items-center gap-1 font-medium transition-colors cursor-pointer",
                countdown > 0 || resending || loading
                  ? "text-muted-foreground/60 cursor-not-allowed"
                  : "text-primary hover:underline"
              )}
            >
              {resending ? (
                <>
                  <RotateCw className="w-3 h-3 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : countdown > 0 ? (
                <span>Resend code in {countdown}s</span>
              ) : (
                <>
                  <RotateCw className="w-3 h-3" />
                  <span>Resend code</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-muted-foreground hover:text-white transition-colors cursor-pointer text-xs"
          >
            ← Cancel and use different credentials
          </button>
        </div>
      </div>
    </div>
  );
}
