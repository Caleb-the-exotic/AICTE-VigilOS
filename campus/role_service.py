# ============================================================
# campus/role_service.py — Centralized Role & RBAC Service
# ============================================================
# Manages user accounts, canonical roles, bureau/regional scopes,
# permissions, and authentication resolution against SQLite.
# ============================================================

import sqlite3
import hashlib
import uuid
import datetime
import os
from typing import Optional, Tuple, List, Dict, Any
from campus.db import get_conn

SALT = "aicte_vigilos_salt"

def hash_password(password: str) -> str:
    """Return pbkdf2 hash for secure password storage."""
    h = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), SALT.encode("utf-8"), 100000).hex()
    return f"pbkdf2_sha256${SALT}${h}"

def verify_password(stored_hash: Optional[str], password: str) -> bool:
    """Verify password against pbkdf2 or legacy sha256 hash."""
    if not stored_hash or not password:
        return False
    if stored_hash.startswith("pbkdf2_sha256$"):
        parts = stored_hash.split("$")
        if len(parts) == 3:
            salt = parts[1]
            expected = parts[2]
            computed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
            return computed == expected
    # Legacy SHA-256 fallback
    return hashlib.sha256(password.encode("utf-8")).hexdigest() == stored_hash

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch full canonical user profile with active role and permissions by ID."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''
        SELECT 
            u.id, u.name, u.normalized_email, u.status, u.created_at, u.updated_at,
            r.key as role_key, r.display_name as role_name,
            b.code as bureau_code, b.name as bureau_name,
            reg.code as region_code, reg.name as region_name,
            ua.id as assignment_id
        FROM users u
        LEFT JOIN user_assignments ua ON u.id = ua.user_id AND ua.status = 'active'
        LEFT JOIN roles r ON ua.role_id = r.id
        LEFT JOIN bureaus b ON ua.bureau_id = b.id
        LEFT JOIN regions reg ON ua.region_id = reg.id
        WHERE u.id = ?
    ''', (user_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None

    user = dict(row)
    # Fetch permissions
    role_key = user.get("role_key")
    perms = []
    if role_key:
        cur.execute('''
            SELECT p.key 
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            JOIN roles r ON rp.role_id = r.id
            WHERE r.key = ?
        ''', (role_key,))
        perms = [p["key"] for p in cur.fetchall()]
    conn.close()

    user["permissions"] = perms
    return user

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Fetch user by normalized email."""
    if not email:
        return None
    norm_email = email.strip().lower()
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE normalized_email = ?", (norm_email,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return get_user_by_id(row["id"])

def get_user_by_auth_account(provider: str, provider_subject: str) -> Optional[Dict[str, Any]]:
    """Resolve canonical user from linked auth_account."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''
        SELECT user_id 
        FROM auth_accounts 
        WHERE provider = ? AND LOWER(provider_subject) = LOWER(?)
    ''', (provider, provider_subject.strip()))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return get_user_by_id(row["user_id"])

def link_auth_account(user_id: str, provider: str, provider_subject: str) -> bool:
    """Link authentication method to existing canonical user record."""
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.datetime.now().isoformat()
    try:
        cur.execute('''
            INSERT OR IGNORE INTO auth_accounts (id, user_id, provider, provider_subject, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (str(uuid.uuid4()), user_id, provider, provider_subject.strip().lower(), now))
        conn.commit()
        return True
    except Exception as e:
        print(f"[RBAC link_auth_account error] {e}")
        return False
    finally:
        conn.close()

def authenticate_credentials(identifier: str, password: str) -> Tuple[bool, Any]:
    """
    Authenticate user using email or username identifier and password.
    Returns (True, user_dict) or (False, error_message).
    """
    clean_id = identifier.strip().lower()
    conn = get_conn()
    cur = conn.cursor()

    # Search in auth_accounts or users
    cur.execute('''
        SELECT u.id, u.password_hash, u.status
        FROM users u
        LEFT JOIN auth_accounts a ON u.id = a.user_id
        WHERE u.normalized_email = ? OR (a.provider = 'credentials' AND LOWER(a.provider_subject) = ?)
        LIMIT 1
    ''', (clean_id, clean_id))
    row = cur.fetchone()
    conn.close()

    if not row:
        return False, "Invalid email/username or password"

    user_id = row["id"]
    stored_hash = row["password_hash"]
    status = row["status"]

    if status != "active":
        return False, f"Account is {status}. Please contact an administrator."

    if not verify_password(stored_hash, password):
        return False, "Invalid email/username or password"

    user = get_user_by_id(user_id)
    if not user:
        return False, "User record not found."
    if not user.get("role_key"):
        return False, "No active role assignment found for this account."

    return True, user

def authenticate_google(email: str, name: str, google_sub: Optional[str] = None) -> Tuple[bool, Any]:
    """
    Resolve Google authenticated user into a canonical SQLite user record.
    Returns (True, user_dict) or (False, error_message).
    """
    norm_email = email.strip().lower()

    # 1. Look up by auth_accounts
    user = get_user_by_auth_account("google", norm_email)
    if not user and google_sub:
        user = get_user_by_auth_account("google", google_sub)

    # 2. Look up by normalized email if not found in auth_accounts
    if not user:
        user = get_user_by_email(norm_email)
        if user:
            # Link Google provider to existing user
            link_auth_account(user["id"], "google", norm_email)
            if google_sub:
                link_auth_account(user["id"], "google", google_sub)

    # 3. If still not found, check if provisioned or register as citizen
    if not user:
        # Check if email belongs to an authorized domain or provision citizen
        conn = get_conn()
        cur = conn.cursor()
        now = datetime.datetime.now().isoformat()
        new_uid = f"usr_{norm_email.split('@')[0]}_{uuid.uuid4().hex[:6]}"

        # Look up citizen role
        cur.execute("SELECT id FROM roles WHERE key = 'citizen'")
        role_row = cur.fetchone()
        if not role_row:
            conn.close()
            return False, "Role system configuration error."

        citizen_role_id = role_row["id"]

        try:
            cur.execute('''
                INSERT INTO users (id, name, normalized_email, password_hash, status, created_at, updated_at)
                VALUES (?, ?, ?, NULL, 'active', ?, ?)
            ''', (new_uid, name.strip() or norm_email.split("@")[0].title(), norm_email, now, now))

            cur.execute('''
                INSERT INTO auth_accounts (id, user_id, provider, provider_subject, created_at)
                VALUES (?, ?, 'google', ?, ?)
            ''', (str(uuid.uuid4()), new_uid, norm_email, now))

            cur.execute('''
                INSERT INTO user_assignments (id, user_id, role_id, bureau_id, region_id, status, created_at, updated_at)
                VALUES (?, ?, ?, NULL, NULL, 'active', ?, ?)
            ''', (str(uuid.uuid4()), new_uid, citizen_role_id, now, now))

            conn.commit()
        except Exception as e:
            conn.rollback()
            conn.close()
            return False, f"Account provisioning error: {str(e)}"
        finally:
            conn.close()

        user = get_user_by_id(new_uid)

    if not user:
        return False, "Failed to resolve authenticated user profile."

    if user.get("status") != "active":
        return False, f"Account is {user.get('status')}. Access restricted."

    return True, user

def has_permission(user: Dict[str, Any], permission_key: str,
                   bureau: Optional[str] = None, region: Optional[str] = None) -> bool:
    """
    Authoritative permission & scope verification.
    - super_admin bypasses bureau/region scopes.
    - other roles must possess the permission and match resource bureau/region scopes.
    """
    if not user or user.get("status") != "active":
        return False

    role_key = user.get("role_key")
    if role_key == "super_admin":
        return True

    perms = user.get("permissions", [])
    if permission_key not in perms:
        return False

    # Bureau scope check
    user_bureau = (user.get("bureau_code") or "").upper()
    if bureau and user_bureau:
        # User is restricted to their assigned bureau
        if user_bureau not in ("HQ", "") and user_bureau != bureau.upper():
            return False

    # Regional scope check
    user_region = (user.get("region_code") or "").upper()
    if region and user_region:
        # User is restricted to their assigned region
        if user_region not in ("HQ", "") and user_region != region.upper():
            return False

    return True

def list_all_users() -> List[Dict[str, Any]]:
    """Return all users with active role, bureau, region, status, and permissions."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''
        SELECT 
            u.id, u.name, u.normalized_email as email, u.status, u.created_at, u.updated_at,
            COALESCE(r.key, 'citizen') as role,
            COALESCE(r.display_name, 'Citizen / Complainant') as role_label,
            COALESCE(b.code, 'HQ') as bureau_code,
            COALESCE(b.name, 'National Portal') as bureau,
            COALESCE(reg.code, 'HQ') as region_code,
            COALESCE(reg.name, 'HQ (New Delhi)') as region
        FROM users u
        LEFT JOIN user_assignments ua ON u.id = ua.user_id AND ua.status = 'active'
        LEFT JOIN roles r ON ua.role_id = r.id
        LEFT JOIN bureaus b ON ua.bureau_id = b.id
        LEFT JOIN regions reg ON ua.region_id = reg.id
        ORDER BY 
            CASE r.key 
                WHEN 'super_admin' THEN 1 
                WHEN 'bureau_head' THEN 2 
                WHEN 'approval_officer' THEN 3 
                WHEN 'nodal_officer' THEN 4 
                ELSE 5 
            END ASC,
            u.name ASC
    ''')
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def list_bureaus() -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, code, name, description FROM bureaus ORDER BY code ASC")
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def list_regions() -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, code, name FROM regions ORDER BY code ASC")
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def admin_create_user(name: str, email: str, role_key: str,
                      bureau_code: Optional[str], region_code: Optional[str],
                      password: str, actor_id: str) -> Dict[str, Any]:
    """Create a new authorized personnel record with credentials and assignment."""
    norm_email = email.strip().lower()
    clean_name = name.strip()
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    cur = conn.cursor()

    # Check email duplicate
    cur.execute("SELECT id FROM users WHERE normalized_email = ?", (norm_email,))
    if cur.fetchone():
        conn.close()
        raise ValueError("An account with this email address already exists.")

    # Look up role, bureau, region
    cur.execute("SELECT id FROM roles WHERE key = ?", (role_key,))
    role_row = cur.fetchone()
    if not role_row:
        conn.close()
        raise ValueError(f"Invalid role: {role_key}")
    role_id = role_row["id"]

    bureau_id = None
    if bureau_code:
        cur.execute("SELECT id FROM bureaus WHERE code = ?", (bureau_code.upper(),))
        brow = cur.fetchone()
        if brow: bureau_id = brow["id"]

    region_id = None
    if region_code:
        cur.execute("SELECT id FROM regions WHERE code = ?", (region_code.upper(),))
        rrow = cur.fetchone()
        if rrow: region_id = rrow["id"]

    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    pwd_hash = hash_password(password)

    try:
        cur.execute('''
            INSERT INTO users (id, name, normalized_email, password_hash, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'active', ?, ?)
        ''', (user_id, clean_name, norm_email, pwd_hash, now, now))

        cur.execute('''
            INSERT INTO auth_accounts (id, user_id, provider, provider_subject, created_at)
            VALUES (?, ?, 'credentials', ?, ?)
        ''', (str(uuid.uuid4()), user_id, norm_email, now))

        cur.execute('''
            INSERT INTO user_assignments (id, user_id, role_id, bureau_id, region_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
        ''', (str(uuid.uuid4()), user_id, role_id, bureau_id, region_id, now, now))

        cur.execute('''
            INSERT INTO assignment_audit (user_id, changed_by, new_role_key, new_bureau_code, new_region_code, action, created_at)
            VALUES (?, ?, ?, ?, ?, 'CREATE_USER', ?)
        ''', (user_id, actor_id, role_key, bureau_code, region_code, now))

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

    return get_user_by_id(user_id)

def admin_update_assignment(target_user_id: str, role_key: str,
                            bureau_code: Optional[str], region_code: Optional[str],
                            actor_id: str) -> Dict[str, Any]:
    """Change the active role, bureau, and region assignment for a user."""
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.datetime.now().isoformat()

    cur.execute("SELECT id, normalized_email, status FROM users WHERE id = ?", (target_user_id,))
    target_user = cur.fetchone()
    if not target_user:
        conn.close()
        raise ValueError("Target user not found.")

    # Look up new role
    cur.execute("SELECT id FROM roles WHERE key = ?", (role_key,))
    role_row = cur.fetchone()
    if not role_row:
        conn.close()
        raise ValueError(f"Invalid role: {role_key}")
    new_role_id = role_row["id"]

    new_bureau_id = None
    if bureau_code:
        cur.execute("SELECT id FROM bureaus WHERE code = ?", (bureau_code.upper(),))
        brow = cur.fetchone()
        if brow: new_bureau_id = brow["id"]

    new_region_id = None
    if region_code:
        cur.execute("SELECT id FROM regions WHERE code = ?", (region_code.upper(),))
        rrow = cur.fetchone()
        if rrow: new_region_id = rrow["id"]

    # Fetch current active assignment
    cur.execute('''
        SELECT ua.id, r.key as old_role_key, b.code as old_bureau_code, reg.code as old_region_code
        FROM user_assignments ua
        JOIN roles r ON ua.role_id = r.id
        LEFT JOIN bureaus b ON ua.bureau_id = b.id
        LEFT JOIN regions reg ON ua.region_id = reg.id
        WHERE ua.user_id = ? AND ua.status = 'active'
    ''', (target_user_id,))
    cur_asgn = cur.fetchone()

    # Safety check: prevent revoking the last super_admin
    if cur_asgn and cur_asgn["old_role_key"] == "super_admin" and role_key != "super_admin":
        cur.execute('''
            SELECT COUNT(*) as count 
            FROM user_assignments ua
            JOIN roles r ON ua.role_id = r.id
            WHERE r.key = 'super_admin' AND ua.status = 'active'
        ''')
        super_count = cur.fetchone()["count"]
        if super_count <= 1:
            conn.close()
            raise ValueError("Cannot demote the only remaining active Super Administrator.")

    try:
        if cur_asgn:
            cur.execute('''
                UPDATE user_assignments
                SET role_id = ?, bureau_id = ?, region_id = ?, updated_at = ?
                WHERE id = ?
            ''', (new_role_id, new_bureau_id, new_region_id, now, cur_asgn["id"]))
        else:
            cur.execute('''
                INSERT INTO user_assignments (id, user_id, role_id, bureau_id, region_id, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
            ''', (str(uuid.uuid4()), target_user_id, new_role_id, new_bureau_id, new_region_id, now, now))

        cur.execute('''
            INSERT INTO assignment_audit (user_id, changed_by, old_role_key, new_role_key,
                                          old_bureau_code, new_bureau_code, old_region_code, new_region_code,
                                          action, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UPDATE_ASSIGNMENT', ?)
        ''', (
            target_user_id, actor_id,
            cur_asgn["old_role_key"] if cur_asgn else None, role_key,
            cur_asgn["old_bureau_code"] if cur_asgn else None, bureau_code,
            cur_asgn["old_region_code"] if cur_asgn else None, region_code,
            now
        ))

        cur.execute("UPDATE users SET updated_at = ? WHERE id = ?", (now, target_user_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

    return get_user_by_id(target_user_id)

def admin_toggle_user_status(target_user_id: str, new_status: str, actor_id: str) -> Dict[str, Any]:
    """Activate or deactivate user account."""
    if new_status not in ("active", "inactive", "suspended"):
        raise ValueError("Invalid status. Allowed values: active, inactive, suspended")

    conn = get_conn()
    cur = conn.cursor()
    now = datetime.datetime.now().isoformat()

    cur.execute("SELECT id, normalized_email FROM users WHERE id = ?", (target_user_id,))
    target = cur.fetchone()
    if not target:
        conn.close()
        raise ValueError("Target user not found.")

    # Prevent deactivating self if super_admin
    if target_user_id == actor_id and new_status != "active":
        conn.close()
        raise ValueError("You cannot deactivate your own administrative account.")

    try:
        cur.execute("UPDATE users SET status = ?, updated_at = ? WHERE id = ?", (new_status, now, target_user_id))
        cur.execute('''
            INSERT INTO assignment_audit (user_id, changed_by, action, created_at)
            VALUES (?, ?, ?, ?)
        ''', (target_user_id, actor_id, f"STATUS_CHANGE_{new_status.upper()}", now))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

    return get_user_by_id(target_user_id)

def admin_delete_user(target_user_id: str, actor_id: str) -> bool:
    """Delete a user account and cascade delete assignments & auth methods."""
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.datetime.now().isoformat()

    cur.execute("SELECT id, normalized_email FROM users WHERE id = ?", (target_user_id,))
    target = cur.fetchone()
    if not target:
        conn.close()
        raise ValueError("Target user not found.")

    if target_user_id == actor_id:
        conn.close()
        raise ValueError("You cannot delete your own administrative account.")

    try:
        cur.execute("DELETE FROM users WHERE id = ?", (target_user_id,))
        cur.execute('''
            INSERT INTO assignment_audit (user_id, changed_by, action, created_at)
            VALUES (?, ?, 'DELETE_USER', ?)
        ''', (target_user_id, actor_id, now))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def register_user(name: str, email: str, password: str, role_key: str = "citizen") -> Dict[str, Any]:
    """Register a new user account with default non-privileged role (citizen)."""
    # Enforce safe non-privileged role for self-registration
    safe_role = "citizen"
    return admin_create_user(
        name=name,
        email=email,
        role_key=safe_role,
        bureau_code="HQ",
        region_code="HQ",
        password=password,
        actor_id="self_registration"
    )

