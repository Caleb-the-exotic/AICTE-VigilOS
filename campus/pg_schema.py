# ============================================================
# campus/pg_schema.py — Authoritative PostgreSQL Schema & Migrations
# ============================================================
# Version: 20261027_01_postgres_schema
# Fully normalized, enterprise-grade PostgreSQL schema definitions
# for AICTE VigilOS production deployment.
# ============================================================

POSTGRES_SCHEMA_SQL = """
-- 1. Schema migrations tracker
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    applied_at VARCHAR(100) NOT NULL,
    details TEXT
);

-- 2. Bureaus
CREATE TABLE IF NOT EXISTS bureaus (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at VARCHAR(100) NOT NULL
);

-- 3. Regions
CREATE TABLE IF NOT EXISTS regions (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at VARCHAR(100) NOT NULL
);

-- 4. Roles
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(100) PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT
);

-- 5. Permissions
CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(100) PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

-- 6. Role Permissions mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(100) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 7. Users
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    normalized_email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at VARCHAR(100) NOT NULL,
    updated_at VARCHAR(100) NOT NULL,
    two_factor_enabled INTEGER DEFAULT 0,
    institution TEXT DEFAULT NULL,
    department TEXT DEFAULT NULL
);

-- 8. Deleted Accounts registry (Prevents deleted accounts from silently recreating)
CREATE TABLE IF NOT EXISTS deleted_accounts (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    deleted_at VARCHAR(100) NOT NULL,
    deleted_by VARCHAR(100) NOT NULL,
    reason TEXT
);

-- 9. Authentication Accounts (OAuth / Google / Password links)
CREATE TABLE IF NOT EXISTS auth_accounts (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    created_at VARCHAR(100) NOT NULL,
    UNIQUE(provider, provider_subject)
);

-- 10. User Assignments (Roles, Bureau, Region)
CREATE TABLE IF NOT EXISTS user_assignments (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id VARCHAR(100) NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    bureau_id VARCHAR(100) REFERENCES bureaus(id) ON DELETE SET NULL,
    region_id VARCHAR(100) REFERENCES regions(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at VARCHAR(100) NOT NULL,
    updated_at VARCHAR(100) NOT NULL
);

-- 11. Assignment & User Audit Logs
CREATE TABLE IF NOT EXISTS assignment_audit (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    changed_by VARCHAR(100) NOT NULL,
    old_role_key VARCHAR(50),
    new_role_key VARCHAR(50),
    old_bureau_code VARCHAR(50),
    new_bureau_code VARCHAR(50),
    old_region_code VARCHAR(50),
    new_region_code VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    created_at VARCHAR(100) NOT NULL
);

-- 12. Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(100) PRIMARY KEY,
    title TEXT,
    created_at VARCHAR(100),
    role VARCHAR(50) DEFAULT 'citizen',
    user_id VARCHAR(100),
    workflow_type VARCHAR(100)
);

-- 13. Messages
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) REFERENCES sessions(id) ON DELETE CASCADE,
    role VARCHAR(50),
    content TEXT,
    created_at VARCHAR(100)
);

-- 14. Requests
CREATE TABLE IF NOT EXISTS requests (
    id VARCHAR(100) PRIMARY KEY,
    session_id VARCHAR(100) REFERENCES sessions(id) ON DELETE CASCADE,
    workflow_type VARCHAR(100),
    schema_json TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    policy_result TEXT,
    policy_reason TEXT,
    alternatives TEXT,
    created_at VARCHAR(100),
    updated_at VARCHAR(100),
    retry_count INTEGER DEFAULT 0,
    last_attempt VARCHAR(100)
);

-- 15. System Logs
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100),
    level VARCHAR(50) DEFAULT 'INFO',
    message TEXT,
    created_at VARCHAR(100)
);

-- 16. Audit
CREATE TABLE IF NOT EXISTS audit (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100),
    actor_role VARCHAR(50),
    action VARCHAR(100),
    target TEXT,
    result TEXT,
    created_at VARCHAR(100)
);

-- 17. KPIs
CREATE TABLE IF NOT EXISTS kpis (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100),
    workflow_type VARCHAR(100),
    submitted_at VARCHAR(100),
    resolved_at VARCHAR(100),
    resolution_mins REAL,
    outcome VARCHAR(50),
    loops_used INTEGER
);

-- 18. Academic Calendar
CREATE TABLE IF NOT EXISTS academic_calendar (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    event_name TEXT,
    date VARCHAR(50) NOT NULL UNIQUE,
    created_at VARCHAR(100)
);

-- 19. Scheduler Logs
CREATE TABLE IF NOT EXISTS scheduler_logs (
    id SERIAL PRIMARY KEY,
    job_name VARCHAR(100) NOT NULL,
    executed_at VARCHAR(100) NOT NULL,
    outcome VARCHAR(50),
    detail TEXT
);

-- 20. Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id VARCHAR(100) PRIMARY KEY,
    resource_id VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    date VARCHAR(50) NOT NULL,
    time_slot VARCHAR(50) NOT NULL,
    session_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'confirmed',
    created_at VARCHAR(100),
    expires_at VARCHAR(100)
);

-- 21. Agent Execution Steps
CREATE TABLE IF NOT EXISTS agent_execution_steps (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    request_id VARCHAR(100),
    step_type VARCHAR(50) NOT NULL,
    agent_role VARCHAR(50) NOT NULL,
    input_payload TEXT,
    output_payload TEXT,
    confidence_score REAL,
    created_at VARCHAR(100)
);

-- 22. AICTE Institutions
CREATE TABLE IF NOT EXISTS aicte_institutions (
    aicte_pid VARCHAR(100) PRIMARY KEY,
    institution_name VARCHAR(255) NOT NULL,
    region VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    address TEXT,
    inst_type VARCHAR(100) DEFAULT 'Engineering College',
    created_at VARCHAR(100),
    contact_email VARCHAR(255) DEFAULT NULL,
    contact_phone VARCHAR(50) DEFAULT NULL,
    principal_name VARCHAR(255) DEFAULT NULL,
    city VARCHAR(100) DEFAULT '',
    approval_status VARCHAR(100) DEFAULT 'AICTE Approved (EOA 2026-27)',
    website TEXT DEFAULT '',
    established_year INTEGER DEFAULT 2000,
    total_faculty INTEGER DEFAULT 50,
    total_students INTEGER DEFAULT 1000,
    images_json TEXT DEFAULT '[]',
    updated_at VARCHAR(100) DEFAULT ''
);

-- 23. AICTE Cases
CREATE TABLE IF NOT EXISTS aicte_cases (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(100) UNIQUE NOT NULL,
    aicte_pid VARCHAR(100) NOT NULL REFERENCES aicte_institutions(aicte_pid),
    institution_name VARCHAR(255),
    region VARCHAR(100),
    bureau VARCHAR(50) NOT NULL,
    complainant_type VARCHAR(100) DEFAULT 'Public',
    category VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    assigned_officer VARCHAR(255),
    status VARCHAR(50) DEFAULT 'received',
    sla_days INTEGER DEFAULT 30,
    sla_deadline VARCHAR(100),
    disposed_at VARCHAR(100),
    linked_case_ids TEXT DEFAULT '[]',
    created_at VARCHAR(100) NOT NULL,
    updated_at VARCHAR(100),
    institution_code VARCHAR(100) DEFAULT '',
    complainant_user_id VARCHAR(100) DEFAULT '',
    complainant_name VARCHAR(255) DEFAULT '',
    complainant_email VARCHAR(255) DEFAULT '',
    received_at VARCHAR(100) DEFAULT '',
    resolved_at VARCHAR(100) DEFAULT ''
);

-- 24. AICTE Case Sequences
CREATE TABLE IF NOT EXISTS aicte_case_sequences (
    bureau VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    last_seq INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (bureau, year)
);

-- 25. AICTE Overlap Alerts
CREATE TABLE IF NOT EXISTS aicte_overlap_alerts (
    id SERIAL PRIMARY KEY,
    aicte_pid VARCHAR(100) NOT NULL,
    rb_case_id VARCHAR(100),
    pgrc_case_id VARCHAR(100),
    overlap_score REAL,
    overlap_type VARCHAR(100),
    shared_root_cause TEXT,
    recommended_action TEXT,
    reason TEXT,
    resolved INTEGER DEFAULT 0,
    created_at VARCHAR(100)
);

-- 26. Live Chat Messages
CREATE TABLE IF NOT EXISTS live_chat_messages (
    id VARCHAR(100) PRIMARY KEY,
    sender_id VARCHAR(100) NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    sender_role VARCHAR(100),
    text TEXT NOT NULL,
    created_at VARCHAR(100) NOT NULL,
    deleted_at VARCHAR(100) DEFAULT NULL
);

-- 27. Internal Messages (Preserves sender history even if user account is removed)
CREATE TABLE IF NOT EXISTS internal_messages (
    id VARCHAR(100) PRIMARY KEY,
    message_ref VARCHAR(100) UNIQUE NOT NULL,
    sender_user_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    sender_role VARCHAR(100) NOT NULL,
    sender_role_label VARCHAR(100) NOT NULL,
    sender_bureau VARCHAR(100) NOT NULL,
    sender_bureau_code VARCHAR(50) NOT NULL,
    sender_region VARCHAR(100) NOT NULL,
    sender_region_code VARCHAR(50) NOT NULL,
    sender_institution TEXT,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    thread_id VARCHAR(100),
    in_reply_to VARCHAR(100),
    delivery_type VARCHAR(50) DEFAULT 'internal',
    attachments_json TEXT DEFAULT '[]',
    created_at VARCHAR(100) NOT NULL,
    sent_at VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'sent',
    sender_folder VARCHAR(50) DEFAULT 'sent',
    sender_starred INTEGER DEFAULT 0,
    sender_labels_json TEXT DEFAULT '[]',
    sender_deleted_at VARCHAR(100) DEFAULT NULL
);

-- 28. Internal Message Recipients (Preserves recipient delivery records on account deletion)
CREATE TABLE IF NOT EXISTS internal_message_recipients (
    id VARCHAR(100) PRIMARY KEY,
    message_id VARCHAR(100) NOT NULL REFERENCES internal_messages(id) ON DELETE CASCADE,
    recipient_user_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    recipient_type VARCHAR(50) DEFAULT 'to',
    is_registered INTEGER DEFAULT 1,
    institution TEXT,
    role_label VARCHAR(100),
    read_at VARCHAR(100),
    starred INTEGER DEFAULT 0,
    folder VARCHAR(50) DEFAULT 'inbox',
    delivery_status VARCHAR(50) DEFAULT 'delivered',
    delivery_error TEXT,
    labels_json TEXT DEFAULT '[]',
    deleted_at VARCHAR(100) DEFAULT NULL
);

-- 29. Internal Drafts
CREATE TABLE IF NOT EXISTS internal_drafts (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_recipients_json TEXT DEFAULT '[]',
    subject TEXT DEFAULT '',
    body TEXT DEFAULT '',
    thread_id VARCHAR(100),
    in_reply_to VARCHAR(100),
    attachments_json TEXT DEFAULT '[]',
    created_at VARCHAR(100) NOT NULL,
    updated_at VARCHAR(100) NOT NULL
);

-- 30. Internal User Labels
CREATE TABLE IF NOT EXISTS internal_user_labels (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(50) DEFAULT 'red',
    created_at VARCHAR(100) NOT NULL,
    UNIQUE(user_id, name)
);

-- 31. Internal Idempotency Keys
CREATE TABLE IF NOT EXISTS internal_idempotency_keys (
    idempotency_key VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    message_id VARCHAR(100) NOT NULL,
    response_json TEXT NOT NULL,
    created_at VARCHAR(100) NOT NULL
);

-- 32. Legacy Users Backup
CREATE TABLE IF NOT EXISTS legacy_users_backup (
    username VARCHAR(100) PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL
);

-- Indexes for performance & integrity
CREATE INDEX IF NOT EXISTS idx_users_email ON users(normalized_email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_user_assignments_user ON user_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_assignments_role ON user_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_user ON auth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_aicte_cases_pid ON aicte_cases(aicte_pid);
CREATE INDEX IF NOT EXISTS idx_aicte_cases_bureau ON aicte_cases(bureau);
CREATE INDEX IF NOT EXISTS idx_internal_msg_sender ON internal_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_internal_rcpt_user ON internal_message_recipients(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_internal_rcpt_msg ON internal_message_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_email ON deleted_accounts(email);
"""

def init_postgres_schema(conn):
    """
    Apply versioned PostgreSQL schema using the provided raw or wrapped connection.
    Idempotent and safe to run on startup or migration.
    """
    cur = conn.cursor()
    # Execute full DDL
    cur.execute(POSTGRES_SCHEMA_SQL)
    
    # Record migration version
    import datetime
    now = datetime.datetime.now().isoformat()
    cur.execute("""
        INSERT INTO schema_migrations (version, applied_at, details)
        VALUES (%s, %s, %s)
        ON CONFLICT (version) DO NOTHING
    """, ("20261027_01_postgres_schema", now, "Comprehensive PostgreSQL schema migration"))
    
    # Synchronize all SERIAL sequences with their table MAX(id) to prevent duplicate key violations after data import
    try:
        cur.execute("""
            SELECT 
                t.relname AS table_name,
                a.attname AS column_name,
                s.relname AS sequence_name
            FROM pg_class s
            JOIN pg_depend d ON d.objid = s.oid
            JOIN pg_class t ON d.refobjid = t.oid
            JOIN pg_attribute a ON (d.refobjid, d.refobjsubid) = (a.attrelid, a.attnum)
            WHERE s.relkind = 'S';
        """)
        seq_rows = cur.fetchall()
        for s_row in seq_rows:
            try:
                tbl = s_row['table_name'] if hasattr(s_row, 'keys') else s_row[0]
                col = s_row['column_name'] if hasattr(s_row, 'keys') else s_row[1]
                seq = s_row['sequence_name'] if hasattr(s_row, 'keys') else s_row[2]
                cur.execute(f"SELECT COALESCE(MAX({col}), 0) FROM {tbl};")
                m_row = cur.fetchone()
                m_val = m_row[0] if m_row else 0
                cur.execute(f"SELECT setval('{seq}', {m_val} + 1, false);")
            except Exception:
                continue
    except Exception as seq_sync_err:
        print(f"[PostgreSQL Schema] Sequence auto-sync notice: {seq_sync_err}")

    conn.commit()
    print("[PostgreSQL Schema] Initialized schema and indexes successfully.")
