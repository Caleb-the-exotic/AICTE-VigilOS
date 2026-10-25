// ============================================================
// src/components/profile/ChangePasswordModal.tsx
// ============================================================
// In-settings modal for changing password with OTP verification.
// ============================================================

import { useState, useEffect } from "react";
import { 
  Key, Mail, Lock, Eye, EyeOff, 
  ArrowRight, Loader2, CheckCircle2, RotateCw, X, ShieldCheck
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export default function ChangePasswordModal({
  isOpen,
  onClose,
  userEmail,
}: ChangePasswordModalProps) {
  const [step, setStep] = useState<"request" | "verify" | "success">("request");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setStep("request");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!isOpen) return null;

  const handleSendOtp = async () => {
    setLoading(true);
    try {
      const res = await api.settingsSendOtp();
      toast.success(res.message || `Verification code dispatched to ${userEmail}`);
      setStep("verify");
      setCountdown(60);
    } catch (err: any) {
      toast.error(err?.message || "Failed to deliver OTP to your email address.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length !== 6) {
      toast.error("Please enter the 6-digit OTP code.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match. Please verify.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.settingsResetPassword(otp.trim(), newPassword);
      toast.success(res.message || "Your password has been updated successfully!");
      setStep("success");
    } catch (err: any) {
      toast.error(err?.message || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-md bg-card border border-border/60 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/25 flex items-center justify-center text-primary shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {step === "success" ? "Password Changed" : "Change Password"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {step === "request" && "Confirm your identity via verification code before updating password."}
              {step === "verify" && "Enter the OTP code sent to your registered email and your new password."}
              {step === "success" && "Password change complete."}
            </p>
          </div>
        </div>

        {/* ── STEP 1: Request OTP ── */}
        {step === "request" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/40 space-y-1.5 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Registered Account Email:
              </span>
              <p className="font-mono text-primary text-sm font-semibold pl-5">
                {userEmail}
              </p>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              To safeguard your account and prevent unauthorized changes, we will dispatch a 6-digit One-Time Password (OTP) to your registered email via Gmail API.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary/70 border border-border/40 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 active:scale-[0.99] transition-all shadow-md shadow-red-600/25 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Code…</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Verify OTP & New Password ── */}
        {step === "verify" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Code sent to: <strong className="text-foreground">{userEmail}</strong></span>
              {countdown > 0 ? (
                <span className="text-muted-foreground font-mono text-[11px]">{countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="text-primary hover:underline text-[11px] cursor-pointer"
                >
                  Resend
                </button>
              )}
            </div>

            {/* OTP Input */}
            <div className="space-y-1.5">
              <label htmlFor="settings-otp" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                6-Digit Verification Code (OTP)
              </label>
              <input
                id="settings-otp"
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                required
                autoFocus
                className="w-full py-2.5 px-3 bg-secondary/40 border border-border/70 focus:border-red-500/60 rounded-xl text-center font-mono text-xl tracking-[0.35em] text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label htmlFor="settings-new-pass" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <input
                  id="settings-new-pass"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  className="w-full pl-9 pr-9 py-2 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="settings-confirm-pass" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <input
                  id="settings-confirm-pass"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 active:scale-[0.99] transition-all shadow-md shadow-red-600/25 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password…</span>
                </>
              ) : (
                <>
                  <span>Confirm Password Change</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ── STEP 3: Success ── */}
        {step === "success" && (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Password Changed Successfully!</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Your new password has been verified and saved. Your account security credentials are now updated.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 transition-all cursor-pointer shadow-md"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
