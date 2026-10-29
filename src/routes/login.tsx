import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { 
  Mail, Lock, User, Eye, EyeOff, ArrowRight, 
  Loader2, Sparkles, Building2, X
} from "lucide-react";
import AnimatedBackground from "@/components/AnimatedBackground";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";
import ForgotPasswordModal from "@/components/auth/ForgotPasswordModal";
import TwoFactorModal from "@/components/auth/TwoFactorModal";
import { useAuth, type Role } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({ component: LoginPage });

type AuthMode = "signin" | "signup";

// Demo credentials that auto-fill the form when clicked (clean, unbreached unique passwords)
const DEMO_BUTTONS = [
  { label: "Super Admin", email: "admin@aicte-india.org", password: "VigilOS#Aicte!KlpQ" },
  { label: "Bureau Head", email: "bureauhead.demo@aicte-india.org", password: "VigilOS#Bureau!RtkP" },
  { label: "Officer", email: "officer@aicte.gov.in", password: "VigilOS#Officer!XnmW" },
];

function LoginPage() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);
  const [showDemoDrawer, setShowDemoDrawer] = useState(false);

  // Sign in state
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorEmail, setTwoFactorEmail] = useState("");

  // Sign up state
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpRole, setSignUpRole] = useState<Role>("approval_officer");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  // If already logged in, redirect home
  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!signInEmail.trim() || !signInPassword) {
      toast.error("Please enter both your official email/username and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await login(signInEmail.trim(), signInPassword);
      if (res?.requires2FA) {
        setTwoFactorEmail(res.email || signInEmail.trim());
        setShowTwoFactor(true);
        return;
      }
      toast.success("Welcome back to VigilOS!");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err?.message || "Invalid credentials. Please verify your details.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!signUpName.trim()) { toast.error("Please enter your full official name."); return; }
    if (!signUpEmail.trim() || !signUpEmail.includes("@")) { toast.error("Please enter a valid official email address."); return; }
    if (signUpPassword.length < 6) { toast.error("Password must be at least 6 characters long."); return; }
    if (signUpPassword !== signUpConfirmPassword) { toast.error("Passwords do not match. Please re-enter."); return; }

    setLoading(true);
    try {
      await register({ name: signUpName.trim(), email: signUpEmail.trim().toLowerCase(), password: signUpPassword, role: signUpRole });
      toast.success("Account created and registered successfully in VigilOS!");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex justify-center items-center px-4 py-6 bg-background">
      <AnimatedBackground />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-rose-700/10 rounded-full blur-[100px] pointer-events-none" />

      {/* ── Incognito Toggle Button (Top-Left Corner) ── */}
      <button
        type="button"
        onClick={() => setShowDemoDrawer((prev) => !prev)}
        className={cn(
          "fixed top-4 left-2 sm:left-4 z-50 p-2.5 rounded-xl bg-card/90 backdrop-blur-xl border transition-all duration-200 active:scale-95 cursor-pointer shadow-lg group flex items-center justify-center",
          showDemoDrawer
            ? "border-border/60 bg-secondary text-white shadow-md"
            : "border-border/40 text-muted-foreground hover:text-white hover:bg-secondary/60 hover:border-border/60"
        )}
        title={showDemoDrawer ? "Hide Demo Credentials" : "Show Demo Credentials (Incognito)"}
        aria-label="Toggle Incognito Demo Credentials"
      >
        {/* Incognito Fedora Hat & Spy Glasses Silhouette Icon */}
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M12 2C8.5 2 7 4.5 7 5.5H3a1 1 0 0 0-.9 1.4l1.8 3.6C4.4 11.2 5 11.5 6 11.5h12c1 0 1.6-.3 2.1-1L21.9 6.9A1 1 0 0 0 21 5.5h-4C17 4.5 15.5 2 12 2zm0 1.8c2.2 0 3.2 1.5 3.5 2.2H8.5c.3-.7 1.3-2.2 3.5-2.2z" />
          <path d="M6.5 13A3.5 3.5 0 0 0 3 16.5C3 18.4 4.6 20 6.5 20c1.6 0 3-.1 3.5-1.5.5.4 1.2.5 2 .5s1.5-.1 2-.5c.5 1.4 1.9 1.5 3.5 1.5 1.9 0 3.5-1.6 3.5-3.5A3.5 3.5 0 0 0 17.5 13c-1.6 0-3 .9-3.4 2.2-.6-.2-1.3-.2-2.1-.2s-1.5 0-2.1.2C9.5 13.9 8.1 13 6.5 13zm0 1.8c1 0 1.8.8 1.8 1.7 0 1-.8 1.8-1.8 1.8-1 0-1.8-.8-1.8-1.8 0-.9.8-1.7 1.8-1.7zm11 0c1 0 1.8.8 1.8 1.7 0 1-.8 1.8-1.8 1.8-1 0-1.8-.8-1.8-1.8 0-.9.8-1.7 1.8-1.7z" />
        </svg>
      </button>

      {/* ── Demo credentials drawer – pushed to far left, clean neutral styling without red stroke/glow ── */}
      <div 
        className={cn(
          "fixed left-2 top-16 z-40 w-[170px] p-3 rounded-2xl bg-card/95 backdrop-blur-2xl border border-border/40 shadow-2xl flex flex-col gap-2 transition-all duration-300 ease-out",
          showDemoDrawer 
            ? "translate-x-0 opacity-100 pointer-events-auto" 
            : "-translate-x-[160%] opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between pb-1 border-b border-border/30">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80">
            Demo Credentials
          </p>
          <button
            type="button"
            onClick={() => setShowDemoDrawer(false)}
            className="text-muted-foreground hover:text-white p-0.5 rounded transition-colors cursor-pointer"
            title="Close Drawer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {DEMO_BUTTONS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => {
              setSignInEmail(c.email);
              setSignInPassword(c.password);
              toast.info(`Filled with ${c.label} credentials`);
            }}
            className="w-full py-2 px-3 rounded-xl border border-border/40 bg-secondary/50 hover:bg-secondary hover:text-white text-white/90 text-xs font-semibold tracking-wide text-center transition-all duration-200 active:scale-[0.98] cursor-pointer"
          >
            {c.label}
          </button>
        ))}

        <div className="border-t border-border/30 my-0.5" />

        <div className="pt-0.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80 px-0.5 mb-1.5">
            Demo Portal
          </p>
          <a
            href="/complaint-portal.html"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 px-3 rounded-xl border border-border/40 bg-secondary/50 hover:bg-secondary hover:text-white text-white/90 text-xs font-semibold tracking-wide text-center transition-all duration-200 active:scale-[0.98] cursor-pointer block"
          >
            Complaint Portal
          </a>
        </div>
      </div>

      {/* ── Centered card wrapper ── */}
      <div className={cn(
        "relative z-10 w-full mx-auto transition-all duration-300 animate-fade-in",
        mode === "signup" ? "max-w-[660px]" : "max-w-[460px]"
      )}>
        {/* The login card */}
        <div className="relative rounded-2xl bg-card/85 backdrop-blur-2xl border border-red-500/25 p-5 sm:p-7 shadow-[0_0_50px_-10px_rgba(239,68,68,0.25),0_0_20px_-5px_rgba(220,38,38,0.18)]">

          {/* Top ember line */}
          <div className="absolute -top-[1px] left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent" />

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex items-center justify-center gap-3.5 mb-2">
              <img src="/aicte-logo.png" alt="AICTE Emblem" className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0" />
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none">
                Vigil<span className="text-gradient-red">OS</span>
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              AICTE Complaint Tracking, Cross-Bureau Overlap Prevention & Autonomous Intelligence
            </p>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 p-1 bg-secondary/50 rounded-xl border border-border/60 mb-6">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "py-2 text-xs font-semibold rounded-lg transition-all duration-200",
                  mode === m ? "bg-background text-foreground shadow-sm border border-border/40" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "signin" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* ── SIGN IN FORM ── */}
          {mode === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Official Email or Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground"><Mail className="w-4 h-4" /></div>
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
                  <label className="text-xs font-medium text-muted-foreground">Password</label>
                  <button 
                    type="button" 
                    onClick={() => setShowForgotPassword(true)} 
                    className="text-[11px] text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground"><Lock className="w-4 h-4" /></div>
                  <input
                    type={showSignInPassword ? "text" : "password"}
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    className="w-full pl-10 pr-10 py-2.5 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm placeholder:text-muted-foreground/50 text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20"
                  />
                  <button type="button" onClick={() => setShowSignInPassword(!showSignInPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground" aria-label="Toggle password visibility">
                    {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground pt-0.5">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-3.5 h-3.5 rounded border-border/80 accent-red-600" />
                <span>Remember this device</span>
              </label>

              <button type="submit" disabled={loading} className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 active:scale-[0.99] transition-all shadow-md shadow-red-600/25 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Signing in…</span></> : <><span>Sign In to VigilOS</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          ) : (
            /* ── CREATE ACCOUNT FORM ── */
            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground"><User className="w-4 h-4" /></div>
                    <input type="text" value={signUpName} onChange={(e) => setSignUpName(e.target.value)} placeholder="Dr. Rajesh Sharma" required className="w-full pl-10 pr-3 py-2 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm placeholder:text-muted-foreground/50 text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Official Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground"><Mail className="w-4 h-4" /></div>
                    <input type="email" value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} placeholder="r.sharma@aicte.gov.in" required className="w-full pl-10 pr-3 py-2 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm placeholder:text-muted-foreground/50 text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground"><Lock className="w-3.5 h-3.5" /></div>
                    <input type={showSignUpPassword ? "text" : "password"} value={signUpPassword} onChange={(e) => setSignUpPassword(e.target.value)} placeholder="Min 6 chars" required className="w-full pl-9 pr-9 py-2 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm placeholder:text-muted-foreground/50 text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20" />
                    <button type="button" onClick={() => setShowSignUpPassword(!showSignUpPassword)} className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-muted-foreground hover:text-foreground" aria-label="Toggle">
                      {showSignUpPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Confirm Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground"><Lock className="w-3.5 h-3.5" /></div>
                    <input type={showSignUpPassword ? "text" : "password"} value={signUpConfirmPassword} onChange={(e) => setSignUpConfirmPassword(e.target.value)} placeholder="Repeat password" required className="w-full pl-9 pr-3 py-2 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm placeholder:text-muted-foreground/50 text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20" />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Institutional Role / Bureau</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground"><Building2 className="w-4 h-4" /></div>
                    <select value={signUpRole} onChange={(e) => setSignUpRole(e.target.value as Role)} className="w-full pl-10 pr-4 py-2 bg-secondary/30 hover:bg-secondary/40 focus:bg-background border border-border/70 focus:border-red-500/60 rounded-xl text-sm text-foreground outline-none transition-all focus:ring-2 focus:ring-red-500/20 appearance-none cursor-pointer">
                      <option value="approval_officer" className="bg-card text-foreground">Approval Officer (Case Handler)</option>
                      <option value="bureau_head" className="bg-card text-foreground">Bureau Head (RB / PGRC / RO)</option>
                      <option value="super_admin" className="bg-card text-foreground">Super Admin (Central Vigilance)</option>
                      <option value="nodal_officer" className="bg-card text-foreground">State / Regional Nodal Officer</option>
                      <option value="citizen" className="bg-card text-foreground">Citizen / Complainant</option>
                    </select>
                  </div>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 active:scale-[0.99] transition-all shadow-md shadow-red-600/25 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer mt-1">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Registering Account…</span></> : <><span>Create Official Account</span><Sparkles className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/60" /></div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-card px-3 text-muted-foreground/80 tracking-wider font-mono">or continue with official SSO</span>
            </div>
          </div>

          {/* Google Login */}
          <div className="w-full flex justify-center">
            <GoogleLoginButton />
          </div>

          {/* Legal / Policy Footer Links */}
          <div className="pt-4 mt-3 border-t border-border/30 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <Link 
              to="/privacy" 
              className="hover:text-primary transition-colors hover:underline"
            >
              Privacy Policy
            </Link>
            <span className="text-border">•</span>
            <Link 
              to="/terms" 
              className="hover:text-primary transition-colors hover:underline"
            >
              Terms of Service
            </Link>
            <span className="text-border">•</span>
            <Link 
              to="/" 
              className="hover:text-primary transition-colors hover:underline"
            >
              Home
            </Link>
          </div>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        initialEmail={signInEmail}
        onSuccess={(resetEmail) => {
          setSignInEmail(resetEmail);
          setMode("signin");
          toast.success("Password reset successfully! Please sign in with your new password.");
        }}
      />

      <TwoFactorModal
        isOpen={showTwoFactor}
        email={twoFactorEmail}
        onClose={() => setShowTwoFactor(false)}
        onSuccess={() => {
          setShowTwoFactor(false);
          navigate({ to: "/" });
        }}
      />
    </div>
  );
}
