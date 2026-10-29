# ============================================================
# campus/institution_registration_migration.py
# Version: 20261028_01_institution_registrations
# Creates:
#   - institution_registrations  (application lifecycle)
#   - officer_notifications      (persistent DB notifications)
# ============================================================

import datetime
from campus.db import get_conn

MIGRATION_VERSION = "20261028_01_institution_registrations"


def run_registration_migration():
    """Idempotent migration for institution registration + notifications tables."""
    conn = get_conn()
    now = datetime.datetime.now().isoformat()

    try:
        cur = conn.cursor()

        # ── Guard: skip if already applied ───────────────────────────
        cur.execute(
            "SELECT version FROM schema_migrations WHERE version = %s",
            (MIGRATION_VERSION,),
        )
        if cur.fetchone():
            conn.close()
            return {"status": "skipped", "message": f"Migration {MIGRATION_VERSION} already applied."}

        # ── 1. institution_registrations ──────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS institution_registrations (
                id                      VARCHAR(100) PRIMARY KEY,
                applicant_user_id       VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
                institution_name        VARCHAR(255) NOT NULL,
                aicte_code              VARCHAR(100),
                inst_type               VARCHAR(100),
                affiliation             TEXT,
                address                 TEXT,
                city                    VARCHAR(100),
                district                VARCHAR(100),
                state                   VARCHAR(100),
                region                  VARCHAR(100),
                official_email          VARCHAR(255) NOT NULL,
                contact_phone           VARCHAR(50),
                rep_name                VARCHAR(255),
                rep_designation         VARCHAR(255),
                rep_email               VARCHAR(255),
                rep_phone               VARCHAR(50),
                website                 TEXT,
                documents_json          TEXT DEFAULT '[]',
                declaration_accepted    INTEGER DEFAULT 0,
                status                  VARCHAR(50) NOT NULL DEFAULT 'pending',
                reviewer_id             VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
                reviewed_at             VARCHAR(100),
                review_notes            TEXT,
                rejection_reason        TEXT,
                status_history_json     TEXT DEFAULT '[]',
                submitted_at            VARCHAR(100) NOT NULL,
                updated_at              VARCHAR(100) NOT NULL,
                idempotency_key         VARCHAR(255) UNIQUE,
                created_institution_pid VARCHAR(100),
                password_hash           VARCHAR(255),
                email_sent_at           VARCHAR(100),
                email_status            VARCHAR(50) DEFAULT 'pending',
                CONSTRAINT chk_reg_status CHECK (status IN ('pending','approved','rejected'))
            )
        """)

        # Indexes
        cur.execute("CREATE INDEX IF NOT EXISTS idx_inst_reg_status ON institution_registrations(status)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_inst_reg_applicant ON institution_registrations(applicant_user_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_inst_reg_email ON institution_registrations(official_email)")

        # ── 2. officer_notifications ──────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS officer_notifications (
                id                VARCHAR(100) PRIMARY KEY,
                recipient_user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
                type              VARCHAR(100) NOT NULL,
                title             VARCHAR(255) NOT NULL,
                body              TEXT,
                action_url        VARCHAR(500),
                reference_id      VARCHAR(100),
                is_read           INTEGER DEFAULT 0,
                created_at        VARCHAR(100) NOT NULL,
                idempotency_key   VARCHAR(255) UNIQUE
            )
        """)

        cur.execute("CREATE INDEX IF NOT EXISTS idx_notif_recipient ON officer_notifications(recipient_user_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_notif_is_read ON officer_notifications(is_read)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_notif_created ON officer_notifications(created_at DESC)")

        # ── 3. Record migration ───────────────────────────────────────
        cur.execute("""
            INSERT INTO schema_migrations (version, applied_at, details)
            VALUES (%s, %s, %s)
            ON CONFLICT (version) DO NOTHING
        """, (MIGRATION_VERSION, now, "institution_registrations + officer_notifications tables"))

        conn.commit()
        print(f"[Migration] {MIGRATION_VERSION} applied successfully.")
        return {"status": "ok", "message": f"Migration {MIGRATION_VERSION} applied."}

    except Exception as e:
        conn.rollback()
        print(f"[Migration Error] {MIGRATION_VERSION}: {e}")
        raise
    finally:
        conn.close()

