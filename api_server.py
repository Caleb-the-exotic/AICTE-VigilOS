# ============================================================
# api_server.py — AICTEProFlow FastAPI Backend Bridge
# ============================================================
# Exposes the full CampusFlow autonomous backend as REST endpoints
# that the React frontend (src/lib/api.ts) talks to.
#
# The autonomous THINK → PLAN → EXECUTE → REVIEW → UPDATE loop
# is preserved exactly from CampusFlowMain — campus/executor.py
# is called unchanged.
#
# Run with:  uvicorn api_server:app --reload --port 8000
# Frontend:  set VITE_API_BASE_URL=http://localhost:8000 in .env
# ============================================================

import os
import uuid
import datetime
import secrets
import time
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends, Header, Query, BackgroundTasks, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import jwt

load_dotenv()


# ── Campus backend imports ───────────────────────────────────────
from campus import db, auth, pdf_exporter, role_service, gmail_mailer
from campus.executor import run as campus_run

# ── Multi-Agent Kernel & Event Bus ──────────────────────────────
try:
    from campus.event_bus import bus, Events, start as start_event_bus
    _EVENT_BUS_AVAILABLE = True
except ImportError:
    _EVENT_BUS_AVAILABLE = False

# ── PS26264: Overlap Agent ───────────────────────────────────────
try:
    from campus.agents.overlap_agent import OverlapAgent
    _OVERLAP_AGENT_AVAILABLE = True
except ImportError:
    _OVERLAP_AGENT_AVAILABLE = False

# ── Init DB on startup ───────────────────────────────────────────
try:
    auth.init_auth_db()
except Exception:
    pass

# ── Start Event Bus worker thread ────────────────────────────────
if _EVENT_BUS_AVAILABLE:
    try:
        start_event_bus()
    except Exception:
        pass

# ── In-memory token store (swap for Redis/DB in prod) ────────────
_token_store: dict[str, dict] = {}   # token → {username, role, name}
_2fa_store: dict[str, dict] = {}     # email → {otp, expires_at, attempts, user_id, name}

# ── Groq client factory ──────────────────────────────────────────
def _make_groq() -> Groq:
    key = os.getenv("GROQ_API_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured on server.")
    return Groq(api_key=key)

def _default_model() -> str:
    return os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

def _tavily_key() -> str:
    return os.getenv("TAVILY_API_KEY", "")

# ── App setup ────────────────────────────────────────────────────
app = FastAPI(
    title="AICTEProFlow API",
    description="Autonomous campus workflow backend — THINK→PLAN→EXECUTE→REVIEW→UPDATE",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth helper ──────────────────────────────────────────────────
def _get_current_user(
    authorization: Optional[str] = Header(None),
    token_query: Optional[str] = Query(None, alias="token"),
) -> dict:
    raw_token = None
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split(" ", 1)[1]
    elif token_query:
        raw_token = token_query

    if not raw_token:
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = raw_token
    
    user = None
    # 1. Try decoding token as JWT
    try:
        secret = os.getenv("JWT_SECRET") or "vigilos_rbac_sqlite_jwt_secret_token_key_2026_super_secure"
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        email = payload.get("email")
        uid = payload.get("id")
        if email:
            user = role_service.get_user_by_email(email)
        elif uid:
            user = role_service.get_user_by_id(uid)
    except HTTPException:
        raise
    except Exception:
        pass

    # 2. Try in-memory token store, refreshing from SQLite
    if not user:
        stored = _token_store.get(token)
        if stored:
            s_email = stored.get("normalized_email") or stored.get("email")
            s_id = stored.get("id")
            if s_email:
                user = role_service.get_user_by_email(s_email)
            elif s_id:
                user = role_service.get_user_by_id(s_id)
            if not user:
                user = stored

    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    status = user.get("status", "active")
    if status != "active":
        raise HTTPException(status_code=403, detail=f"Account is {status}. Access restricted.")

    role = user.get("role_key") or user.get("role") or "citizen"
    return {
        "id": user["id"],
        "username": user.get("normalized_email", user.get("email", "")).split("@")[0],
        "name": user["name"],
        "email": user.get("normalized_email", user.get("email", "")),
        "role": role,
        "role_key": role,
        "role_label": user.get("role_name", user.get("role_label", role)),
        "bureau_code": user.get("bureau_code") or "HQ",
        "bureau": user.get("bureau_name") or user.get("bureau", "National Portal"),
        "region_code": user.get("region_code") or "HQ",
        "region": user.get("region_name") or user.get("region", "HQ (New Delhi)"),
        "status": status,
        "two_factor_enabled": bool(user.get("two_factor_enabled", False)),
        "permissions": user.get("permissions", []),
    }


# ═══════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AICTEProFlow", "autonomous_loop": "active"}

# ═══════════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ═══════════════════════════════════════════════════════════════
class LoginBody(BaseModel):
    email: str
    password: str

class RegisterBody(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = "citizen"

@app.get("/api/auth/me")
def get_me(user: dict = Depends(_get_current_user)):
    """Return authenticated user profile with active role and permissions."""
    return user

@app.post("/api/auth/login")
def login(body: LoginBody):
    identifier = body.email.strip()
    ok, result = auth.verify_login(identifier, body.password)
    if not ok:
        raise HTTPException(status_code=401, detail=result or "Invalid email/username or password")
    
    # Check if Two-Factor Authentication (2FA) is enabled for this account
    user_id = result["id"]
    if role_service.is_user_2fa_enabled(user_id):
        user_email = (result.get("email") or result.get("normalized_email", "")).strip().lower()
        if not user_email:
            raise HTTPException(status_code=400, detail="Account has no registered email for two-factor verification.")

        otp = f"{secrets.randbelow(900000) + 100000}"
        expires_at = time.time() + 600  # 10 minutes
        _2fa_store[user_email] = {
            "otp": otp,
            "expires_at": expires_at,
            "attempts": 0,
            "user_id": user_id,
            "name": result.get("name", "User"),
        }

        try:
            gmail_mailer.send_otp_email(
                to_email=user_email,
                otp_code=otp,
                name=result.get("name"),
                purpose="Two-Factor Authentication (2FA) Sign-In"
            )
        except Exception as e:
            print(f"[2FA Login Error] Failed to send OTP: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to dispatch 2FA verification email: {str(e)}"
            )

        return {
            "requires_2fa": True,
            "email": user_email,
            "message": f"A 6-digit verification code has been dispatched to {user_email}.",
        }

    token = auth.create_jwt(result)
    _token_store[token] = result
    
    return {
        "token": token,
        "user": result,
    }

@app.post("/api/auth/register")
def register(body: RegisterBody):
    email = body.email.strip()
    username = email.split("@")[0] if "@" in email else body.name.lower().replace(" ", "_")
    role = body.role or "citizen"
    ok, result = auth.register_user(
        username=username,
        password=body.password,
        role=role,
        name=body.name.strip(),
        email=email
    )
    if not ok:
        raise HTTPException(status_code=400, detail=result)
    
    token = auth.create_jwt(result)
    _token_store[token] = result
    
    return {
        "token": token,
        "user": result,
    }

class GoogleLoginBody(BaseModel):
    credential: Optional[str] = None
    token: Optional[str] = None

@app.post("/api/auth/google")
def google_login(body: GoogleLoginBody):
    token = body.token or body.credential
    if not token:
        raise HTTPException(status_code=400, detail="Missing Google token/credential")
        
    user_info = auth.verify_google_token(token)
    if not user_info:
        raise HTTPException(status_code=401, detail="Invalid Google token")
        
    email = user_info["email"]
    name = user_info.get("name", email)
    sub = user_info.get("sub")
    
    ok, result = auth.verify_google_login(email, name, sub)
    if not ok:
        raise HTTPException(status_code=403, detail=result or "Google login unauthorized")
        
    jwt_token = auth.create_jwt(result)
    _token_store[jwt_token] = result
    
    return {
        "token": jwt_token,
        "user": result,
    }

@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        _token_store.pop(token, None)
    return {"ok": True}

# ── In-memory OTP store ───────────────────────────────────────────
# email -> {"otp": "123456", "expires_at": float, "attempts": int, "name": str}
_otp_store: dict[str, dict] = {}

class SendOtpBody(BaseModel):
    email: str
    purpose: Optional[str] = "Password Reset"

class VerifyResetPasswordBody(BaseModel):
    email: str
    otp: str
    new_password: str

class SettingsResetPasswordBody(BaseModel):
    otp: str
    new_password: str

@app.post("/api/auth/otp/send")
def send_otp(body: SendOtpBody):
    """
    Generate and send a 6-digit OTP to the registered user's email via Gmail API v1.
    """
    raw_email = body.email.strip()
    norm_email = raw_email.lower()

    # Verify user exists in SQLite
    user = role_service.get_user_by_email(norm_email)
    if not user:
        # Also check if username or partial email was passed
        conn = db.get_conn()
        cur = conn.cursor()
        cur.execute("SELECT normalized_email, name FROM users WHERE normalized_email LIKE ? OR name LIKE ? LIMIT 1", (f"{norm_email}%", f"%{raw_email}%"))
        row = cur.fetchone()
        conn.close()
        if row:
            norm_email = row["normalized_email"]
            user = role_service.get_user_by_email(norm_email)

    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"No AICTE VigilOS account is registered with '{raw_email}'."
        )

    # Generate cryptographically secure 6-digit OTP
    otp = f"{secrets.randbelow(900000) + 100000}"
    expires_at = time.time() + 600  # 10 minutes

    _otp_store[norm_email] = {
        "otp": otp,
        "expires_at": expires_at,
        "attempts": 0,
        "name": user.get("name", "User"),
    }

    # Send OTP via Gmail API
    try:
        gmail_mailer.send_otp_email(
            to_email=norm_email,
            otp_code=otp,
            name=user.get("name"),
            purpose=body.purpose or "Password Reset"
        )
    except Exception as e:
        print(f"[OTP Send Error] Failed to send email via Gmail API: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to deliver verification email. Error: {str(e)}"
        )

    return {
        "ok": True,
        "message": f"A 6-digit verification code has been sent to {norm_email}.",
        "email": norm_email,
    }

@app.post("/api/auth/otp/verify-reset")
def verify_otp_and_reset_password(body: VerifyResetPasswordBody):
    """
    Verify OTP and reset password for the given email.
    """
    norm_email = body.email.strip().lower()
    entry = _otp_store.get(norm_email)

    if not entry:
        raise HTTPException(
            status_code=400,
            detail="No verification code was requested for this email, or it has expired."
        )

    if time.time() > entry["expires_at"]:
        _otp_store.pop(norm_email, None)
        raise HTTPException(
            status_code=400,
            detail="The verification code has expired. Please request a new code."
        )

    if entry["attempts"] >= 5:
        _otp_store.pop(norm_email, None)
        raise HTTPException(
            status_code=429,
            detail="Too many invalid attempts. For security, please request a new verification code."
        )

    if entry["otp"] != body.otp.strip():
        entry["attempts"] += 1
        remaining = 5 - entry["attempts"]
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect verification code. {remaining} attempt(s) remaining."
        )

    if len(body.new_password) < 6:
        raise HTTPException(
            status_code=400,
            detail="New password must be at least 6 characters long."
        )

    # Perform password update in SQLite database
    try:
        role_service.update_user_password_by_email(norm_email, body.new_password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Clear OTP upon successful consumption
    _otp_store.pop(norm_email, None)

    return {
        "ok": True,
        "message": "Your password has been successfully reset. You can now sign in with your new credentials."
    }

@app.post("/api/auth/settings/send-otp")
def settings_send_otp(user: dict = Depends(_get_current_user)):
    """
    Send OTP to authenticated user's registered email for in-settings password reset.
    """
    email = user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Authenticated user has no registered email.")

    otp = f"{secrets.randbelow(900000) + 100000}"
    expires_at = time.time() + 600

    _otp_store[email.lower()] = {
        "otp": otp,
        "expires_at": expires_at,
        "attempts": 0,
        "name": user.get("name", "User"),
    }

    try:
        gmail_mailer.send_otp_email(
            to_email=email,
            otp_code=otp,
            name=user.get("name"),
            purpose="In-Settings Password Reset"
        )
    except Exception as e:
        print(f"[Settings OTP Error] {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to deliver verification code: {str(e)}"
        )

    return {
        "ok": True,
        "message": f"Verification code sent to {email}."
    }

@app.post("/api/auth/settings/reset-password")
def settings_reset_password(body: SettingsResetPasswordBody, user: dict = Depends(_get_current_user)):
    """
    Verify OTP and reset password for authenticated user in Settings.
    """
    email = user.get("email", "").lower()
    entry = _otp_store.get(email)

    if not entry:
        raise HTTPException(
            status_code=400,
            detail="No verification code was requested, or it has expired."
        )

    if time.time() > entry["expires_at"]:
        _otp_store.pop(email, None)
        raise HTTPException(
            status_code=400,
            detail="The verification code has expired. Please request a new code."
        )

    if entry["attempts"] >= 5:
        _otp_store.pop(email, None)
        raise HTTPException(
            status_code=429,
            detail="Too many invalid attempts. Please request a new code."
        )

    if entry["otp"] != body.otp.strip():
        entry["attempts"] += 1
        remaining = 5 - entry["attempts"]
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect verification code. {remaining} attempt(s) remaining."
        )

    if len(body.new_password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters long."
        )

    try:
        role_service.update_user_password(user["id"], body.new_password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    _otp_store.pop(email, None)

    return {
        "ok": True,
        "message": "Password successfully changed!"
    }

# ═══════════════════════════════════════════════════════════════
# TWO-FACTOR AUTHENTICATION (2FA) ENDPOINTS
# ═══════════════════════════════════════════════════════════════
class Login2FABody(BaseModel):
    email: str
    otp: str

class Resend2FABody(BaseModel):
    email: str

class Toggle2FABody(BaseModel):
    enabled: bool

@app.post("/api/auth/login/2fa")
def login_2fa(body: Login2FABody):
    """
    Verify 2FA OTP code sent to user email and return authenticated session.
    """
    norm_email = body.email.strip().lower()
    entry = _2fa_store.get(norm_email)

    if not entry:
        raise HTTPException(
            status_code=400,
            detail="No pending two-factor verification session found. Please enter your credentials again."
        )

    if time.time() > entry["expires_at"]:
        _2fa_store.pop(norm_email, None)
        raise HTTPException(
            status_code=400,
            detail="The verification code has expired. Please sign in again."
        )

    if entry["attempts"] >= 5:
        _2fa_store.pop(norm_email, None)
        raise HTTPException(
            status_code=429,
            detail="Too many invalid verification attempts. Please sign in again."
        )

    if entry["otp"] != body.otp.strip():
        entry["attempts"] += 1
        remaining = 5 - entry["attempts"]
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect 2FA verification code. {remaining} attempt(s) remaining."
        )

    user_id = entry["user_id"]
    _2fa_store.pop(norm_email, None)

    user = role_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    user_info = {
        "id": user["id"],
        "username": user["normalized_email"].split("@")[0],
        "name": user["name"],
        "email": user["normalized_email"],
        "role": user["role_key"],
        "role_label": user.get("role_name", user["role_key"]),
        "bureau_code": user.get("bureau_code") or "HQ",
        "bureau": user.get("bureau_name") or "National Portal",
        "region_code": user.get("region_code") or "HQ",
        "region": user.get("region_name") or "HQ (New Delhi)",
        "status": user["status"],
        "two_factor_enabled": True,
        "permissions": user.get("permissions", []),
    }

    token = auth.create_jwt(user_info)
    _token_store[token] = user_info

    return {
        "token": token,
        "user": user_info,
    }

@app.post("/api/auth/login/2fa/resend")
def resend_2fa(body: Resend2FABody):
    """
    Resend 2FA OTP code via Gmail API.
    """
    norm_email = body.email.strip().lower()
    entry = _2fa_store.get(norm_email)
    user = None
    if entry:
        user = role_service.get_user_by_id(entry["user_id"])
    else:
        user = role_service.get_user_by_email(norm_email)

    if not user:
        raise HTTPException(status_code=404, detail=f"No account found for {norm_email}.")

    otp = f"{secrets.randbelow(900000) + 100000}"
    expires_at = time.time() + 600
    _2fa_store[norm_email] = {
        "otp": otp,
        "expires_at": expires_at,
        "attempts": 0,
        "user_id": user["id"],
        "name": user.get("name", "User"),
    }

    try:
        gmail_mailer.send_otp_email(
            to_email=norm_email,
            otp_code=otp,
            name=user.get("name"),
            purpose="Two-Factor Authentication (2FA) Sign-In"
        )
    except Exception as e:
        print(f"[2FA Resend Error] {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to resend 2FA verification email: {str(e)}"
        )

    return {
        "ok": True,
        "message": f"A fresh verification code has been sent to {norm_email}."
    }

@app.post("/api/auth/2fa/toggle")
def toggle_2fa(body: Toggle2FABody, user: dict = Depends(_get_current_user)):
    """
    Enable or disable 2FA for the authenticated user.
    """
    user_id = user["id"]
    try:
        role_service.set_user_2fa(user_id, body.enabled)
        # Update user session store if present
        for tok, u in _token_store.items():
            if u.get("id") == user_id:
                u["two_factor_enabled"] = body.enabled
        return {
            "ok": True,
            "enabled": body.enabled,
            "message": f"Two-Factor Authentication is now {'enabled' if body.enabled else 'disabled'}."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════════════════════════════
# RBAC & USER GOVERNANCE ENDPOINTS
# ═══════════════════════════════════════════════════════════════
class AdminCreateUserBody(BaseModel):
    name: str
    email: str
    role: str
    bureau: Optional[str] = "HQ"
    region: Optional[str] = "HQ"
    password: Optional[str] = "password@123"

class AdminUpdateAssignmentBody(BaseModel):
    role: str
    bureau: Optional[str] = None
    region: Optional[str] = None
    email: Optional[str] = None

class AdminToggleStatusBody(BaseModel):
    status: str

@app.get("/api/admin/metadata")
def admin_get_metadata(user: dict = Depends(_get_current_user)):
    """Return bureaus and regions reference tables."""
    return {
        "bureaus": role_service.list_bureaus(),
        "regions": role_service.list_regions(),
    }

@app.get("/api/admin/users")
def admin_get_all_users(user: dict = Depends(_get_current_user)):
    if not role_service.has_permission(user, "users:manage"):
        raise HTTPException(status_code=403, detail="Super Admin privileges required")
    return role_service.list_all_users()

@app.post("/api/admin/users")
def admin_create_user_endpoint(body: AdminCreateUserBody, user: dict = Depends(_get_current_user)):
    if not role_service.has_permission(user, "users:manage"):
        raise HTTPException(status_code=403, detail="Super Admin privileges required")
    try:
        new_user = role_service.admin_create_user(
            name=body.name,
            email=body.email,
            role_key=body.role,
            bureau_code=body.bureau,
            region_code=body.region,
            password=body.password or "password@123",
            actor_id=user["id"]
        )
        return {"status": "ok", "user": new_user}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/api/admin/users/{user_id}/assignment")
def admin_update_assignment_endpoint(user_id: str, body: AdminUpdateAssignmentBody, user: dict = Depends(_get_current_user)):
    if not role_service.has_permission(user, "users:manage"):
        raise HTTPException(status_code=403, detail="Super Admin privileges required")
    try:
        updated = role_service.admin_update_assignment(
            target_user_id=user_id,
            role_key=body.role,
            bureau_code=body.bureau,
            region_code=body.region,
            actor_id=user["id"]
        )
        return {"status": "ok", "user": updated}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/api/admin/users/{user_id}/status")
def admin_toggle_status_endpoint(user_id: str, body: AdminToggleStatusBody, user: dict = Depends(_get_current_user)):
    if not role_service.has_permission(user, "users:manage"):
        raise HTTPException(status_code=403, detail="Super Admin privileges required")
    try:
        updated = role_service.admin_toggle_user_status(
            target_user_id=user_id,
            new_status=body.status,
            actor_id=user["id"]
        )
        return {"status": "ok", "user": updated}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/admin/users/{user_id}")
def admin_delete_user_endpoint(user_id: str, user: dict = Depends(_get_current_user)):
    if not role_service.has_permission(user, "users:manage"):
        raise HTTPException(status_code=403, detail="Super Admin privileges required")
    try:
        role_service.admin_delete_user(user_id, user["id"])
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/admin/users/role")
def legacy_admin_update_role_endpoint(body: AdminUpdateAssignmentBody, user: dict = Depends(_get_current_user)):
    if not role_service.has_permission(user, "users:manage"):
        raise HTTPException(status_code=403, detail="Super Admin privileges required")
    if body.email:
        target_user = role_service.get_user_by_email(body.email)
        if target_user:
            role_service.admin_update_assignment(target_user["id"], body.role, None, None, user["id"])
    return {"status": "ok"}

# ═══════════════════════════════════════════════════════════════
# CHAT SESSIONS
# ═══════════════════════════════════════════════════════════════
class CreateSessionBody(BaseModel):
    title: str

@app.get("/api/sessions")
def list_sessions(user: dict = Depends(_get_current_user)):
    sessions = db.list_sessions(
        user_id=user["username"],
        role=user["role"],
    )
    return [
        {
            "id": s["id"],
            "title": s.get("title", "Untitled"),
            "created_at": s.get("created_at", ""),
        }
        for s in sessions
    ]

@app.post("/api/sessions")
def create_session(body: CreateSessionBody, user: dict = Depends(_get_current_user)):
    sid = str(uuid.uuid4())
    db.create_session(
        session_id=sid,
        title=body.title[:80],
        role=user["role"],
        user_id=user["username"],
    )
    return {"id": sid, "title": body.title, "created_at": datetime.datetime.now().isoformat()}

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str, user: dict = Depends(_get_current_user)):
    db.delete_session(session_id)
    return {"ok": True}

# ═══════════════════════════════════════════════════════════════
# CHAT — MESSAGES + QUERY (Autonomous Loop)
# ═══════════════════════════════════════════════════════════════
@app.get("/api/chat/messages/{session_id}")
def get_messages(session_id: str, user: dict = Depends(_get_current_user)):
    msgs = db.get_messages(session_id)
    return [
        {
            "id": str(i),
            "session_id": session_id,
            "role": m["role"],
            "content": m["content"],
            "created_at": m.get("created_at", ""),
        }
        for i, m in enumerate(msgs)
    ]

class QueryBody(BaseModel):
    session_id: str
    query: str
    background: bool = False   # If True, process in background and return job_id

# ── In-flight background job store ───────────────────────────────
_bg_jobs: dict[str, dict] = {}   # job_id → {status, result, error}

def _run_query_job(job_id: str, session_id: str, query_text: str, role: str) -> None:
    """Background task: run the full autonomous loop and store result."""
    _bg_jobs[job_id] = {"status": "running", "result": None, "error": None}
    logs: list[str] = []
    try:
        key = os.getenv("GROQ_API_KEY", "")
        if not key:
            raise RuntimeError("GROQ_API_KEY not configured")
        client = Groq(api_key=key)
        model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        tavily = os.getenv("TAVILY_API_KEY", "")

        result = campus_run(
            session_id=session_id,
            query_text=query_text,
            role=role,
            client=client,
            model=model,
            tavily_api_key=tavily,
            on_log=lambda m: logs.append(m),
        )
        reply = result.get("chat_reply", "Request processed.")
        db.add_message(session_id, "assistant", reply)

        # Emit completion event
        if _EVENT_BUS_AVAILABLE:
            bus.emit(Events.REQUEST_COMPLETED, {
                "reply": reply,
                "workflow_type": result.get("workflow_type"),
                "request_id": result.get("request_id"),
            }, session_id=session_id, request_id=result.get("request_id", ""))

        _bg_jobs[job_id] = {
            "status": "done",
            "result": {
                "reply": reply,
                "workflow": {
                    "workflow_type": result.get("workflow_type"),
                    "policy": result.get("policy"),
                    "loop_results": result.get("loop_results"),
                    "request_id": result.get("request_id"),
                },
            },
            "error": None,
            "logs": logs[-20:],
        }
    except Exception as e:
        error_msg = f"⚠️ Backend error: {str(e)}"
        db.add_message(session_id, "assistant", error_msg)
        _bg_jobs[job_id] = {"status": "error", "result": None, "error": error_msg, "logs": logs[-20:]}


@app.post("/api/chat/query")
def chat_query(
    body: QueryBody,
    background_tasks: BackgroundTasks,
    user: dict = Depends(_get_current_user),
):
    """
    THE MAIN ENDPOINT — runs the full THINK→PLAN→EXECUTE→REVIEW→UPDATE loop.
    Pass background=true to immediately return a job_id and process async.
    Poll /api/chat/job/{job_id} for the result.
    """
    session_id = body.session_id
    query_text = body.query.strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    role = user["role"]

    # Persist user message
    db.add_message(session_id, "user", query_text)

    # Update session title if first message
    session = db.get_session(session_id)
    if session and session.get("title", "").lower() in ("new chat", "untitled", ""):
        db.rename_session(session_id, query_text[:40])

    # Emit request created event
    if _EVENT_BUS_AVAILABLE:
        bus.emit(Events.REQUEST_CREATED, {"query": query_text, "role": role}, session_id=session_id)

    # ── BACKGROUND MODE ──────────────────────────────────────────
    if body.background:
        job_id = str(uuid.uuid4())
        background_tasks.add_task(_run_query_job, job_id, session_id, query_text, role)
        return {"job_id": job_id, "status": "queued", "message": "Processing in background. Poll /api/chat/job/{job_id} for result."}

    # ── SYNCHRONOUS MODE (default) ───────────────────────────────
    logs_collected: list[str] = []

    def on_log(msg: str):
        logs_collected.append(msg)

    try:
        client = _make_groq()
        model = _default_model()
        tavily = _tavily_key()

        result = campus_run(
            session_id=session_id,
            query_text=query_text,
            role=role,
            client=client,
            model=model,
            tavily_api_key=tavily,
            on_log=on_log,
        )

        reply = result.get("chat_reply", "Request processed.")
        db.add_message(session_id, "assistant", reply)

        # Emit completion event
        if _EVENT_BUS_AVAILABLE:
            bus.emit(Events.REQUEST_COMPLETED, {
                "reply": reply,
                "workflow_type": result.get("workflow_type"),
                "request_id": result.get("request_id"),
            }, session_id=session_id, request_id=result.get("request_id", ""))

        return {
            "reply": reply,
            "workflow": {
                "workflow_type": result.get("workflow_type"),
                "policy": result.get("policy"),
                "loop_results": result.get("loop_results"),
                "request_id": result.get("request_id"),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"⚠️ Backend error: {str(e)}"
        db.add_message(session_id, "assistant", error_msg)
        return {"reply": error_msg, "workflow": None}


@app.get("/api/chat/job/{job_id}")
def get_job_result(job_id: str, user: dict = Depends(_get_current_user)):
    """Poll the result of a background chat job."""
    job = _bg_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

# ═══════════════════════════════════════════════════════════════
# LIVE CHAT (REALTIME DISPATCH & CITIZEN/OFFICER COMMUNICATOR)
# ═══════════════════════════════════════════════════════════════
class LiveChatMessageIn(BaseModel):
    text: str
    sender_name: Optional[str] = None
    sender_role: Optional[str] = None

@app.get("/api/live-chat/messages")
def get_live_chat_endpoint(limit: int = 200):
    """Retrieve all live chat messages ordered chronologically with timestamps."""
    return db.get_live_chat_messages(limit=limit)

@app.post("/api/live-chat/messages")
def send_live_chat_endpoint(body: LiveChatMessageIn, authorization: Optional[str] = Header(None)):
    """Save a live chat message with timestamp and return persisted payload."""
    sender_id = "user"
    sender_name = body.sender_name or "Officer"
    sender_role = body.sender_role or "officer"

    if authorization and authorization.startswith("Bearer "):
        try:
            curr_user = _get_current_user(authorization)
            sender_id = curr_user.get("id") or curr_user.get("username") or sender_id
            if not body.sender_name:
                sender_name = curr_user.get("name") or curr_user.get("username") or sender_name
            if not body.sender_role:
                sender_role = curr_user.get("role") or sender_role
        except Exception:
            pass

    msg = db.save_live_chat_message(
        sender_id=sender_id,
        sender_name=sender_name,
        sender_role=sender_role,
        text=body.text.strip(),
    )
    return msg

# ═══════════════════════════════════════════════════════════════
# WORKFLOW / LOGS
# ═══════════════════════════════════════════════════════════════
@app.get("/api/workflow/{session_id}")
def get_workflow(session_id: str, user: dict = Depends(_get_current_user)):
    reqs = db.get_session_requests(session_id)
    return reqs or {}

@app.get("/api/workflow/logs/{session_id}")
def get_workflow_logs(session_id: str, user: dict = Depends(_get_current_user)):
    raw_logs = db.get_logs(session_id)
    result = []
    for i, msg in enumerate(raw_logs):
        level = "INFO"
        step = "general"
        if "STEP_TOKEN:" in msg:
            parts = msg.split(":")
            step = parts[1] if len(parts) > 1 else "general"
            level = "STEP"
        elif "ERROR" in msg.upper():
            level = "ERROR"
        elif "WARN" in msg.upper():
            level = "WARN"
        result.append({
            "ts": datetime.datetime.now().isoformat(),
            "level": level,
            "step": step,
            "message": msg,
        })
    return result


# ═══════════════════════════════════════════════════════════════
# AGENT EXECUTION STEPS — AI Explanation Drawer
# ═══════════════════════════════════════════════════════════════
@app.get("/api/agent/steps/{session_id}")
def get_agent_steps(session_id: str, request_id: str = None, user: dict = Depends(_get_current_user)):
    """Return the AI reasoning trace steps for the Explanation Drawer."""
    raw_steps = db.get_agent_execution_steps(session_id, request_id)
    for step in raw_steps:
        for field in ("input_payload", "output_payload"):
            if isinstance(step.get(field), str):
                try:
                    import json as _json
                    step[field] = _json.loads(step[field])
                except Exception:
                    pass
    return raw_steps


# ═══════════════════════════════════════════════════════════════
# GLOBAL ACTIVITY FEED — Unified Timeline
# ═══════════════════════════════════════════════════════════════
@app.get("/api/activity/feed")
def get_activity_feed(
    session_id: str = None,
    limit: int = 50,
    user: dict = Depends(_get_current_user)
):
    """Return unified activity timeline: requests + approvals + AI decisions + system events."""
    conn = db.get_conn()
    cursor = conn.cursor()

    # Pull from audit table
    if session_id:
        cursor.execute(
            "SELECT * FROM audit WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
            (session_id, limit)
        )
    else:
        cursor.execute(
            "SELECT * FROM audit ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )
    audit_rows = cursor.fetchall()
    conn.close()

    feed = []
    for row in audit_rows:
        action = row["action"] if hasattr(row, '__getitem__') else str(row)
        result = row["result"] if hasattr(row, '__getitem__') else ""
        icon = (
            "✅" if "approved" in str(result).lower() else
            "❌" if "rejected" in str(result).lower() else
            "⚠️" if "escalated" in str(result).lower() else
            "🤖" if "submit" in str(action).lower() else
            "🔐" if "login" in str(action).lower() else "📋"
        )
        feed.append({
            "id": str(row["id"]) if hasattr(row, '__getitem__') else "",
            "session_id": row["session_id"] if hasattr(row, '__getitem__') else "",
            "actor_role": row["actor_role"] if hasattr(row, '__getitem__') else "",
            "action": action,
            "target": row["target"] if hasattr(row, '__getitem__') else "",
            "result": result,
            "created_at": row["created_at"] if hasattr(row, '__getitem__') else "",
            "icon": icon,
        })

    # Also include recent event bus events
    if _EVENT_BUS_AVAILABLE:
        recent_events = bus.get_recent_events(session_id=session_id, limit=20)
        for ev in recent_events:
            feed.append({
                "id": ev.get("id", ""),
                "session_id": ev.get("session_id", ""),
                "actor_role": "SYSTEM",
                "action": ev.get("event_type", ""),
                "target": ev.get("request_id", ""),
                "result": str(ev.get("payload", {}).get("result", "")),
                "created_at": ev.get("timestamp", ""),
                "icon": "⚡",
                "source": "event_bus",
            })

    # Sort by created_at descending
    feed.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return feed[:limit]


# ═══════════════════════════════════════════════════════════════
# STUDENT INTELLIGENCE PROFILE
# ═══════════════════════════════════════════════════════════════
@app.get("/api/student/{student_id}/profile")
def get_student_profile(student_id: str, user: dict = Depends(_get_current_user)):
    """Return a student/complainant profile."""
    return {
        "student_id": student_id,
        "attendance_pct": 85.0,
        "attendance_status": "sufficient",
        "risk_level": "LOW",
        "od_requests_last_10": 0,
        "recent_history": [],
        "alerts": [],
    }


# ═══════════════════════════════════════════════════════════════
# EVENT BUS STATS (Admin only)
# ═══════════════════════════════════════════════════════════════
@app.get("/api/admin/event-bus")
def get_event_bus_stats(user: dict = Depends(_get_current_user)):
    """Return event bus health statistics (admin only)."""
    if user.get("role") not in ("super_admin",):
        raise HTTPException(status_code=403, detail="Super Admin privileges required")
    if not _EVENT_BUS_AVAILABLE:
        return {"available": False}
    return {"available": True, **bus.get_stats()}


# ═══════════════════════════════════════════════════════════════
# REQUEST STATE HISTORY
# ═══════════════════════════════════════════════════════════════
@app.get("/api/requests/{request_id}/state")
def get_request_state(request_id: str, user: dict = Depends(_get_current_user)):
    """Return a request's current state and full audit trail."""
    req = db.get_request(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Get audit history for this request
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT * FROM audit WHERE target LIKE ? ORDER BY created_at ASC",
        (f"%{request_id}%",)
    ).fetchall()
    conn.close()

    return {
        "request": req,
        "current_state": req.get("status", "UNKNOWN"),
        "state_history": [dict(r) for r in rows],
    }

# ═══════════════════════════════════════════════════════════════
# KPI DASHBOARD
# ═══════════════════════════════════════════════════════════════
@app.get("/api/kpi/dashboard")
def kpi_dashboard(user: dict = Depends(_get_current_user)):
    raw = db.get_kpi_summary()
    if not raw:
        return {
            "total_requests": 0,
            "approved": 0,
            "pending": 0,
            "rejected": 0,
            "avg_response_seconds": 0,
            "active_users": len(_token_store),
        }
    return {
        "total_requests": raw.get("total_requests", 0),
        "approved": raw.get("resolved", 0),
        "pending": raw.get("total_requests", 0) - raw.get("resolved", 0),
        "rejected": 0,
        "avg_response_seconds": round(raw.get("avg_resolution_mins", 0) * 60, 1),
        "active_users": len(_token_store),
        "by_workflow": raw.get("by_workflow", {}),
        "resolution_rate_pct": raw.get("resolution_rate_pct", 0),
    }

# ═══════════════════════════════════════════════════════════════
# PDF EXPORT
# ═══════════════════════════════════════════════════════════════
@app.get("/api/export/pdf/{session_id}")
def export_pdf(session_id: str, user: dict = Depends(_get_current_user)):
    try:
        pdf_bytes = pdf_exporter.generate_chat_pdf(
            session_id,
            user.get("name", user.get("username", "User")),
            user["role"],
        )
        if not pdf_bytes:
            raise HTTPException(status_code=404, detail="No messages to export")
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=chat_{session_id[:8]}.pdf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# PS26264 — AICTE COMPLAINT MONITORING DASHBOARD APIs
# ═══════════════════════════════════════════════════════════════

# ── KPI Summary ─────────────────────────────────────────────────
@app.get("/api/aicte/kpi")
def aicte_kpi(user: dict = Depends(_get_current_user)):
    """Executive KPI tiles for the AICTE Complaint Dashboard."""
    try:
        return db.get_case_kpis()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Cases List (with filtering) ─────────────────────────────────
@app.get("/api/aicte/cases")
def list_cases(
    bureau: Optional[str] = None,
    status: Optional[str] = None,
    aicte_pid: Optional[str] = None,
    region: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 200,
    user: dict = Depends(_get_current_user),
):
    """List AICTE complaint cases with authoritative bureau/regional RBAC scope filtering."""
    try:
        # ── Authoritative RBAC Scope Enforcement ──
        user_role = user.get("role")
        user_bureau = (user.get("bureau_code") or "").upper()
        user_region = (user.get("region_code") or "").upper()

        effective_bureau = bureau
        effective_region = region

        if user_role == "super_admin":
            # Super Admin has unrestricted national scope
            pass
        elif user_role in ("bureau_head", "approval_officer"):
            # Officers and Bureau Heads are scoped strictly to their assigned bureau
            if user_bureau and user_bureau != "HQ":
                effective_bureau = user_bureau
        elif user_role == "nodal_officer":
            # Nodal officers are scoped strictly to their assigned geographic region
            if user_region and user_region != "HQ":
                effective_region = user_region

        cases = db.list_aicte_cases(
            bureau=effective_bureau, status=status, aicte_pid=aicte_pid,
            region=effective_region, category=category, limit=limit,
        )
        # Annotate ageing_days
        now = datetime.datetime.now()
        for c in cases:
            created = c.get("created_at", "")
            try:
                delta = now - datetime.datetime.fromisoformat(created)
                c["ageing_days"] = delta.days
            except Exception:
                c["ageing_days"] = 0
            # SLA status
            sla_dl = c.get("sla_deadline", "")
            if sla_dl and c.get("status") not in ("disposed",):
                try:
                    c["sla_breached"] = now > datetime.datetime.fromisoformat(sla_dl)
                except Exception:
                    c["sla_breached"] = False
            else:
                c["sla_breached"] = False
        return cases
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Export Cases to PDF ─────────────────────────────────────────
class CasesExportPayload(BaseModel):
    cases: Optional[List[dict]] = None
    bureau: Optional[str] = "ALL"
    status: Optional[str] = "ALL"
    region: Optional[str] = "ALL"
    search: Optional[str] = ""

@app.post("/api/aicte/cases/export/pdf")
def export_cases_pdf_post(
    payload: CasesExportPayload,
    user: dict = Depends(_get_current_user),
):
    """Generate and return a downloadable official AICTE Cases Registry PDF report."""
    try:
        cases = payload.cases
        if cases is None:
            user_role = user.get("role")
            user_bureau = (user.get("bureau_code") or "").upper()
            user_region = (user.get("region_code") or "").upper()

            effective_bureau = payload.bureau if payload.bureau and payload.bureau != "ALL" else None
            effective_region = payload.region if payload.region and payload.region != "ALL" else None
            effective_status = payload.status if payload.status and payload.status != "ALL" else None

            if user_role == "super_admin":
                pass
            elif user_role in ("bureau_head", "approval_officer"):
                if user_bureau and user_bureau != "HQ":
                    effective_bureau = user_bureau
            elif user_role == "nodal_officer":
                if user_region and user_region != "HQ":
                    effective_region = user_region

            cases = db.list_aicte_cases(
                bureau=effective_bureau,
                status=effective_status,
                region=effective_region,
                limit=500,
            )

        # Annotate ageing and SLA
        now = datetime.datetime.now()
        for c in cases:
            if "ageing_days" not in c or c.get("ageing_days") is None:
                created = c.get("created_at", "")
                try:
                    delta = now - datetime.datetime.fromisoformat(created)
                    c["ageing_days"] = delta.days
                except Exception:
                    c["ageing_days"] = 0
            if "sla_breached" not in c:
                sla_dl = c.get("sla_deadline", "")
                if sla_dl and c.get("status") not in ("disposed",):
                    try:
                        c["sla_breached"] = now > datetime.datetime.fromisoformat(sla_dl)
                    except Exception:
                        c["sla_breached"] = False
                else:
                    c["sla_breached"] = False

        pdf_bytes = pdf_exporter.generate_cases_pdf(
            cases=cases,
            user_name=user.get("name") or user.get("username", "Officer"),
            user_role=user.get("role", "super_admin"),
            user_bureau=user.get("bureau", "National Portal"),
            user_region=user.get("region", "HQ (New Delhi)"),
            filters={
                "bureau": payload.bureau or "ALL",
                "region": payload.region or "ALL",
                "status": payload.status or "ALL",
                "search": payload.search or "",
            }
        )

        filename = f"AICTE_Cases_Report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Expose-Headers": "Content-Disposition",
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/aicte/cases/export/pdf")
def export_cases_pdf_get(
    bureau: Optional[str] = "ALL",
    status: Optional[str] = "ALL",
    region: Optional[str] = "ALL",
    search: Optional[str] = "",
    user: dict = Depends(_get_current_user),
):
    """GET endpoint for direct browser download of AICTE cases PDF."""
    payload = CasesExportPayload(bureau=bureau, status=status, region=region, search=search)
    return export_cases_pdf_post(payload=payload, user=user)


# ── Single Case Detail ────────────────────────────────────────────
@app.get("/api/aicte/cases/{case_id}")
def get_case(case_id: str, user: dict = Depends(_get_current_user)):
    """Get full details of an AICTE case with authoritative scope checks."""
    case = db.get_aicte_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Authoritative bureau / regional jurisdiction check
    if not role_service.has_permission(user, "cases:view", bureau=case.get("bureau"), region=case.get("region")):
        raise HTTPException(status_code=403, detail="Access denied: Case is outside your assigned bureau or regional jurisdiction")

    # Enrich linked cases
    try:
        import json as _json
        linked = _json.loads(case.get("linked_case_ids") or "[]")
        case["linked_cases"] = [db.get_aicte_case(cid) for cid in linked if cid]
    except Exception:
        case["linked_cases"] = []
    return case


# ── Create New Case ──────────────────────────────────────────────
class CreateCaseBody(BaseModel):
    aicte_pid: str
    institution_name: str
    region: str
    bureau: str
    complainant_type: str = "Public"
    category: str
    title: str
    description: str = ""
    assigned_officer: str = ""
    sla_days: int = 30

@app.post("/api/aicte/cases")
def create_case(body: CreateCaseBody, user: dict = Depends(_get_current_user)):
    """File a new AICTE complaint case."""
    import uuid as _uuid
    # Generate structured case ID
    bureau_abbr = body.bureau.upper()
    year = datetime.datetime.now().year
    rand = str(_uuid.uuid4())[:4].upper()
    case_id = f"AICTE-{year}-{bureau_abbr}-{rand}"
    try:
        db.create_aicte_case(
            case_id=case_id,
            aicte_pid=body.aicte_pid,
            institution_name=body.institution_name,
            region=body.region,
            bureau=body.bureau,
            complainant_type=body.complainant_type,
            category=body.category,
            title=body.title,
            description=body.description,
            assigned_officer=body.assigned_officer,
            sla_days=body.sla_days,
        )
        # Log in audit
        db.add_audit(
            session_id="system",
            actor_role=user.get("role", "super_admin"),
            action="CASE_FILED",
            target=case_id,
            result=f"New {body.bureau} case filed for {body.institution_name}",
        )
        return {"ok": True, "case_id": case_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Update Case Status ────────────────────────────────────────────
class UpdateCaseBody(BaseModel):
    status: str
    assigned_officer: Optional[str] = None
    linked_case_ids: Optional[list] = None

@app.patch("/api/aicte/cases/{case_id}")
def update_case(case_id: str, body: UpdateCaseBody, user: dict = Depends(_get_current_user)):
    """Update status of an AICTE case (for transfer/escalation/disposal)."""
    case = db.get_aicte_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Authoritative permission and jurisdiction check
    if not role_service.has_permission(user, "cases:process", bureau=case.get("bureau"), region=case.get("region")):
        raise HTTPException(status_code=403, detail="Access denied: Cannot modify cases outside your authorized bureau or region")

    try:
        db.update_aicte_case_status(
            case_id=case_id,
            status=body.status,
            assigned_officer=body.assigned_officer,
            linked_case_ids=body.linked_case_ids,
        )
        db.add_audit(
            session_id="system",
            actor_role=user.get("role", "super_admin"),
            action="CASE_STATUS_UPDATE",
            target=case_id,
            result=f"Status changed to {body.status}",
        )
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Cross-Bureau Overlap Detection ────────────────────────────────
@app.get("/api/aicte/cases/overlaps")
def get_overlaps(user: dict = Depends(_get_current_user)):
    """
    PS26264 KEY ENDPOINT: Identify institutions with concurrent active cases
    in BOTH the Regulation Bureau (RB) and PGRC.
    Returns overlap analysis with AI-generated rationale per institution.
    """
    try:
        overlap_institutions = db.get_overlap_cases()
        results = []
        for inst in overlap_institutions:
            aicte_pid = inst.get("aicte_pid")
            all_cases = db.get_cases_by_institution(aicte_pid)
            rb_cases = [c for c in all_cases if c.get("bureau") == "RB" and c.get("status") != "disposed"]
            pgrc_cases = [c for c in all_cases if c.get("bureau") == "PGRC" and c.get("status") != "disposed"]

            overlap_analyses = []
            if _OVERLAP_AGENT_AVAILABLE:
                try:
                    groq_key = os.getenv("GROQ_API_KEY", "")
                    client = Groq(api_key=groq_key) if groq_key else None
                    agent = OverlapAgent(client=client, model=_default_model())
                    overlap_analyses = agent.batch_scan_institution(all_cases)
                except Exception:
                    pass

            # Fallback: rule-based if no LLM
            if not overlap_analyses and _OVERLAP_AGENT_AVAILABLE:
                try:
                    agent = OverlapAgent(client=None)
                    overlap_analyses = agent.batch_scan_institution(all_cases)
                except Exception:
                    pass

            results.append({
                "aicte_pid": aicte_pid,
                "institution_name": inst.get("institution_name"),
                "region": inst.get("region"),
                "rb_case_count": len(rb_cases),
                "pgrc_case_count": len(pgrc_cases),
                "rb_cases": rb_cases,
                "pgrc_cases": pgrc_cases,
                "overlap_analyses": overlap_analyses,
                "requires_coordination": len(overlap_analyses) > 0,
            })

        return {"overlap_count": len(results), "institutions": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── SLA Breach Alert ─────────────────────────────────────────────
@app.get("/api/aicte/cases/sla-breached")
def get_sla_breached(user: dict = Depends(_get_current_user)):
    """Return all cases that have exceeded their SLA deadline."""
    try:
        breached = db.get_sla_breached_cases()
        now = datetime.datetime.now()
        for c in breached:
            sla_dl = c.get("sla_deadline", "")
            try:
                c["days_overdue"] = (now - datetime.datetime.fromisoformat(sla_dl)).days
            except Exception:
                c["days_overdue"] = 0
        return {"total_breached": len(breached), "cases": breached}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Institution Registry ─────────────────────────────────────────
@app.get("/api/aicte/institutions")
def list_institutions(user: dict = Depends(_get_current_user)):
    """Return all AICTE-registered institutions in the registry."""
    try:
        institutions = db.get_all_institutions()
        # Enrich with case counts
        for inst in institutions:
            cases = db.get_cases_by_institution(inst["aicte_pid"])
            inst["total_cases"] = len(cases)
            inst["active_cases"] = len([c for c in cases if c.get("status") != "disposed"])
            inst["has_overlap"] = (
                any(c.get("bureau") == "RB" for c in cases if c.get("status") != "disposed") and
                any(c.get("bureau") == "PGRC" for c in cases if c.get("status") != "disposed")
            )
        return institutions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/aicte/institutions/{aicte_pid}")
def get_institution_profile(aicte_pid: str, user: dict = Depends(_get_current_user)):
    """
    360° Institution Profile: institution details + all RB/PGRC/RO cases
    + overlap analysis for the Consolidated Institution Profile Card.
    """
    inst = db.get_institution(aicte_pid)
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")
    cases = db.get_cases_by_institution(aicte_pid)
    rb_cases = [c for c in cases if c.get("bureau") == "RB"]
    pgrc_cases = [c for c in cases if c.get("bureau") == "PGRC"]
    ro_cases = [c for c in cases if c.get("bureau") == "RO"]

    overlap_analyses = []
    if _OVERLAP_AGENT_AVAILABLE:
        try:
            agent = OverlapAgent(client=None)
            overlap_analyses = agent.batch_scan_institution(cases)
        except Exception:
            pass

    return {
        **inst,
        "cases": {
            "all": cases,
            "rb": rb_cases,
            "pgrc": pgrc_cases,
            "ro": ro_cases,
        },
        "overlap_analyses": overlap_analyses,
        "summary": {
            "total_cases": len(cases),
            "active_cases": len([c for c in cases if c.get("status") != "disposed"]),
            "disposed_cases": len([c for c in cases if c.get("status") == "disposed"]),
            "has_cross_bureau_overlap": len(overlap_analyses) > 0,
        },
    }


# ── AI Overlap Analysis for Two Specific Cases ───────────────────
class AnalyzePairBody(BaseModel):
    case_id_a: str
    case_id_b: str

@app.post("/api/aicte/analyze-overlap")
def analyze_overlap_pair(body: AnalyzePairBody, user: dict = Depends(_get_current_user)):
    """Run AI semantic overlap analysis between two specific cases."""
    case_a = db.get_aicte_case(body.case_id_a)
    case_b = db.get_aicte_case(body.case_id_b)
    if not case_a or not case_b:
        raise HTTPException(status_code=404, detail="One or both cases not found")
    if not _OVERLAP_AGENT_AVAILABLE:
        raise HTTPException(status_code=503, detail="Overlap agent not available")
    try:
        groq_key = os.getenv("GROQ_API_KEY", "")
        client = Groq(api_key=groq_key) if groq_key else None
        agent = OverlapAgent(client=client, model=_default_model())
        analysis = agent.analyze_overlap(case_a, case_b)
        # Save alert if significant
        if analysis.get("overlap_score", 0) >= 0.40:
            db.save_overlap_alert(
                aicte_pid=case_a.get("aicte_pid", ""),
                rb_case_id=body.case_id_a if case_a.get("bureau") == "RB" else body.case_id_b,
                pgrc_case_id=body.case_id_b if case_b.get("bureau") == "PGRC" else body.case_id_a,
                overlap_score=analysis.get("overlap_score", 0),
                overlap_type=analysis.get("overlap_type", "unknown"),
                shared_root_cause=analysis.get("shared_root_cause", ""),
                recommended_action=analysis.get("recommended_action", ""),
                reason=analysis.get("reason", ""),
            )
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_server:app", host="0.0.0.0", port=8000, reload=True)
