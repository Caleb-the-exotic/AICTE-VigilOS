import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "178410841874-gd0mdctpo2g4s4n6govmen71v5nqp96a.apps.googleusercontent.com";

export default function GoogleLoginButton() {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const initialized = useRef(false);
  const [btnReady, setBtnReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleCredentialResponse = async (response: any) => {
    try {
      if (!response?.credential) {
        throw new Error("No credential token returned from Google");
      }
      setIsAuthenticating(true);
      await loginWithGoogle(response.credential);
      toast.success("Successfully authenticated with Google Workspace!");
      navigate({ to: "/" });
    } catch (err: any) {
      console.error("[Google Auth Callback] Error:", err);
      toast.error(err?.message || "Google authentication failed. Please try standard sign in.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;

    const tryInit = () => {
      attempts++;
      const g = (window as any).google;
      if (!g?.accounts?.id) {
        if (attempts > 50 && timer) clearInterval(timer);
        return false;
      }

      const container = document.getElementById("google-btn-rendered");
      if (!container) return false;

      if (!initialized.current) {
        initialized.current = true;

        g.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        // Ensure previously logged in account is never auto-selected without prompt
        try {
          g.accounts.id.disableAutoSelect();
        } catch {
          // ignore
        }

        g.accounts.id.renderButton(container, {
          theme: "filled_black",
          size: "large",
          width: 380,
          text: "signin_with",
          shape: "pill",
          logo_alignment: "left",
        });

        setBtnReady(true);
      }

      if (timer) clearInterval(timer);
      return true;
    };

    if (!tryInit()) {
      timer = setInterval(tryInit, 150);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  const handlePromptFallback = () => {
    const g = (window as any).google;
    if (g?.accounts?.id) {
      setIsAuthenticating(true);
      try {
        g.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setIsAuthenticating(false);
          }
        });
      } catch {
        setIsAuthenticating(false);
      }
    } else {
      toast.info("Connecting to Google Identity… please wait a moment.");
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Outer stylized glass frame with red hover glow */}
      <div className="w-full max-w-[380px] relative group rounded-xl p-[1px] bg-gradient-to-r from-border/70 via-red-500/20 to-border/70 hover:from-red-500/40 hover:via-rose-500/40 hover:to-red-500/40 transition-all duration-300">
        <div className="w-full bg-secondary/40 backdrop-blur-md rounded-[11px] p-1 flex items-center justify-center min-h-[46px] relative overflow-hidden">
          {/* Actual Google rendered button container */}
          <div
            id="google-btn-rendered"
            className="w-full flex justify-center [&>div]:!w-full [&_iframe]:!w-full [&_iframe]:!max-w-full"
            style={{ display: btnReady ? "flex" : "none" }}
          />

          {/* Fallback state while loading Google script */}
          {!btnReady && (
            <button
              type="button"
              onClick={handlePromptFallback}
              disabled={isAuthenticating}
              className="w-full py-2.5 px-4 flex items-center justify-center gap-3 text-sm font-medium text-foreground/90 hover:text-foreground transition-all duration-200 cursor-pointer"
            >
              {isAuthenticating ? (
                <Loader2 className="w-4 h-4 animate-spin text-red-500" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
