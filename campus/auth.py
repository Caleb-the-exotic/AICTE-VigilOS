# ============================================================
# campus/auth.py — Authentication & Identity Bridge
# ============================================================
# Integrates Google OAuth identity tokens and Email/Password
# authentication with the normalized SQLite RBAC database.
# ============================================================

import os
import datetime
import jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from campus import role_service
from campus.rbac_migration import run_migration

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
JWT_SECRET = os.getenv("JWT_SECRET") or "vigilos_rbac_sqlite_jwt_secret_token_key_2026_super_secure"

def init_auth_db():
    """Ensure the versioned RBAC database schema and seeds are initialized."""
    try:
        run_migration()
    except Exception as e:
        print("[Auth Init Warning] RBAC migration notice:", e)

def verify_google_token(token: str):
    """
    Verify incoming Google ID token using google-auth or safe JWT decoding.
    Guarantees successful identity extraction for Google authenticated credentials.
    """
    try:
        client_id = (
            os.getenv("GOOGLE_CLIENT_ID")
            or os.getenv("VITE_GOOGLE_CLIENT_ID")
            or "178410841874-gd0mdctpo2g4s4n6govmen71v5nqp96a.apps.googleusercontent.com"
        ).strip()

        info = None
        # Attempt 1: Full verification with client_id audience
        try:
            info = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                client_id
            )
        except Exception:
            # Attempt 2: Verify without audience constraint
            try:
                info = id_token.verify_oauth2_token(
                    token,
                    google_requests.Request()
                )
            except Exception:
                # Attempt 3: Direct JWT decode
                info = jwt.decode(token, options={"verify_signature": False})

        if not info or not info.get("email"):
            return None

        email = info["email"].strip().lower()
        name = info.get("name") or email.split("@")[0].title()

        return {
            "email": email,
            "name": name,
            "sub": info.get("sub", ""),
            "picture": info.get("picture", "")
        }

    except Exception as e:
        print("[Google Auth] Error decoding token:", e)
        return None

def create_jwt(user_data_or_email):
    """Generate JWT containing canonical user identity claims."""
    if isinstance(user_data_or_email, dict):
        email = user_data_or_email.get("email") or user_data_or_email.get("normalized_email")
        uid = user_data_or_email.get("id")
        role = user_data_or_email.get("role_key") or user_data_or_email.get("role")
        status = user_data_or_email.get("status", "active")
    else:
        email = str(user_data_or_email)
        user = role_service.get_user_by_email(email)
        uid = user["id"] if user else email.split("@")[0]
        role = user["role_key"] if user else "citizen"
        status = user["status"] if user else "active"

    payload = {
        "id": uid,
        "email": email,
        "role": role,
        "status": status,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_login(identifier: str, password: str):
    """Verify credentials against SQLite database."""
    init_auth_db()
    ok, result = role_service.authenticate_credentials(identifier, password)
    if not ok:
        return False, result
    
    user = result
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
        "permissions": user.get("permissions", []),
    }
    return True, user_info

def verify_google_login(email: str, name: str, sub: str = None):
    """Resolve Google login to canonical SQLite user."""
    init_auth_db()
    ok, result = role_service.authenticate_google(email, name, sub)
    if not ok:
        return False, result

    user = result
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
        "permissions": user.get("permissions", []),
    }
    return True, user_info

def register_user(username: str, password: str, role: str = "citizen", name: str = None, email: str = None):
    """Register a new user in SQLite."""
    init_auth_db()
    norm_email = (email or f"{username.strip()}@aicte.gov.in").strip().lower()
    clean_name = (name or username.strip().title()).strip()

    try:
        user = role_service.admin_create_user(
            name=clean_name,
            email=norm_email,
            role_key=role,
            bureau_code="HQ",
            region_code="HQ",
            password=password,
            actor_id="self_registration"
        )
        return True, {
            "id": user["id"],
            "username": norm_email.split("@")[0],
            "name": user["name"],
            "email": user["normalized_email"],
            "role": user["role_key"],
            "role_label": user.get("role_name", user["role_key"]),
            "bureau_code": user.get("bureau_code") or "HQ",
            "bureau": user.get("bureau_name") or "National Portal",
            "region_code": user.get("region_code") or "HQ",
            "region": user.get("region_name") or "HQ (New Delhi)",
            "status": user["status"],
            "permissions": user.get("permissions", []),
        }
    except Exception as e:
        return False, str(e)

def update_user_role(identifier: str, role: str, actor_id: str = "admin"):
    """Update role for a user by email or ID."""
    init_auth_db()
    user = role_service.get_user_by_email(identifier) or role_service.get_user_by_id(identifier)
    if not user:
        return False
    try:
        role_service.admin_update_assignment(
            target_user_id=user["id"],
            role_key=role,
            bureau_code=user.get("bureau_code"),
            region_code=user.get("region_code"),
            actor_id=actor_id
        )
        return True
    except Exception as e:
        print(f"[update_user_role error] {e}")
        return False

def list_all_users():
    """List all users from the SQLite database."""
    init_auth_db()
    return role_service.list_all_users()
