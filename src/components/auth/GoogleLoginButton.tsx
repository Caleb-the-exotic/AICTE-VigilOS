const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "178410841874-gd0mdctpo2g4s4n6govmen71v5nqp96a.apps.googleusercontent.com";

// Build the OAuth 2.0 redirect URL — always forces account picker (no caching)
function buildGoogleOAuthUrl(): string {
  const redirectUri = `${window.location.origin}/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",   // always show account chooser — prevents cached account issue
    access_type: "online",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export default function GoogleLoginButton() {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Clear any stale Google-related state before redirecting
    try {
      if (window.google?.accounts?.id?.disableAutoSelect) {
        window.google.accounts.id.disableAutoSelect();
      }
    } catch {
      // ignore
    }
    // Allow the href to proceed
    void e;
  };

  return (
    <a
      href={buildGoogleOAuthUrl()}
      onClick={handleClick}
      id="google-oauth-btn"
      aria-label="Sign in with Google"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        width: "100%",
        maxWidth: "380px",
        padding: "11px 20px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
        backdropFilter: "blur(12px)",
        color: "rgba(255,255,255,0.88)",
        fontSize: "13.5px",
        fontWeight: 600,
        letterSpacing: "0.01em",
        textDecoration: "none",
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: "0 0 0 1px rgba(239,68,68,0.15), 0 2px 8px rgba(0,0,0,0.3)",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = "linear-gradient(135deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.06) 100%)";
        el.style.boxShadow = "0 0 0 1px rgba(239,68,68,0.35), 0 4px 16px rgba(239,68,68,0.15)";
        el.style.borderColor = "rgba(239,68,68,0.4)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)";
        el.style.boxShadow = "0 0 0 1px rgba(239,68,68,0.15), 0 2px 8px rgba(0,0,0,0.3)";
        el.style.borderColor = "rgba(255,255,255,0.12)";
      }}
    >
      {/* Google G logo */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
      </svg>
      <span>Continue with Google</span>
    </a>
  );
}
