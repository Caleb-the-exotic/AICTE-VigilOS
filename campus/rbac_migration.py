# ============================================================
# campus/rbac_migration.py — Database-Driven RBAC Migration
# ============================================================
# Version: 20261025_02_rbac_schema
# Creates normalized RBAC, organization, and auth tables in SQLite.
# Migrates all hardcoded officers and existing users into SQLite.
# ============================================================

import os
import hashlib
import datetime
import json
import uuid
from campus.db import get_conn

MIGRATION_VERSION = "20261025_02_rbac_schema"
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "campusflow.db")

def _hash_password(password: str, salt: str = "aicte_vigilos_salt") -> str:
    """Return pbkdf2 hash for password."""
    h = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
    return f"pbkdf2_sha256${salt}${h}"

def _sha256_hash(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def run_migration(db_path: str = DB_PATH) -> dict:
    """
    Run versioned transactional migration on authoritative database.
    Idempotent and safe to rerun.
    """
    conn = get_conn()
    cur = conn.cursor()

    # 1. Check if already executed
    cur.execute('''
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(100) PRIMARY KEY,
            applied_at VARCHAR(100) NOT NULL,
            details TEXT
        )
    ''')
    cur.execute("SELECT version FROM schema_migrations WHERE version = ?", (MIGRATION_VERSION,))
    if cur.fetchone():
        conn.close()
        return {"status": "skipped", "message": f"Migration {MIGRATION_VERSION} already applied."}

    now = datetime.datetime.now().isoformat()

    try:

        # ── 2. Create Bureaus & Regions ──────────────────────────────
        cur.execute('''
            CREATE TABLE IF NOT EXISTS bureaus (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL
            );
        ''')

        cur.execute('''
            CREATE TABLE IF NOT EXISTS regions (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        ''')

        # Seed Bureaus
        bureaus_seed = [
            ("bur_hq", "HQ", "Central Vigilance HQ", "Central Vigilance & Oversight Directorate", now),
            ("bur_rb", "RB", "Regulation Bureau", "Regulatory compliance, intake approvals, and affiliation oversight", now),
            ("bur_pgrc", "PGRC", "Public Grievance Redressal Cell", "Faculty, student, and institutional grievance investigations", now),
            ("bur_ro", "RO", "Regional Office Cell", "Decentralized regional office coordination", now),
            ("bur_liaison", "LIAISON", "State Liaison", "State governmental and inter-agency field liaison", now),
        ]
        for b in bureaus_seed:
            cur.execute('''
                INSERT INTO bureaus (id, code, name, description, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(code) DO UPDATE SET name=excluded.name, description=excluded.description
            ''', b)

        # Seed Regions
        regions_seed = [
            ("reg_hq", "HQ", "HQ (New Delhi)", now),
            ("reg_north", "NORTHERN", "Northern Region", now),
            ("reg_south", "SOUTHERN", "Southern Region", now),
            ("reg_west", "WESTERN", "Western Region", now),
            ("reg_east", "EASTERN", "Eastern Region", now),
            ("reg_central", "CENTRAL", "Central Region", now),
        ]
        for r in regions_seed:
            cur.execute('''
                INSERT INTO regions (id, code, name, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(code) DO UPDATE SET name=excluded.name
            ''', r)

        # ── 3. Create Roles, Permissions & Role-Permissions ─────────
        cur.execute('''
            CREATE TABLE IF NOT EXISTS roles (
                id TEXT PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                description TEXT
            );
        ''')

        cur.execute('''
            CREATE TABLE IF NOT EXISTS permissions (
                id TEXT PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                description TEXT
            );
        ''')

        cur.execute('''
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
                PRIMARY KEY (role_id, permission_id)
            );
        ''')

        # Seed Roles
        roles_seed = [
            ("role_super_admin", "super_admin", "Super Admin", "Central Vigilance & Platform Authority"),
            ("role_bureau_head", "bureau_head", "Bureau Head", "RB / PGRC / Regional Bureau Chief"),
            ("role_approval_officer", "approval_officer", "Approval Officer", "Grievance Case Handler & Investigator"),
            ("role_nodal_officer", "nodal_officer", "Regional Nodal Officer", "State & Regional Institutional Liaison"),
            ("role_citizen", "citizen", "Citizen / Complainant", "Public Complainant & Grievance Submitter"),
        ]
        for r in roles_seed:
            cur.execute('''
                INSERT INTO roles (id, key, display_name, description)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET display_name=excluded.display_name, description=excluded.description
            ''', r)

        # Seed Permissions
        permissions_seed = [
            ("perm_users_manage", "users:manage", "Manage users, active status, and role assignments"),
            ("perm_cases_view", "cases:view", "View complaint cases within authorized scope"),
            ("perm_cases_assign", "cases:assign", "Assign or transfer complaint cases"),
            ("perm_cases_process", "cases:process", "Investigate, update status, and process complaint cases"),
            ("perm_cases_approve", "cases:approve", "Approve case closures, escalations, and joint bureau hearings"),
            ("perm_reports_view", "reports:view", "View bureau and regional analytics, SLAs, and KPI reports"),
            ("perm_org_manage", "org:manage", "Configure bureaus, regions, and institution registries"),
            ("perm_audit_view", "audit:view", "View system-wide audit logs and event bus telemetry"),
            ("perm_chat_use", "chat:use", "Interact with AI assistant and submit grievances"),
        ]
        for p in permissions_seed:
            cur.execute('''
                INSERT INTO permissions (id, key, description)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET description=excluded.description
            ''', p)

        # Map Role -> Permissions
        role_map_perms = {
            "role_super_admin": [
                "perm_users_manage", "perm_cases_view", "perm_cases_assign",
                "perm_cases_process", "perm_cases_approve", "perm_reports_view",
                "perm_org_manage", "perm_audit_view", "perm_chat_use"
            ],
            "role_bureau_head": [
                "perm_cases_view", "perm_cases_assign", "perm_cases_process",
                "perm_cases_approve", "perm_reports_view", "perm_audit_view", "perm_chat_use"
            ],
            "role_approval_officer": [
                "perm_cases_view", "perm_cases_process", "perm_reports_view", "perm_chat_use"
            ],
            "role_nodal_officer": [
                "perm_cases_view", "perm_cases_process", "perm_reports_view", "perm_chat_use"
            ],
            "role_citizen": [
                "perm_cases_view", "perm_chat_use"
            ]
        }
        for role_id, perm_ids in role_map_perms.items():
            for pid in perm_ids:
                cur.execute('''
                    INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
                    VALUES (?, ?)
                ''', (role_id, pid))

        # ── 4. Create Users, Auth Accounts, User Assignments ────────
        # Backup existing legacy users if table exists
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        has_existing_users = cur.fetchone() is not None

        legacy_user_rows = []
        if has_existing_users:
            cur.execute("PRAGMA table_info(users)")
            cols = [col["name"] for col in cur.fetchall()]
            if "normalized_email" not in cols:
                # Need to migrate legacy users table to new schema
                cur.execute("SELECT * FROM users")
                legacy_user_rows = [dict(r) for r in cur.fetchall()]
                cur.execute("ALTER TABLE users RENAME TO legacy_users_backup")

        # Create new normalized users table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                normalized_email TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        ''')
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_normalized_email ON users(normalized_email);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);")

        # Create auth_accounts
        cur.execute('''
            CREATE TABLE IF NOT EXISTS auth_accounts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                provider TEXT NOT NULL,
                provider_subject TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(provider, provider_subject)
            );
        ''')
        cur.execute("CREATE INDEX IF NOT EXISTS idx_auth_accounts_user ON auth_accounts(user_id);")

        # Create user_assignments
        cur.execute('''
            CREATE TABLE IF NOT EXISTS user_assignments (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
                bureau_id TEXT REFERENCES bureaus(id) ON DELETE SET NULL,
                region_id TEXT REFERENCES regions(id) ON DELETE SET NULL,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        ''')
        cur.execute("CREATE INDEX IF NOT EXISTS idx_user_assignments_user ON user_assignments(user_id);")
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_active_assignment ON user_assignments(user_id) WHERE status = 'active';")

        # Create assignment_audit table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS assignment_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                changed_by TEXT NOT NULL,
                old_role_key TEXT,
                new_role_key TEXT,
                old_bureau_code TEXT,
                new_bureau_code TEXT,
                old_region_code TEXT,
                new_region_code TEXT,
                action TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        ''')

        # ── 5. Migrate Hardcoded Personnel & Legacy Users ───────────
        cur.execute("SELECT id, key FROM roles")
        role_lookup = {r["key"]: r["id"] for r in cur.fetchall()}

        cur.execute("SELECT id, code FROM bureaus")
        bureau_lookup = {b["code"]: b["id"] for b in cur.fetchall()}

        cur.execute("SELECT id, code FROM regions")
        region_lookup = {r["code"]: r["id"] for r in cur.fetchall()}

        canonical_officers = [
            {
                "id": "usr_caleb",
                "name": "Caleb",
                "email": "2204caleb2007@gmail.com",
                "role_key": "super_admin",
                "bureau_code": "HQ",
                "region_code": "HQ",
                "password": "password@123",
                "usernames": ["2204caleb2007", "caleb"],
            },
            {
                "id": "usr_admin",
                "name": "System Administrator",
                "email": "admin@aicte-india.org",
                "role_key": "super_admin",
                "bureau_code": "HQ",
                "region_code": "HQ",
                "password": "12345678",
                "usernames": ["admin", "sysadmin"],
            },
            {
                "id": "usr_bureau_head_demo",
                "name": "Bureau Head (Demo)",
                "email": "admin@aicte.gov.in",
                "role_key": "bureau_head",
                "bureau_code": "RB",
                "region_code": "CENTRAL",
                "password": "admin",
                "usernames": ["bureau_head_demo"],
            },
            {
                "id": "usr_officer_demo",
                "name": "Approval Officer (Demo)",
                "email": "officer@aicte.gov.in",
                "role_key": "approval_officer",
                "bureau_code": "PGRC",
                "region_code": "CENTRAL",
                "password": "demo1234",
                "usernames": ["officer_demo"],
            },
            {
                "id": "usr_hariprasath",
                "name": "Hariprasath",
                "email": "hariprasath134208@gmail.com",
                "role_key": "approval_officer",
                "bureau_code": "RB",
                "region_code": "SOUTHERN",
                "password": "password@123",
                "usernames": ["hariprasath134208"],
            },
            {
                "id": "usr_monisha",
                "name": "Monisha Yathavan",
                "email": "monishayathavan@gmail.com",
                "role_key": "approval_officer",
                "bureau_code": "PGRC",
                "region_code": "SOUTHERN",
                "password": "password@123",
                "usernames": ["monishayathavan"],
            },
            {
                "id": "usr_swetha",
                "name": "Swetha NC",
                "email": "swethanc21@gmail.com",
                "role_key": "approval_officer",
                "bureau_code": "RB",
                "region_code": "SOUTHERN",
                "password": "password@123",
                "usernames": ["swethanc21"],
            },
            {
                "id": "usr_deepan",
                "name": "Deepan Thangavel",
                "email": "deepanthangavel0611@gmail.com",
                "role_key": "nodal_officer",
                "bureau_code": "LIAISON",
                "region_code": "SOUTHERN",
                "password": "password@123",
                "usernames": ["deepanthangavel0611"],
            },
            {
                "id": "usr_suryaprakash",
                "name": "Surya Prakash D",
                "email": "suryaprakashd22007@gmail.com",
                "role_key": "approval_officer",
                "bureau_code": "PGRC",
                "region_code": "SOUTHERN",
                "password": "password@123",
                "usernames": ["suryaprakashd22007"],
            },
        ]

        imported_count = 0
        for off in canonical_officers:
            uid = off["id"]
            name = off["name"]
            norm_email = off["email"].strip().lower()
            pwd_hash = _hash_password(off["password"])
            role_id = role_lookup.get(off["role_key"])
            bureau_id = bureau_lookup.get(off["bureau_code"])
            region_id = region_lookup.get(off["region_code"])

            cur.execute('''
                INSERT INTO users (id, name, normalized_email, password_hash, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'active', ?, ?)
                ON CONFLICT(normalized_email) DO UPDATE SET
                    name=excluded.name,
                    password_hash=excluded.password_hash,
                    updated_at=excluded.updated_at
            ''', (uid, name, norm_email, pwd_hash, now, now))

            cur.execute("SELECT id FROM users WHERE normalized_email = ?", (norm_email,))
            actual_uid = cur.fetchone()["id"]

            cur.execute('''
                INSERT OR IGNORE INTO auth_accounts (id, user_id, provider, provider_subject, created_at)
                VALUES (?, ?, 'credentials', ?, ?)
            ''', (str(uuid.uuid4()), actual_uid, norm_email, now))

            for uname in off["usernames"]:
                cur.execute('''
                    INSERT OR IGNORE INTO auth_accounts (id, user_id, provider, provider_subject, created_at)
                    VALUES (?, ?, 'credentials', ?, ?)
                ''', (str(uuid.uuid4()), actual_uid, uname.strip().lower(), now))

            cur.execute('''
                INSERT OR IGNORE INTO auth_accounts (id, user_id, provider, provider_subject, created_at)
                VALUES (?, ?, 'google', ?, ?)
            ''', (str(uuid.uuid4()), actual_uid, norm_email, now))

            cur.execute("SELECT id FROM user_assignments WHERE user_id = ? AND status = 'active'", (actual_uid,))
            existing_asgn = cur.fetchone()
            if existing_asgn:
                cur.execute('''
                    UPDATE user_assignments
                    SET role_id = ?, bureau_id = ?, region_id = ?, updated_at = ?
                    WHERE id = ?
                ''', (role_id, bureau_id, region_id, now, existing_asgn["id"]))
            else:
                cur.execute('''
                    INSERT INTO user_assignments (id, user_id, role_id, bureau_id, region_id, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
                ''', (str(uuid.uuid4()), actual_uid, role_id, bureau_id, region_id, now, now))

            imported_count += 1

        if legacy_user_rows:
            for lu in legacy_user_rows:
                u_email = (lu.get("email") or f"{lu.get('username')}@aicte.gov.in").strip().lower()
                cur.execute("SELECT id FROM users WHERE normalized_email = ?", (u_email,))
                if cur.fetchone():
                    continue

                u_name = lu.get("name") or lu.get("username", "User").title()
                u_role_key = lu.get("role", "citizen")
                u_role_id = role_lookup.get(u_role_key, role_lookup.get("citizen"))
                u_pwd_hash = lu.get("password_hash")
                u_id = f"usr_{lu.get('username') or uuid.uuid4().hex[:8]}"

                cur.execute('''
                    INSERT INTO users (id, name, normalized_email, password_hash, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 'active', ?, ?)
                ''', (u_id, u_name, u_email, u_pwd_hash, now, now))

                cur.execute('''
                    INSERT OR IGNORE INTO auth_accounts (id, user_id, provider, provider_subject, created_at)
                    VALUES (?, ?, 'credentials', ?, ?)
                ''', (str(uuid.uuid4()), u_id, u_email, now))

                if lu.get("username"):
                    cur.execute('''
                        INSERT OR IGNORE INTO auth_accounts (id, user_id, provider, provider_subject, created_at)
                        VALUES (?, ?, 'credentials', ?, ?)
                    ''', (str(uuid.uuid4()), u_id, lu.get("username").strip().lower(), now))

                cur.execute('''
                    INSERT INTO user_assignments (id, user_id, role_id, bureau_id, region_id, status, created_at, updated_at)
                    VALUES (?, ?, ?, NULL, NULL, 'active', ?, ?)
                ''', (str(uuid.uuid4()), u_id, u_role_id, now, now))

                imported_count += 1

        details = json.dumps({
            "version": MIGRATION_VERSION,
            "canonical_officers_imported": imported_count,
            "timestamp": now,
        })
        cur.execute('''
            INSERT INTO schema_migrations (version, applied_at, details)
            VALUES (?, ?, ?)
        ''', (MIGRATION_VERSION, now, details))

        conn.commit()
        conn.close()

        print(f"[RBAC Migration] Successfully executed {MIGRATION_VERSION}. {imported_count} users configured.")
        return {"status": "success", "users_configured": imported_count}

    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"[RBAC Migration Error] {e}")
        raise e

if __name__ == "__main__":
    res = run_migration()
    print("Migration Result:", res)
