import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { 
  Mail, Lock, User, Eye, EyeOff, ArrowRight, 
  Loader2, Sparkles, Building2 
} from "lucide-react";
import AnimatedBackground from "@/components/AnimatedBackground";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";
import { useAuth, type Role } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({ component: LoginPage });

type AuthMode = "signin" | "signup";

function LoginPage() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);

  // Sign in state
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Sign up state
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpRole, setSignUpRole] = useState<Role>("faculty");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  // If already logged in, redirect home
  useEffect(() => {
    if (user) {
      navigate({ to: "/" });
    }
  }, [user, navigate]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!signInEmail.trim() || !signInPassword) {
      toast.error("Please enter both your official email/username and password.");
      return;
    }

    setLoading(true);
    try {
      await login(signInEmail.trim(), signInPassword);
      toast.success("Welcome back to VigilOS!");
      navigate({ to: "/" });
    } catch (err: any) {
      console.error("[Login Error]:", err);
      toast.error(err?.message || "Invalid credentials. Please verify your details.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!signUpName.trim()) {
      toast.error("Please enter your full official name.");
      return;
    }
    if (!signUpEmail.trim() || !signUpEmail.includes("@")) {
      toast.error("Please enter a valid official email address.");
      return;
    }
    if (signUpPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    if (signUpPassword !== signUpConfirmPassword) {
      toast.error("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);
    try {
      await register({
        name: signUpName.trim(),
        email: signUpEmail.trim().toLowerCase(),
        password: signUpPassword,
        role: signUpRole,
      });
      toast.success("Account created and registered successfully in VigilOS!");
      navigate({ to: "/" });
    } catch (err: any) {
      console.error("[Registration Error]:", err);
      toast.error(err?.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center px-4 py-4 sm:py-6 bg-background">
      <AnimatedBackground />

      {/* Decorative ambient background lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-rose-700/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Outer wrapper — widens in signin mode to accommodate the credentials panel */}
      <div className={cn(
        "relative z-10 w-full mx-auto transition-all duration-300 animate-fade-in",
        mode === "signup" ? "max-w-[660px]" : "max-w-[820px]"
      )}>

        {/* Glow Container */}
        <div className="relative rounded-2xl bg-card/85 backdrop-blur-2xl border border-red-500/25 shadow-[0_0_50px_-10px_rgba(239,68,68,0.25),0_0_20px_-5px_rgba(220,38,38,0.18)] transition-all duration-300 overflow-hidden">

          {/* Subtle top edge ember gradient line */}
          <div className="absolute -top-[1px] left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent" />

          {/* Inner flex row — 2-col in signin mode */}
          <div className={cn(
            "flex",
            mode === "signin" ? "flex-col sm:flex-row" : "flex-col"
          )}>

            {/* ─────────────────────────────────────────────────────────── */}
            {/* LEFT PANEL – Demo credentials (signin mode only) */}
            {/* ─────────────────────────────────────────────────────────── */}
            {mode === "signin" && (
              <div className="sm:w-[260px] shrink-0 bg-secondary/30 border-b sm:border-b-0 sm:border-r border-border/40 p-5 flex flex-col gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2.5">Demo Credentials</p>
                  <div className="space-y-2">
                    {[
                      { label: "Super Admin", email: "admin@aicte-india.org", pass: "12345678", badge: "bg-red-500/15 text-red-400 border-red-500/30" },
                      { label: "Bureau Head", email: "admin", pass: "use username: admin", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
                      { label: "Officer", email: "officer@aicte.gov.in", pass: "demo1234", badge: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
                    ].map((c) => (
                      <button
                        key={c.email}
                        type="button"
                        onClick={() => { setSignInEmail(c.email); setSignInPassword(c.pass.startsWith("use") ? "admin" : c.pass); }}
                        className="w-full text-left p-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/70 border border-border/40 hover:border-red-500/30 transition-all group"
                      >
                        <span className={cn("inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full border mb-1", c.badge)}>{c.label}</span>
                        <p className="text-[11px] text-foreground/80 group-hover:text-foreground font-mono truncate">{c.email}</p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono">{c.pass}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border/40" />

                {/* Complaint Portal button */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Public Access</p>
                  <a
                    href="/complaint-portal.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-amber-500/30 bg-amber-500/8 hover:bg-amber-500/15 text-amber-300 hover:text-amber-200 text-[12px] font-semibold transition-all"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Complaint Portal
                  </a>
                  <p className="text-[9.5px] text-muted-foreground/50 text-center mt-1.5">Submit grievances without login</p>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────── */}
            {/* RIGHT / MAIN PANEL – Auth form */}
            {/* ─────────────────────────────────────────────────────────── */}
            <div className="flex-1 p-5 sm:p-7">
              {/* Header & AICTE Branding */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="flex items-center justify-center gap-3.5 mb-2">
                  <img
                    src="/aicte-logo.png"
                    alt="AICTE Emblem"
                    className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0"
                  />
                  <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none">
                    Vigil<span className="text-gradient-red">OS</span>
                  </h1>
                </div>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  AICTE Complaint Tracking, Cross-Bureau Overlap Prevention & Autonomous Intelligence
                </p>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-2 p-1 bg-secondary/50 rounded-xl border border-border/60 mb-6">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={cn(
                    "py-2 text-xs font-semibold rounded-lg transition-all duration-200",
                    mode === "signin"
                      ? "bg-background text-foreground shadow-sm border border-border/40"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={cn(
                    "py-2 text-xs font-semibold rounded-lg transition-all duration-200",
                    mode === "signup"
                      ? "bg-background text-foreground shadow-sm border border-border/40"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Create Account
                </button>
              </div>

              {/* ─────────────────────────────────────────────────────────── */}
              {/* SIGN IN FORM */}
              {/* ─────────────────────────────────────────────────────────── */}
              {mode === "signin" ? (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Official Email or Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        placeholder="officer@aicte.gov.in"
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm placeholder:text-muted-foreground/50 text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => toast.info("For credential reset, please contact your Bureau Administrator or email support@aicte-india.org")}
                        className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showSignInPassword ? "text" : "password"}
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full pl-10 pr-10 py-2.5 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm placeholder:text-muted-foreground/50 text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignInPassword(!showSignInPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                        aria-label="Toggle password visibility"
                      >
                        {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-border/80 text-red-600 focus:ring-red-500/30 accent-red-600"
                      />
                      <span>Remember this device</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 active:scale-[0.99] transition-all shadow-md shadow-red-600/25 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing in to VigilOS…</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In to VigilOS</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* ─────────────────────────────────────────────────────────── */
                /* CREATE ACCOUNT FORM */
                /* ─────────────────────────────────────────────────────────── */
                <form onSubmit={handleSignUp} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Full Name
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          value={signUpName}
                          onChange={(e) => setSignUpName(e.target.value)}
                          placeholder="Dr. Rajesh Sharma"
                          required
                          className="w-full pl-10 pr-3 py-2 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm placeholder:text-muted-foreground/50 text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20"
                        />
                      </div>
                    </div>

                    {/* Official Email */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Official Email Address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          value={signUpEmail}
                          onChange={(e) => setSignUpEmail(e.target.value)}
                          placeholder="r.sharma@aicte.gov.in"
                          required
                          className="w-full pl-10 pr-3 py-2 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm placeholder:text-muted-foreground/50 text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type={showSignUpPassword ? "text" : "password"}
                          value={signUpPassword}
                          onChange={(e) => setSignUpPassword(e.target.value)}
                          placeholder="Min 6 chars"
                          required
                          className="w-full pl-9 pr-9 py-2 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm placeholder:text-muted-foreground/50 text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-muted-foreground hover:text-foreground"
                          aria-label="Toggle password visibility"
                        >
                          {showSignUpPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type={showSignUpPassword ? "text" : "password"}
                          value={signUpConfirmPassword}
                          onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                          placeholder="Repeat password"
                          required
                          className="w-full pl-9 pr-3 py-2 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm placeholder:text-muted-foreground/50 text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20"
                        />
                      </div>
                    </div>

                    {/* Institutional Role / Bureau */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Institutional Role / Bureau
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <select
                          value={signUpRole}
                          onChange={(e) => setSignUpRole(e.target.value as Role)}
                          className="w-full pl-10 pr-4 py-2 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20 appearance-none cursor-pointer"
                        >
                          <option value="faculty" className="bg-card text-foreground">📋 Approval Officer (Case Handler)</option>
                          <option value="hod" className="bg-card text-foreground">🏛️ Bureau Head (RB / PGRC / RO)</option>
                          <option value="admin" className="bg-card text-foreground">🔑 Super Admin (Central Vigilance)</option>
                          <option value="ambassador" className="bg-card text-foreground">🌐 State / Regional Nodal Officer</option>
                          <option value="student" className="bg-card text-foreground">👤 Citizen / Complainant</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 active:scale-[0.99] transition-all shadow-md shadow-red-600/25 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer mt-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Registering Account…</span>
                      </>
                    ) : (
                      <>
                        <span>Create Official Account</span>
                        <Sparkles className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Divider */}
              <div className="relative my-3.5 sm:my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase">
                  <span className="bg-card px-3 text-muted-foreground/80 tracking-wider font-mono">
                    or continue with official SSO
                  </span>
                </div>
              </div>

              {/* Google Login Button */}
              <div className="w-full flex justify-center">
                <GoogleLoginButton />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
