# ============================================================
# campus/comms_migration.py — Messages App Database Migration
# ============================================================
# Version: 20261026_01_internal_messages
# Sets up tables and indexes for internal VigilOS communications:
# - internal_messages (authoritative message logs with sender identity)
# - internal_message_recipients (per-recipient inbox, read state, folder)
# - adds institution / department columns to users table
# - populates institutional contacts in aicte_institutions
# ============================================================

import os
import datetime
from campus.db import get_conn

MIGRATION_VERSION = "20261026_01_internal_messages"

def run_comms_migration():
    """Run idempotent migration for internal communications system."""
    conn = get_conn()
    now = datetime.datetime.now().isoformat()

    try:
        cur = conn.cursor()

        # 1. Track migration version
        cur.execute('''
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL,
                details TEXT
            )
        ''')
        cur.execute("SELECT version FROM schema_migrations WHERE version = ?", (MIGRATION_VERSION,))
        if cur.fetchone():
            conn.close()
            return {"status": "skipped", "message": f"Migration {MIGRATION_VERSION} already applied."}

        # 2. Add institution & department columns to users if missing
        try:
            cur.execute("ALTER TABLE users ADD COLUMN institution TEXT DEFAULT NULL")
        except Exception:
            pass

        try:
            cur.execute("ALTER TABLE users ADD COLUMN department TEXT DEFAULT NULL")
        except Exception:
            pass

        # 3. Add contact fields to aicte_institutions if missing
        try:
            cur.execute("ALTER TABLE aicte_institutions ADD COLUMN contact_email TEXT DEFAULT NULL")
        except Exception:
            pass

        try:
            cur.execute("ALTER TABLE aicte_institutions ADD COLUMN contact_phone TEXT DEFAULT NULL")
        except Exception:
            pass

        try:
            cur.execute("ALTER TABLE aicte_institutions ADD COLUMN principal_name TEXT DEFAULT NULL")
        except Exception:
            pass

        # 4. Create internal_messages table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS internal_messages (
                id                  TEXT PRIMARY KEY,
                message_ref         TEXT UNIQUE NOT NULL,
                sender_user_id      TEXT NOT NULL REFERENCES users(id),
                sender_email        TEXT NOT NULL,
                sender_name         TEXT NOT NULL,
                sender_role         TEXT NOT NULL,
                sender_role_label   TEXT NOT NULL,
                sender_bureau       TEXT NOT NULL,
                sender_bureau_code  TEXT NOT NULL,
                sender_region       TEXT NOT NULL,
                sender_region_code  TEXT NOT NULL,
                sender_institution  TEXT,
                subject             TEXT NOT NULL,
                body                TEXT NOT NULL,
                thread_id           TEXT,
                in_reply_to         TEXT,
                delivery_type       TEXT DEFAULT 'internal',
                attachments_json    TEXT DEFAULT '[]',
                created_at          TEXT NOT NULL,
                sent_at             TEXT NOT NULL,
                status              TEXT DEFAULT 'sent'
            )
        ''')

        # 5. Create internal_message_recipients table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS internal_message_recipients (
                id                  TEXT PRIMARY KEY,
                message_id          TEXT NOT NULL REFERENCES internal_messages(id) ON DELETE CASCADE,
                recipient_user_id   TEXT REFERENCES users(id),
                recipient_email     TEXT NOT NULL,
                recipient_name      TEXT NOT NULL,
                recipient_type      TEXT DEFAULT 'to',
                is_registered       INTEGER DEFAULT 1,
                institution         TEXT,
                role_label          TEXT,
                read_at             TEXT,
                starred             INTEGER DEFAULT 0,
                folder              TEXT DEFAULT 'inbox',
                delivery_status     TEXT DEFAULT 'delivered',
                delivery_error      TEXT
            )
        ''')

        # 6. Indexes for performant lookup
        cur.execute("CREATE INDEX IF NOT EXISTS idx_im_sender ON internal_messages(sender_user_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_im_created ON internal_messages(created_at)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_im_thread ON internal_messages(thread_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_imr_msg ON internal_message_recipients(message_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_imr_user_folder ON internal_message_recipients(recipient_user_id, folder)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_imr_email ON internal_message_recipients(recipient_email)")

        # 7. Enrich canonical registered officers with official institutions
        officer_institutions = {
            "2204caleb2007@gmail.com": ("AICTE Central Vigilance Directorate HQ", "Central Vigilance"),
            "admin@aicte-india.org": ("AICTE Central Vigilance Directorate HQ", "Platform Administration"),
            "admin@aicte.gov.in": ("AICTE Regulation Bureau (RB)", "Intake & Regulatory Review"),
            "officer@aicte.gov.in": ("AICTE Public Grievance Redressal Cell (PGRC)", "Grievance Investigation"),
            "hariprasath134208@gmail.com": ("AICTE Southern Regional Office (SRO)", "Regulation & Approval"),
            "monishayathavan@gmail.com": ("AICTE Southern Regional Office (SRO)", "Public Grievance Redressal"),
            "swethanc21@gmail.com": ("AICTE Southern Regional Office (SRO)", "Regulation & Oversight"),
            "deepanthangavel0611@gmail.com": ("AICTE State Liaison Directorate", "Inter-Agency Field Liaison"),
            "suryaprakashd22007@gmail.com": ("AICTE Southern Regional Office (SRO)", "Grievance Redressal"),
        }

        for email, (inst, dept) in officer_institutions.items():
            cur.execute(
                "UPDATE users SET institution = ?, department = ? WHERE normalized_email = ?",
                (inst, dept, email)
            )

        # 8. Seed institutional contacts in aicte_institutions with verified emails
        institutional_contacts = [
            ("1-109723481", "Shri Ram Institute of Technology", "Northern", "Madhya Pradesh", "Jabalpur", "Engineering College", "director@sritgroup.net", "+91 761 4001000", "Dr. R.K. Saxena"),
            ("1-376234110", "Thakur College of Engineering & Technology", "Western", "Maharashtra", "Mumbai", "Autonomous / Linguistic Minority", "tcet@thakureducation.org", "+91 22 6730 8000", "Dr. B.K. Mishra"),
            ("1-204561892", "KL University (Koneru Lakshmaiah)", "Southern", "Andhra Pradesh", "Vaddeswaram", "Deemed University", "registrar@kluniversity.in", "+91 863 2399999", "Dr. S.S. Mantha"),
            ("1-445871203", "Kalinga Institute of Industrial Technology", "Eastern", "Odisha", "Bhubaneswar", "Deemed University", "director@kiit.ac.in", "+91 674 2725113", "Prof. Sasmita Samanta"),
            ("1-512398067", "SRM Institute of Science and Technology", "Southern", "Tamil Nadu", "Chennai", "Deemed University", "registrar@srmist.edu.in", "+91 44 27417000", "Dr. C. Muthamizhchelvan"),
            ("1-631047285", "GLA University", "Northern", "Uttar Pradesh", "Mathura", "Private University", "registrar@gla.ac.in", "+91 5662 250900", "Prof. Durg Singh Chauhan"),
            ("1-788234501", "Amity University Rajasthan", "Northern", "Rajasthan", "Jaipur", "Private University", "vc@jpr.amity.edu", "+91 141 3811000", "Prof. Amit Jain"),
            ("1-890123456", "VIT Bhopal University", "Central", "Madhya Pradesh", "Bhopal", "Deemed University", "registrar@vitbhopal.ac.in", "+91 756 2268500", "Dr. U. Kamachi Mudali"),
            ("1-923456789", "Chandigarh University", "Northern", "Punjab", "Mohali", "Private University", "vc@cumail.in", "+91 160 3051003", "Dr. Manpreet Singh Manna"),
            ("1-101234567", "Dr. A.P.J. Abdul Kalam Technical University", "Northern", "Uttar Pradesh", "Lucknow", "State University", "registrar@aktu.ac.in", "+91 522 2336805", "Prof. J.P. Pandey"),
            ("1-112345678", "Vellore Institute of Technology", "Southern", "Tamil Nadu", "Vellore", "Deemed University", "chancellor@vit.ac.in", "+91 416 2202020", "Dr. G. Viswanathan"),
            ("1-123456789", "College of Engineering Pune (COEP)", "Western", "Maharashtra", "Pune", "Autonomous State Institute", "director@coep.ac.in", "+91 20 25507000", "Dr. B.B. Ahuja"),
            ("1-134567890", "PSG College of Technology", "Southern", "Tamil Nadu", "Coimbatore", "Autonomous Government-Aided", "principal@psgtech.edu", "+91 422 2572177", "Dr. K. Prakasan"),
            ("1-145678901", "RV College of Engineering", "Southern", "Karnataka", "Bengaluru", "Autonomous Institution", "principal@rvce.edu.in", "+91 80 68188111", "Dr. K.N. Subramanya"),
            ("1-156789012", "Delhi Technological University (DTU)", "Northern", "Delhi", "New Delhi", "State University", "vc@dtu.ac.in", "+91 11 27871018", "Prof. Prateek Sharma"),
        ]

        for pid, name, reg, state, city, itype, email, phone, principal in institutional_contacts:
            cur.execute('''
                INSERT INTO aicte_institutions 
                (aicte_pid, institution_name, region, state, district, address, inst_type, contact_email, contact_phone, principal_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(aicte_pid) DO UPDATE SET
                    institution_name = excluded.institution_name,
                    region = excluded.region,
                    state = excluded.state,
                    contact_email = excluded.contact_email,
                    contact_phone = excluded.contact_phone,
                    principal_name = excluded.principal_name
            ''', (pid, name, reg, state, city, f"{city}, {state}", itype, email, phone, principal, now))

        # Record migration
        cur.execute(
            "INSERT INTO schema_migrations (version, applied_at, details) VALUES (?, ?, ?)",
            (MIGRATION_VERSION, now, "Created internal_messages and internal_message_recipients tables")
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

    # Run V2 per-user mailbox migration
    return run_mailbox_v2_migration()

MIGRATION_VERSION_V2 = "20261027_02_per_user_mailbox_drafts_labels"

def run_mailbox_v2_migration():
    """
    Migration V2:
    - per-user sender mailbox columns (sender_folder, sender_starred, sender_labels_json, sender_deleted_at)
    - per-recipient mailbox columns (labels_json, deleted_at)
    - internal_drafts table for autosave and multi-account drafts
    - internal_user_labels table for custom user labels
    - internal_idempotency_keys table to prevent duplicate email transmissions
    """
    conn = get_conn()
    now = datetime.datetime.now().isoformat()
    try:
        cur = conn.cursor()

        cur.execute('''
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL,
                details TEXT
            )
        ''')
        cur.execute("SELECT version FROM schema_migrations WHERE version = ?", (MIGRATION_VERSION_V2,))
        if cur.fetchone():
            conn.close()
            return {"status": "skipped", "message": f"Migration {MIGRATION_VERSION_V2} already applied."}

        # 1. Add per-user sender columns to internal_messages
        cols_to_add_messages = [
            ("sender_folder", "TEXT DEFAULT 'sent'"),
            ("sender_starred", "INTEGER DEFAULT 0"),
            ("sender_labels_json", "TEXT DEFAULT '[]'"),
            ("sender_deleted_at", "TEXT DEFAULT NULL"),
        ]
        for col_name, col_type in cols_to_add_messages:
            try:
                cur.execute(f"ALTER TABLE internal_messages ADD COLUMN {col_name} {col_type}")
            except Exception:
                pass

        # 2. Add per-user recipient columns to internal_message_recipients
        cols_to_add_recipients = [
            ("labels_json", "TEXT DEFAULT '[]'"),
            ("deleted_at", "TEXT DEFAULT NULL"),
        ]
        for col_name, col_type in cols_to_add_recipients:
            try:
                cur.execute(f"ALTER TABLE internal_message_recipients ADD COLUMN {col_name} {col_type}")
            except Exception:
                pass

        # 3. Create internal_drafts table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS internal_drafts (
                id                  TEXT PRIMARY KEY,
                user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                to_recipients_json  TEXT DEFAULT '[]',
                subject             TEXT DEFAULT '',
                body                TEXT DEFAULT '',
                thread_id           TEXT,
                in_reply_to         TEXT,
                attachments_json    TEXT DEFAULT '[]',
                created_at          TEXT NOT NULL,
                updated_at          TEXT NOT NULL
            )
        ''')
        cur.execute("CREATE INDEX IF NOT EXISTS idx_drafts_user ON internal_drafts(user_id, updated_at)")

        # 4. Create internal_user_labels table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS internal_user_labels (
                id                  TEXT PRIMARY KEY,
                user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name                TEXT NOT NULL,
                color               TEXT DEFAULT 'red',
                created_at          TEXT NOT NULL,
                UNIQUE(user_id, name)
            )
        ''')
        cur.execute("CREATE INDEX IF NOT EXISTS idx_labels_user ON internal_user_labels(user_id)")

        # 5. Create internal_idempotency_keys table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS internal_idempotency_keys (
                idempotency_key     TEXT PRIMARY KEY,
                user_id             TEXT NOT NULL,
                message_id          TEXT NOT NULL,
                response_json       TEXT NOT NULL,
                created_at          TEXT NOT NULL
            )
        ''')
        cur.execute("CREATE INDEX IF NOT EXISTS idx_idem_created ON internal_idempotency_keys(created_at)")

        # 6. Seed default labels for all existing users
        cur.execute("SELECT id FROM users")
        user_rows = cur.fetchall()
        for u in user_rows:
            uid = u["id"]
            for default_lbl in ["Important", "Admin", "Personal"]:
                lbl_id = f"lbl_{uuid.uuid4().hex[:12]}" if 'uuid' in globals() else f"lbl_{uid}_{default_lbl.lower()}"
                try:
                    cur.execute('''
                        INSERT OR IGNORE INTO internal_user_labels (id, user_id, name, color, created_at)
                        VALUES (?, ?, ?, 'red', ?)
                    ''', (lbl_id, uid, default_lbl, now))
                except Exception:
                    pass

        # Record migration
        cur.execute(
            "INSERT INTO schema_migrations (version, applied_at, details) VALUES (?, ?, ?)",
            (MIGRATION_VERSION_V2, now, "Per-user mailbox state, drafts, user labels, and idempotency tables")
        )
        conn.commit()
        return {"status": "ok", "message": f"Migration {MIGRATION_VERSION_V2} executed successfully."}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    import uuid
    res = run_comms_migration()
    print("Migration result:", res)
    res2 = run_mailbox_v2_migration()
    print("V2 Migration result:", res2)
