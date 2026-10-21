import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

declare global {
  interface Window {
    google: any;
  }
}

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "178410841874-gd0mdctpo2g4s4n6govmen71v5nqp96a.apps.googleusercontent.com";

export default function GoogleLoginButton() {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const initialized = useRef(false);
  const [btnReady, setBtnReady] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const setupGoogle = () => {
      if (typeof window === "undefined" || !window.google?.accounts?.id || initialized.current) {
        return false;
      }
      const container = document.getElementById("google-btn");
      if (!container) return false;

      initialized.current = true;
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCallback,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        window.google.accounts.id.renderButton(container, {
          theme: "filled_black",
          size: "large",
          width: 320,
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
        });

        setBtnReady(true);
        return true;
      } catch (err) {
        console.error("[Google Identity] Initialization error:", err);
        return false;
      }
    };

    if (!setupGoogle()) {
      timer = setInterval(() => {
        if (setupGoogle() && timer) {
          clearInterval(timer);
        }
      }, 150);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  const handleCallback = async (response: any) => {
    try {
      if (!response?.credential) {
        throw new Error("No credential token returned from Google");
      }
      await loginWithGoogle(response.credential);
      toast.success("Successfully logged in with Google!");
      navigate({ to: "/" });
    } catch (err: any) {
      console.error("[Google Auth Callback] Error:", err);
      toast.error(err?.message || "Google authentication failed");
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[44px]">
      <div id="google-btn" className="flex justify-center w-full" />
      {!btnReady && (
        <div className="text-xs text-muted-foreground animate-pulse py-2">
          Connecting to Google Identity…
        </div>
      )}
    </div>
  );
}
