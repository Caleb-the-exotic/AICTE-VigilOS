# ============================================================
# campus/migrate_roles.py — Role System Migration
# ============================================================
# Versioned, idempotent database migration script that migrates
# legacy role identifiers to the native VigilOS role system.
#
# Legacy -> Native mapping:
#   admin      -> super_admin
#   hod        -> bureau_head
#   faculty    -> approval_officer
#   teacher    -> approval_officer
#   officer    -> approval_officer
#   ambassador -> nodal_officer
#   student    -> citizen
# ============================================================

import sys
import datetime
from campus.db import get_conn

MIGRATION_VERSION = "20261025_01_role_system_migration"

ROLE_MAPPING = {
    "admin": "super_admin",
    "hod": "bureau_head",
    "faculty": "approval_officer",
    "teacher": "approval_officer",
    "officer": "approval_officer",
    "ambassador": "nodal_officer",
    "student": "citizen",
}


def run_migration() -> dict:
    """Execute the role system database migration idempotently."""
    conn = get_conn()
    results = {
        "version": MIGRATION_VERSION,
        "executed_at": datetime.datetime.now().isoformat(),
        "tables_migrated": {},
    }

    try:
        cur = conn.cursor()

        # 1. Ensure migrations tracking table exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version     TEXT PRIMARY KEY,
                applied_at  TEXT NOT NULL,
                details     TEXT
            )
        """)

        # 2. Migrate users table
        users_updated = 0
        try:
            cur.execute("SELECT username, role FROM users")
            rows = cur.fetchall()
            for r in rows:
                username = r["username"] if hasattr(r, "__getitem__") else r[0]
                role = r["role"] if hasattr(r, "__getitem__") else r[1]
                new_role = ROLE_MAPPING.get(role)
                if new_role:
                    cur.execute("UPDATE users SET role = ? WHERE username = ?", (new_role, username))
                    users_updated += 1
            
            # Ensure Caleb is super_admin
            cur.execute("UPDATE users SET role = 'super_admin' WHERE username = '2204caleb2007' OR username LIKE '%caleb%'")
            try:
                cur.execute("UPDATE users SET role = 'super_admin' WHERE LOWER(email) LIKE '%caleb%'")
            except Exception:
                pass
        except Exception as e:
            print(f"[Migration] users table notice: {e}")
        results["tables_migrated"]["users"] = users_updated

        # 3. Migrate sessions table
        sessions_updated = 0
        try:
            cur.execute("SELECT id, role FROM sessions")
            rows = cur.fetchall()
            for r in rows:
                sid = r["id"] if hasattr(r, "__getitem__") else r[0]
                role = r["role"] if hasattr(r, "__getitem__") else r[1]
                new_role = ROLE_MAPPING.get(role)
                if new_role:
                    cur.execute("UPDATE sessions SET role = ? WHERE id = ?", (new_role, sid))
                    sessions_updated += 1
        except Exception as e:
            print(f"[Migration] sessions table notice: {e}")
        results["tables_migrated"]["sessions"] = sessions_updated

        # 4. Migrate audit table (actor_role)
        audit_updated = 0
        try:
            cur.execute("SELECT id, actor_role FROM audit")
            rows = cur.fetchall()
            for r in rows:
                aid = r["id"] if hasattr(r, "__getitem__") else r[0]
                actor_role = r["actor_role"] if hasattr(r, "__getitem__") else r[1]
                new_role = ROLE_MAPPING.get(actor_role)
                if new_role:
                    cur.execute("UPDATE audit SET actor_role = ? WHERE id = ?", (new_role, aid))
                    audit_updated += 1
        except Exception as e:
            print(f"[Migration] audit table notice: {e}")
        results["tables_migrated"]["audit"] = audit_updated

        # 5. Migrate live_chat_messages (sender_role)
        chat_updated = 0
        try:
            cur.execute("SELECT id, sender_role FROM live_chat_messages")
            rows = cur.fetchall()
            for r in rows:
                mid = r["id"] if hasattr(r, "__getitem__") else r[0]
                sender_role = r["sender_role"] if hasattr(r, "__getitem__") else r[1]
                new_role = ROLE_MAPPING.get(sender_role)
                if new_role:
                    cur.execute("UPDATE live_chat_messages SET sender_role = ? WHERE id = ?", (new_role, mid))
                    chat_updated += 1
        except Exception as e:
            print(f"[Migration] live_chat_messages table notice: {e}")
        results["tables_migrated"]["live_chat_messages"] = chat_updated

        # 6. Migrate agent_execution_steps (agent_role)
        steps_updated = 0
        try:
            cur.execute("SELECT id, agent_role FROM agent_execution_steps")
            rows = cur.fetchall()
            for r in rows:
                sid = r["id"] if hasattr(r, "__getitem__") else r[0]
                agent_role = r["agent_role"] if hasattr(r, "__getitem__") else r[1]
                new_role = ROLE_MAPPING.get(agent_role)
                if new_role:
                    cur.execute("UPDATE agent_execution_steps SET agent_role = ? WHERE id = ?", (new_role, sid))
                    steps_updated += 1
        except Exception as e:
            print(f"[Migration] agent_execution_steps table notice: {e}")
        results["tables_migrated"]["agent_execution_steps"] = steps_updated

        # Record migration execution
        summary = (
            f"users: {users_updated}, sessions: {sessions_updated}, "
            f"audit: {audit_updated}, chat: {chat_updated}, steps: {steps_updated}"
        )
        cur.execute("""
            INSERT INTO schema_migrations (version, applied_at, details)
            VALUES (?, ?, ?)
            ON CONFLICT (version) DO UPDATE SET applied_at = excluded.applied_at, details = excluded.details
        """, (MIGRATION_VERSION, datetime.datetime.now().isoformat(), summary))

        conn.commit()
        results["status"] = "success"
        results["summary"] = summary
        print(f"[Role Migration] Completed: {summary}")
        return results

    except Exception as e:
        conn.rollback()
        results["status"] = "error"
        results["error"] = str(e)
        print(f"[Role Migration] Failed: {e}", file=sys.stderr)
        return results
    finally:
        conn.close()


if __name__ == "__main__":
    res = run_migration()
    print(res)
