# ============================================================
# campus/db.py — SQLite Persistence Layer
# ============================================================
# All campus workflows, messages, logs, and audit trails are
# stored here. Replaces the JSON file system for all new data.
# Existing chat_history/ JSON sessions are still supported for
# the message display layer in main.py.
# ============================================================

import sqlite3
import os
import json
import datetime
import uuid
import re

try:
    import psycopg2
    from psycopg2.extras import DictCursor
    HAS_PG = True
except ImportError:
    HAS_PG = False

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "campusflow.db")

# ── POSTGRESQL WRAPPERS FOR COMPATIBILITY ──────────────────────────
class PGConnectionWrapper:
    def __init__(self, conn):
        self._conn = conn
    
    def cursor(self):
        return PGCursorWrapper(self._conn.cursor(cursor_factory=DictCursor))
    
    def execute(self, sql, params=None):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur
        
    def executescript(self, sql_script):
        # PostgreSQL does not have executescript, we split and run individually
        # Convert auto-increments
        sql_script = sql_script.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')
        cur = self.cursor()
        for statement in sql_script.split(';'):
            cleaned = statement.strip()
            if cleaned:
                cur.execute(cleaned)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.rollback()
        else:
            self.commit()
        self.close()

class PGCursorWrapper:
    def __init__(self, cur):
        self._cur = cur

    def execute(self, sql, params=None):
        # Convert SQLite ? placeholders to PG %s
        sql = sql.replace('?', '%s')
        
        # Translate SQLite INSERT OR IGNORE to PG INSERT ON CONFLICT DO NOTHING
        if 'INSERT OR IGNORE' in sql.upper():
            sql = re.sub(r'(?i)INSERT\s+OR\s+IGNORE\s+INTO', 'INSERT INTO', sql)
            if 'ON CONFLICT' not in sql.upper():
                sql = sql + ' ON CONFLICT DO NOTHING'
                
        # PRAGMA statements are SQLite specific, no-op them
        if sql.strip().upper().startswith('PRAGMA'):
            return self

        if params is not None:
            if not isinstance(params, (tuple, list)):
                params = (params,)
            self._cur.execute(sql, params)
        else:
            self._cur.execute(sql)
        return self

    def fetchall(self):
        rows = self._cur.fetchall()
        return [DictRowWrapper(r) for r in rows]

    def fetchone(self):
        row = self._cur.fetchone()
        return DictRowWrapper(row) if row else None

    @property
    def rowcount(self):
        return self._cur.rowcount

class DictRowWrapper:
    def __init__(self, row):
        self._row = row

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._row[key]
        return self._row.get(key)


def get_conn():
    """Return a thread-safe connection (SQLite or PostgreSQL if configured)."""
    use_pg = os.getenv("USE_POSTGRES", "false").lower() in ("true", "1", "yes")
    pg_url = os.getenv("DATABASE_URL")
    if HAS_PG and use_pg and pg_url and not pg_url.startswith("sqlite"):
        pg_host = os.getenv("POSTGRES_HOST")
        if pg_url or (pg_host and os.getenv("POSTGRES_DB")):
            try:
                if pg_url:
                    conn = psycopg2.connect(pg_url)
                else:
                    conn = psycopg2.connect(
                        host=pg_host,
                        database=os.getenv("POSTGRES_DB"),
                        user=os.getenv("POSTGRES_USER", "postgres"),
                        password=os.getenv("POSTGRES_PASSWORD", ""),
                        port=os.getenv("POSTGRES_PORT", "5432")
                    )
                return PGConnectionWrapper(conn)
            except Exception as e:
                import sys
                print(f"[Postgres Connection Error] {e}. Falling back to SQLite...", file=sys.stderr)

    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn



def _seed_academic_calendar():
    """Populate exam dates dynamically (current year) on first run."""
    import datetime as _dt
    year = _dt.date.today().year
    exam_dates = [
        (f"{year}-04-15", "EXAM", "Semester Exam Day 1"),
        (f"{year}-04-16", "EXAM", "Semester Exam Day 2"),
        (f"{year}-04-17", "EXAM", "Semester Exam Day 3"),
        (f"{year}-04-18", "EXAM", "Semester Exam Day 4"),
        (f"{year}-04-22", "EXAM", "Semester Exam Day 5"),
        (f"{year}-04-23", "EXAM", "Semester Exam Day 6"),
    ]
    conn = get_conn()
    now = _dt.datetime.now().isoformat()
    with conn:
        for date, etype, name in exam_dates:
            conn.execute(
                "INSERT OR IGNORE INTO academic_calendar (event_type, event_name, date, created_at) VALUES (?,?,?,?)",
                (etype, name, date, now),
            )
    conn.close()


def get_exam_dates() -> list[str]:
    """Return all exam dates from DB (replaces hardcoded EXAM_DATES list)."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT date FROM academic_calendar WHERE event_type='EXAM'"
    ).fetchall()
    conn.close()
    return [r["date"] for r in rows]


def init_db():
    """Create all tables if they don't exist."""
    conn = get_conn()
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            id          TEXT PRIMARY KEY,
            title       TEXT,
            created_at  TEXT,
            role        TEXT DEFAULT 'citizen',
            user_id     TEXT,
            workflow_type TEXT
        );

        CREATE TABLE IF NOT EXISTS messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT REFERENCES sessions(id) ON DELETE CASCADE,
            role        TEXT,
            content     TEXT,
            created_at  TEXT
        );

        CREATE TABLE IF NOT EXISTS live_chat_messages (
            id          TEXT PRIMARY KEY,
            sender_id   TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            sender_role TEXT,
            text        TEXT NOT NULL,
            created_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS requests (
            id              TEXT PRIMARY KEY,
            session_id      TEXT REFERENCES sessions(id) ON DELETE CASCADE,
            workflow_type   TEXT,
            schema_json     TEXT,
            status          TEXT DEFAULT 'pending',
            policy_result   TEXT,
            policy_reason   TEXT,
            alternatives    TEXT,
            created_at      TEXT,
            updated_at      TEXT,
            retry_count     INTEGER DEFAULT 0,
            last_attempt    TEXT
        );

        CREATE TABLE IF NOT EXISTS logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT,
            level       TEXT DEFAULT 'INFO',
            message     TEXT,
            created_at  TEXT
        );

        CREATE TABLE IF NOT EXISTS audit (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT,
            actor_role  TEXT,
            action      TEXT,
            target      TEXT,
            result      TEXT,
            created_at  TEXT
        );

        CREATE TABLE IF NOT EXISTS kpis (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id      TEXT,
            workflow_type   TEXT,
            submitted_at    TEXT,
            resolved_at     TEXT,
            resolution_mins REAL,
            outcome         TEXT,
            loops_used      INTEGER
        );

        CREATE TABLE IF NOT EXISTS bookings (
            id            TEXT PRIMARY KEY,
            resource_id   TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            date          TEXT NOT NULL,
            time_slot     TEXT NOT NULL,
            session_id    TEXT,
            status        TEXT DEFAULT 'confirmed',
            created_at    TEXT,
            expires_at    TEXT
        );

        CREATE TABLE IF NOT EXISTS academic_calendar (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type  TEXT NOT NULL,
            event_name  TEXT,
            date        TEXT NOT NULL UNIQUE,
            created_at  TEXT
        );

        CREATE TABLE IF NOT EXISTS scheduler_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            job_name    TEXT NOT NULL,
            executed_at TEXT NOT NULL,
            outcome     TEXT,
            detail      TEXT
        );

        CREATE TABLE IF NOT EXISTS agent_execution_steps (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id      TEXT NOT NULL,
            request_id      TEXT,
            step_type       TEXT NOT NULL,
            agent_role      TEXT NOT NULL,
            input_payload   TEXT,
            output_payload  TEXT,
            confidence_score REAL,
            created_at      TEXT
        );

        -- ── PS26264: AICTE Institution Registry ──────────────────────────
        CREATE TABLE IF NOT EXISTS aicte_institutions (
            aicte_pid       TEXT PRIMARY KEY,
            institution_name TEXT NOT NULL,
            region          TEXT NOT NULL,
            state           TEXT NOT NULL,
            district        TEXT,
            address         TEXT,
            inst_type       TEXT DEFAULT 'Engineering College',
            created_at      TEXT
        );

        -- ── PS26264: AICTE Complaint / Case Tracker ───────────────────────
        CREATE TABLE IF NOT EXISTS aicte_cases (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id         TEXT UNIQUE NOT NULL,
            aicte_pid       TEXT NOT NULL REFERENCES aicte_institutions(aicte_pid),
            institution_name TEXT,
            region          TEXT,
            bureau          TEXT NOT NULL,
            complainant_type TEXT DEFAULT 'Public',
            category        TEXT NOT NULL,
            title           TEXT NOT NULL,
            description     TEXT,
            assigned_officer TEXT,
            status          TEXT DEFAULT 'received',
            sla_days        INTEGER DEFAULT 30,
            sla_deadline    TEXT,
            disposed_at     TEXT,
            linked_case_ids TEXT DEFAULT '[]',
            created_at      TEXT NOT NULL,
            updated_at      TEXT
        );

        -- ── PS26264: Overlap Alert Log ────────────────────────────────────
        CREATE TABLE IF NOT EXISTS aicte_overlap_alerts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            aicte_pid       TEXT NOT NULL,
            rb_case_id      TEXT,
            pgrc_case_id    TEXT,
            overlap_score   REAL,
            overlap_type    TEXT,
            shared_root_cause TEXT,
            recommended_action TEXT,
            reason          TEXT,
            resolved        INTEGER DEFAULT 0,
            created_at      TEXT
        );
        """)
        
        # ── Migration: Add user_id if missing and assign old chats to admin ──
        try:
            conn.execute("ALTER TABLE sessions ADD COLUMN user_id TEXT")
            conn.execute("UPDATE sessions SET user_id='admin' WHERE user_id IS NULL")
        except sqlite3.OperationalError:
            pass # Column already exists

        # ── Migration: Add workflow_type to sessions if missing ─────────────
        try:
            conn.execute("ALTER TABLE sessions ADD COLUMN workflow_type TEXT")
        except sqlite3.OperationalError:
            pass
            
    conn.close()
    _seed_academic_calendar()
    try:
        from campus.migrate_roles import run_migration
        run_migration()
    except Exception as _mig_e:
        print("[DB Init] Notice during role migration:", _mig_e)
    try:
        from campus.rbac_migration import run_migration as run_rbac_migration
        run_rbac_migration()
    except Exception as _mig_e2:
        print("[DB Init] Notice during RBAC migration:", _mig_e2)


# ── SESSION CRUD ─────────────────────────────────────────────────

def create_session(session_id: str, title: str, role: str = "citizen",
                   workflow_type: str = "", user_id: str = "") -> None:
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    with conn:
        conn.execute(
            "INSERT OR IGNORE INTO sessions (id, title, created_at, role, user_id, workflow_type) VALUES (?,?,?,?,?,?)",
            (session_id, title, now, role, user_id, workflow_type)
        )
    conn.close()


def list_sessions(user_id: str = None, role: str = None) -> list[dict]:
    """Retrieve chat sessions via user access rules."""
    conn = get_conn()
    
    if role == "super_admin":
        # Super Admin sees everything
        rows = conn.execute("SELECT * FROM sessions ORDER BY created_at DESC").fetchall()
    elif user_id:
        # Others see only their own sessions
        rows = conn.execute(
            "SELECT * FROM sessions WHERE user_id=? ORDER BY created_at DESC", 
            (user_id,)
        ).fetchall()
    else:
        # Fallback
        rows = []
        
    conn.close()
    return [dict(r) for r in rows]


def get_session(session_id: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_session(session_id: str) -> None:
    conn = get_conn()
    with conn:
        conn.execute("DELETE FROM sessions WHERE id=?", (session_id,))
    conn.close()


def rename_session(session_id: str, new_title: str) -> None:
    conn = get_conn()
    with conn:
        conn.execute("UPDATE sessions SET title=? WHERE id=?", (new_title[:40], session_id))
    conn.close()


# ── MESSAGE CRUD ─────────────────────────────────────────────────

def add_message(session_id: str, role: str, content: str) -> None:
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    with conn:
        conn.execute(
            "INSERT INTO messages (session_id, role, content, created_at) VALUES (?,?,?,?)",
            (session_id, role, content, now)
        )
    conn.close()


def get_messages(session_id: str) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT role, content, created_at FROM messages WHERE session_id=? ORDER BY id",
        (session_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── LIVE CHAT PERSISTENCE ────────────────────────────────────────

def save_live_chat_message(sender_id: str, sender_name: str, sender_role: str, text: str) -> dict:
    msg_id = "msg-" + str(uuid.uuid4())[:8] + "-" + str(int(datetime.datetime.now().timestamp() * 1000))
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    with conn:
        try:
            conn.execute(
                """INSERT INTO live_chat_messages (id, sender_id, sender_name, sender_role, text, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (msg_id, sender_id, sender_name, sender_role, text, now)
            )
        except Exception:
            conn.execute("""
            CREATE TABLE IF NOT EXISTS live_chat_messages (
                id          TEXT PRIMARY KEY,
                sender_id   TEXT NOT NULL,
                sender_name TEXT NOT NULL,
                sender_role TEXT,
                text        TEXT NOT NULL,
                created_at  TEXT NOT NULL
            );
            """)
            conn.execute(
                """INSERT INTO live_chat_messages (id, sender_id, sender_name, sender_role, text, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (msg_id, sender_id, sender_name, sender_role, text, now)
            )
    conn.close()
    return {
        "id": msg_id,
        "sender_id": sender_id,
        "sender_name": sender_name,
        "sender_role": sender_role,
        "text": text,
        "created_at": now,
    }


def get_live_chat_messages(limit: int = 200) -> list[dict]:
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT id, sender_id, sender_name, sender_role, text, created_at FROM live_chat_messages ORDER BY created_at ASC LIMIT ?",
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
    except Exception:
        with conn:
            conn.execute("""
            CREATE TABLE IF NOT EXISTS live_chat_messages (
                id          TEXT PRIMARY KEY,
                sender_id   TEXT NOT NULL,
                sender_name TEXT NOT NULL,
                sender_role TEXT,
                text        TEXT NOT NULL,
                created_at  TEXT NOT NULL
            );
            """)
        rows = conn.execute(
            "SELECT id, sender_id, sender_name, sender_role, text, created_at FROM live_chat_messages ORDER BY created_at ASC LIMIT ?",
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ── REQUEST CRUD ─────────────────────────────────────────────────

def create_request(session_id: str, workflow_type: str, schema: dict) -> str:
    req_id = str(uuid.uuid4())
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    with conn:
        conn.execute(
            """INSERT INTO requests
               (id, session_id, workflow_type, schema_json, status, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?)""",
            (req_id, session_id, workflow_type, json.dumps(schema), "CREATED", now, now)
        )
    conn.close()
    return req_id



def update_request_status(req_id: str, status: str, policy_result: str = "",
                          policy_reason: str = "", alternatives: list = None) -> None:
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    with conn:
        conn.execute(
            """UPDATE requests
               SET status=?, policy_result=?, policy_reason=?, alternatives=?, updated_at=?
               WHERE id=?""",
            (status, policy_result, policy_reason,
             json.dumps(alternatives or []), now, req_id)
        )
    conn.close()


def get_request(req_id: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM requests WHERE id=?", (req_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_session_requests(session_id: str) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM requests WHERE session_id=? ORDER BY created_at",
        (session_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── LOG CRUD ─────────────────────────────────────────────────────

def add_log(session_id: str, message: str, level: str = "INFO") -> None:
    now = datetime.datetime.now().strftime("%H:%M:%S")
    conn = get_conn()
    with conn:
        conn.execute(
            "INSERT INTO logs (session_id, level, message, created_at) VALUES (?,?,?,?)",
            (session_id, level, f"[{now}] {message}", now)
        )
    conn.close()


def get_logs(session_id: str) -> list[str]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT message FROM logs WHERE session_id=? ORDER BY id",
        (session_id,)
    ).fetchall()
    conn.close()
    return [r["message"] for r in rows]


# ── AUDIT CRUD ───────────────────────────────────────────────────

def add_audit(session_id: str, actor_role: str, action: str,
              target: str, result: str) -> None:
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    with conn:
        conn.execute(
            "INSERT INTO audit (session_id, actor_role, action, target, result, created_at) VALUES (?,?,?,?,?,?)",
            (session_id, actor_role, action, target, result, now)
        )
    conn.close()


# ── KPI TRACKING ─────────────────────────────────────────────────

def record_kpi(session_id: str, workflow_type: str,
               submitted_at: str, outcome: str, loops_used: int) -> None:
    resolved_at = datetime.datetime.now().isoformat()
    try:
        s = datetime.datetime.fromisoformat(submitted_at)
        r = datetime.datetime.fromisoformat(resolved_at)
        mins = (r - s).total_seconds() / 60
    except Exception:
        mins = 0.0
    conn = get_conn()
    with conn:
        conn.execute(
            """INSERT INTO kpis
               (session_id, workflow_type, submitted_at, resolved_at, resolution_mins, outcome, loops_used)
               VALUES (?,?,?,?,?,?,?)""",
            (session_id, workflow_type, submitted_at, resolved_at, mins, outcome, loops_used)
        )
    conn.close()


def get_kpi_summary() -> dict:
    """Aggregate KPI stats across all sessions."""
    conn = get_conn()
    rows = conn.execute("SELECT * FROM kpis").fetchall()
    conn.close()
    if not rows:
        return {}
    total = len(rows)
    resolved = sum(1 for r in rows if r["outcome"] in ("approved", "resolved"))
    avg_mins = sum(r["resolution_mins"] for r in rows) / total if total else 0
    by_type: dict = {}
    for r in rows:
        wt = r["workflow_type"]
        by_type.setdefault(wt, {"total": 0, "resolved": 0})
        by_type[wt]["total"] += 1
        if r["outcome"] in ("approved", "resolved"):
            by_type[wt]["resolved"] += 1
    return {
        "total_requests": total,
        "resolved": resolved,
        "resolution_rate_pct": round(resolved / total * 100, 1) if total else 0,
        "avg_resolution_mins": round(avg_mins, 1),
        "by_workflow": by_type,
    }


# ── BOOKING CRUD (persistent, replaces in-memory dicts) ──────────

def is_slot_booked(resource_id: str, date: str, time_slot: str) -> bool:
    """Check DB for a confirmed booking collision."""
    conn = get_conn()
    row = conn.execute(
        "SELECT id FROM bookings WHERE resource_id=? AND date=? AND time_slot=? AND status='confirmed'",
        (resource_id.upper(), date, time_slot),
    ).fetchone()
    conn.close()
    return row is not None


def create_booking(resource_id: str, resource_type: str, date: str,
                   time_slot: str, session_id: str = "") -> str:
    """Persist a confirmed booking. Returns booking id."""
    import uuid as _uuid
    bid = str(_uuid.uuid4())
    now = datetime.datetime.now().isoformat()
    # Bookings expire after 24h for lab/room; extend if needed
    expires = (datetime.datetime.now() + datetime.timedelta(hours=24)).isoformat()
    conn = get_conn()
    with conn:
        conn.execute(
            """INSERT OR IGNORE INTO bookings
               (id, resource_id, resource_type, date, time_slot, session_id, status, created_at, expires_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (bid, resource_id.upper(), resource_type, date, time_slot, session_id, "confirmed", now, expires),
        )
    conn.close()
    return bid


def expire_old_bookings() -> int:
    """Mark bookings past their expires_at as expired. Returns count changed."""
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    cur = conn.execute(
        "UPDATE bookings SET status='expired' WHERE expires_at < ? AND status='confirmed'", (now,)
    )
    count = cur.rowcount
    conn.commit()
    conn.close()
    return count


# ── RETRY CRUD (structured — no string parsing) ───────────────────

def increment_retry(req_id: str) -> int:
    """Bump retry_count and last_attempt. Returns new retry count."""
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    conn.execute(
        "UPDATE requests SET retry_count = retry_count + 1, last_attempt=?, status='pending' WHERE id=?",
        (now, req_id),
    )
    row = conn.execute("SELECT retry_count FROM requests WHERE id=?", (req_id,)).fetchone()
    conn.commit()
    conn.close()
    return row["retry_count"] if row else 0


# ── SCHEDULER LOG ──────────────────────────────────────────────────

def log_scheduler_job(job_name: str, outcome: str, detail: str = "") -> None:
    """Write a structured scheduler job log entry."""
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    with conn:
        conn.execute(
            "INSERT INTO scheduler_logs (job_name, executed_at, outcome, detail) VALUES (?,?,?,?)",
            (job_name, now, outcome, detail),
        )
    conn.close()


def get_scheduler_logs(limit: int = 50) -> list[dict]:
    """Return recent scheduler log entries for UI display."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM scheduler_logs ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── AGENT EXECUTION STEPS CRUD ─────────────────────────────────────

def add_agent_execution_step(session_id: str, request_id: str, step_type: str, agent_role: str,
                             input_payload: dict, output_payload: dict, confidence_score: float = 1.0) -> None:
    """Save an autonomous loop trace step to the database."""
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    with conn:
        conn.execute(
            """INSERT INTO agent_execution_steps
               (session_id, request_id, step_type, agent_role, input_payload, output_payload, confidence_score, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (session_id, request_id, step_type, agent_role, json.dumps(input_payload), json.dumps(output_payload), confidence_score, now)
        )
    conn.close()


def get_agent_execution_steps(session_id: str, request_id: str = None) -> list[dict]:
    """Retrieve execution steps for audit logs or explanation drawers."""
    conn = get_conn()
    if request_id:
        rows = conn.execute(
            "SELECT * FROM agent_execution_steps WHERE session_id = ? AND request_id = ? ORDER BY id ASC",
            (session_id, request_id)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM agent_execution_steps WHERE session_id = ? ORDER BY id ASC",
            (session_id,)
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── INIT ON IMPORT ───────────────────────────────────────────────
init_db()


# ═══════════════════════════════════════════════════════════════════
# PS26264 — AICTE INSTITUTION REGISTRY
# ═══════════════════════════════════════════════════════════════════

def get_all_institutions() -> list[dict]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM aicte_institutions ORDER BY institution_name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_institution(aicte_pid: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM aicte_institutions WHERE aicte_pid=?", (aicte_pid,)).fetchone()
    conn.close()
    return dict(row) if row else None


def upsert_institution(aicte_pid: str, institution_name: str, region: str, state: str,
                       district: str = "", address: str = "", inst_type: str = "Engineering College") -> None:
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    with conn:
        conn.execute(
            """INSERT OR IGNORE INTO aicte_institutions
               (aicte_pid, institution_name, region, state, district, address, inst_type, created_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (aicte_pid, institution_name, region, state, district, address, inst_type, now)
        )
    conn.close()


# ═══════════════════════════════════════════════════════════════════
# PS26264 — AICTE CASE CRUD
# ═══════════════════════════════════════════════════════════════════

def create_aicte_case(case_id: str, aicte_pid: str, institution_name: str, region: str,
                      bureau: str, complainant_type: str, category: str, title: str,
                      description: str = "", assigned_officer: str = "",
                      sla_days: int = 30, status: str = "received") -> str:
    now = datetime.datetime.now().isoformat()
    sla_deadline = (datetime.datetime.now() + datetime.timedelta(days=sla_days)).isoformat()
    conn = get_conn()
    with conn:
        conn.execute(
            """INSERT OR IGNORE INTO aicte_cases
               (case_id, aicte_pid, institution_name, region, bureau, complainant_type, category,
                title, description, assigned_officer, status, sla_days, sla_deadline, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (case_id, aicte_pid, institution_name, region, bureau, complainant_type, category,
             title, description, assigned_officer, status, sla_days, sla_deadline, now, now)
        )
    conn.close()
    return case_id


def list_aicte_cases(bureau: str = None, status: str = None, aicte_pid: str = None,
                     region: str = None, category: str = None, limit: int = 200) -> list[dict]:
    conn = get_conn()
    clauses, params = [], []
    if bureau:
        clauses.append("UPPER(bureau)=UPPER(?)")
        params.append(bureau.strip())
    if status:
        clauses.append("status=?")
        params.append(status)
    if aicte_pid:
        clauses.append("aicte_pid=?")
        params.append(aicte_pid)
    if region:
        reg_clean = region.strip().upper().replace("_", "").replace("-", "").replace("REGION", "").strip()
        clauses.append("UPPER(REPLACE(REPLACE(region, '-', ''), ' ', '')) LIKE ?")
        params.append(f"%{reg_clean}%")
    if category:
        clauses.append("category=?")
        params.append(category)
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    rows = conn.execute(
        f"SELECT * FROM aicte_cases {where} ORDER BY created_at DESC LIMIT ?",
        (*params, limit)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_aicte_case(case_id: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM aicte_cases WHERE case_id=?", (case_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def update_aicte_case_status(case_id: str, status: str, assigned_officer: str = None,
                             linked_case_ids: list = None) -> None:
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    with conn:
        if assigned_officer is not None and linked_case_ids is not None:
            conn.execute(
                """UPDATE aicte_cases SET status=?, assigned_officer=?, linked_case_ids=?, updated_at=?
                   WHERE case_id=?""",
                (status, assigned_officer, json.dumps(linked_case_ids), now, case_id)
            )
        elif assigned_officer is not None:
            conn.execute(
                "UPDATE aicte_cases SET status=?, assigned_officer=?, updated_at=? WHERE case_id=?",
                (status, assigned_officer, now, case_id)
            )
        else:
            conn.execute(
                "UPDATE aicte_cases SET status=?, updated_at=? WHERE case_id=?",
                (status, now, case_id)
            )
        if status == "disposed":
            conn.execute(
                "UPDATE aicte_cases SET disposed_at=? WHERE case_id=?", (now, case_id)
            )
    conn.close()


def get_overlap_cases() -> list[dict]:
    """Find all institutions with concurrent active cases in BOTH RB and PGRC."""
    conn = get_conn()
    rows = conn.execute("""
        SELECT aicte_pid, institution_name, region,
               GROUP_CONCAT(DISTINCT bureau) as bureaus,
               COUNT(*) as total_cases
        FROM aicte_cases
        WHERE status NOT IN ('disposed')
        GROUP BY aicte_pid
        HAVING bureaus LIKE '%RB%' AND bureaus LIKE '%PGRC%'
        ORDER BY total_cases DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_cases_by_institution(aicte_pid: str) -> list[dict]:
    """Return all cases for an institution, grouped with their bureau."""
    return list_aicte_cases(aicte_pid=aicte_pid, limit=500)


def get_sla_breached_cases() -> list[dict]:
    """Return all cases past their SLA deadline that aren't disposed."""
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM aicte_cases WHERE sla_deadline < ? AND status NOT IN ('disposed') ORDER BY sla_deadline ASC",
        (now,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_overlap_alert(aicte_pid: str, rb_case_id: str, pgrc_case_id: str,
                       overlap_score: float, overlap_type: str, shared_root_cause: str,
                       recommended_action: str, reason: str) -> None:
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    with conn:
        conn.execute(
            """INSERT OR IGNORE INTO aicte_overlap_alerts
               (aicte_pid, rb_case_id, pgrc_case_id, overlap_score, overlap_type,
                shared_root_cause, recommended_action, reason, created_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (aicte_pid, rb_case_id, pgrc_case_id, overlap_score, overlap_type,
             shared_root_cause, recommended_action, reason, now)
        )
    conn.close()


def get_overlap_alerts(resolved: bool = False) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM aicte_overlap_alerts WHERE resolved=? ORDER BY overlap_score DESC",
        (1 if resolved else 0,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_case_kpis() -> dict:
    """Return high-level KPI counts for the AICTE Dashboard."""
    conn = get_conn()
    total = conn.execute("SELECT COUNT(*) FROM aicte_cases").fetchone()[0]
    received = conn.execute("SELECT COUNT(*) FROM aicte_cases WHERE status='received'").fetchone()[0]
    under_process = conn.execute("SELECT COUNT(*) FROM aicte_cases WHERE status='under_process'").fetchone()[0]
    transferred = conn.execute("SELECT COUNT(*) FROM aicte_cases WHERE status='transferred'").fetchone()[0]
    escalated = conn.execute("SELECT COUNT(*) FROM aicte_cases WHERE status='escalated'").fetchone()[0]
    disposed = conn.execute("SELECT COUNT(*) FROM aicte_cases WHERE status='disposed'").fetchone()[0]
    now = datetime.datetime.now().isoformat()
    sla_breached = conn.execute(
        "SELECT COUNT(*) FROM aicte_cases WHERE sla_deadline < ? AND status NOT IN ('disposed')", (now,)
    ).fetchone()[0]
    overlaps = conn.execute("""
        SELECT COUNT(DISTINCT aicte_pid) FROM aicte_cases
        WHERE status NOT IN ('disposed')
        GROUP BY aicte_pid
        HAVING GROUP_CONCAT(DISTINCT bureau) LIKE '%RB%' AND GROUP_CONCAT(DISTINCT bureau) LIKE '%PGRC%'
    """).fetchone()
    overlap_count = overlaps[0] if overlaps else 0

    rb_total = conn.execute("SELECT COUNT(*) FROM aicte_cases WHERE bureau='RB'").fetchone()[0]
    pgrc_total = conn.execute("SELECT COUNT(*) FROM aicte_cases WHERE bureau='PGRC'").fetchone()[0]
    ro_total = conn.execute("SELECT COUNT(*) FROM aicte_cases WHERE bureau='RO'").fetchone()[0]
    conn.close()
    return {
        "total": total,
        "received": received,
        "under_process": under_process,
        "transferred": transferred,
        "escalated": escalated,
        "disposed": disposed,
        "sla_breached": sla_breached,
        "overlapping_institutions": overlap_count,
        "by_bureau": {"RB": rb_total, "PGRC": pgrc_total, "RO": ro_total},
    }


# ═══════════════════════════════════════════════════════════════════
# PS26264 — SEED REALISTIC DEMO DATA
# ═══════════════════════════════════════════════════════════════════

_SEEDED = False

def seed_aicte_demo_data():
    """Seed institutions and cases for PS26264 demo. Idempotent via INSERT OR IGNORE."""
    global _SEEDED
    if _SEEDED:
        return
    _SEEDED = True

    # ── Institutions ─────────────────────────────────────────────
    institutions = [
        ("1-109723481", "Shri Ram Institute of Technology", "Northern", "Uttar Pradesh", "Lucknow", "Engineering College"),
        ("1-204561892", "KL University", "Southern", "Andhra Pradesh", "Guntur", "Deemed University"),
        ("1-376234110", "Thakur College of Engineering", "Western", "Maharashtra", "Mumbai", "Engineering College"),
        ("1-445871203", "Kalinga Institute of Technology", "Eastern", "Odisha", "Bhubaneswar", "Engineering College"),
        ("1-512398067", "SRM Institute of Science and Technology", "Southern", "Tamil Nadu", "Chennai", "Deemed University"),
        ("1-631047285", "GLA University", "Northern", "Uttar Pradesh", "Mathura", "Private University"),
        ("1-788234501", "Amity University Rajasthan", "Northern", "Rajasthan", "Jaipur", "Private University"),
        ("1-890123456", "VIT Bhopal University", "Central", "Madhya Pradesh", "Bhopal", "Deemed University"),
        ("1-923456789", "Chandigarh University", "Northern", "Punjab", "Mohali", "Private University"),
        ("1-101234567", "Dr. A.P.J. Abdul Kalam Technical University", "Northern", "Uttar Pradesh", "Lucknow", "State University"),
    ]

    for pid, name, region, state, district, itype in institutions:
        upsert_institution(pid, name, region, state, district, "", itype)

    # ── Cases (realistic AICTE scenarios) ────────────────────────
    import datetime as dt
    now = dt.datetime.now()

    cases = [
        # 🔴 OVERLAP SCENARIO 1: Shri Ram — Faculty non-payment (PGRC) + cadre ratio (RB)
        {
            "case_id": "AICTE-2026-RB-0042",
            "aicte_pid": "1-109723481",
            "institution_name": "Shri Ram Institute of Technology",
            "region": "Northern",
            "bureau": "RB",
            "complainant_type": "Stakeholder",
            "category": "Faculty Deficiency",
            "title": "Faculty cadre ratio non-compliance — insufficient PhD-qualified faculty",
            "description": "Inspection reveals faculty cadre ratio below AICTE norms. Only 18 of required 42 sanctioned faculty positions filled. No Assistant Professor with PhD in core departments.",
            "assigned_officer": "Dr. Ramesh Gupta (RB)",
            "status": "under_process",
            "sla_days": 45,
            "created_at": (now - dt.timedelta(days=12)).isoformat(),
        },
        {
            "case_id": "AICTE-2026-PGRC-0089",
            "aicte_pid": "1-109723481",
            "institution_name": "Shri Ram Institute of Technology",
            "region": "Northern",
            "bureau": "PGRC",
            "complainant_type": "Faculty",
            "category": "Non-payment of Salary",
            "title": "Non-payment of faculty salary for 4 consecutive months",
            "description": "Multiple faculty members have filed grievances regarding non-payment of salary since July 2026. Management cites financial difficulty. 23 teaching staff affected.",
            "assigned_officer": "Ms. Priya Verma (PGRC)",
            "status": "escalated",
            "sla_days": 30,
            "created_at": (now - dt.timedelta(days=8)).isoformat(),
        },
        # 🔴 OVERLAP SCENARIO 2: Thakur College — Capitation fee (PGRC) + fee regulation (RB)
        {
            "case_id": "AICTE-2026-RB-0055",
            "aicte_pid": "1-376234110",
            "institution_name": "Thakur College of Engineering",
            "region": "Western",
            "bureau": "RB",
            "complainant_type": "Stakeholder",
            "category": "Fee Regulation Violation",
            "title": "Excess fee collection beyond AICTE approved fee structure",
            "description": "Complaints regarding collection of fees beyond the AICTE approved structure for 2026-27. Excess ₹45,000 per student collected under various miscellaneous heads.",
            "assigned_officer": "Mr. Suresh Iyer (RB)",
            "status": "under_process",
            "sla_days": 30,
            "created_at": (now - dt.timedelta(days=5)).isoformat(),
        },
        {
            "case_id": "AICTE-2026-PGRC-0112",
            "aicte_pid": "1-376234110",
            "institution_name": "Thakur College of Engineering",
            "region": "Western",
            "bureau": "PGRC",
            "complainant_type": "Student",
            "category": "Capitation Fee",
            "title": "Capitation fee demand from admitted students",
            "description": "Students allotted through centralized admission process are being asked to pay additional ₹50,000 as 'development fee' not in official fee structure. Refund requests denied.",
            "assigned_officer": "Dr. Anita Sharma (PGRC)",
            "status": "received",
            "sla_days": 30,
            "created_at": (now - dt.timedelta(days=2)).isoformat(),
        },
        # ⚠️ SLA BREACH SCENARIO: KL University — approaching deadline
        {
            "case_id": "AICTE-2026-PGRC-0034",
            "aicte_pid": "1-204561892",
            "institution_name": "KL University",
            "region": "Southern",
            "bureau": "PGRC",
            "complainant_type": "Student",
            "category": "Ragging",
            "title": "Ragging complaint — senior students intimidating juniors in hostel",
            "description": "Multiple juniors reported systematic ragging in hostel by final year students. Incident report filed to anti-ragging committee but no action taken for 28 days.",
            "assigned_officer": "Ms. Kavita Singh (PGRC)",
            "status": "escalated",
            "sla_days": 30,
            "created_at": (now - dt.timedelta(days=31)).isoformat(),
        },
        # ✅ DISPOSED — complete with audit history
        {
            "case_id": "AICTE-2026-RB-0021",
            "aicte_pid": "1-445871203",
            "institution_name": "Kalinga Institute of Technology",
            "region": "Eastern",
            "bureau": "RB",
            "complainant_type": "Public",
            "category": "Infrastructure Deficiency",
            "title": "Laboratory equipment deficiency — below AICTE norms",
            "description": "EVC inspection revealed laboratories lacking minimum AICTE-prescribed equipment in CSE and ECE departments. Compliance notice issued.",
            "assigned_officer": "Mr. Deepak Nair (RB)",
            "status": "disposed",
            "sla_days": 60,
            "created_at": (now - dt.timedelta(days=75)).isoformat(),
        },
        # Additional independent cases for volume
        {
            "case_id": "AICTE-2026-PGRC-0078",
            "aicte_pid": "1-512398067",
            "institution_name": "SRM Institute of Science and Technology",
            "region": "Southern",
            "bureau": "PGRC",
            "complainant_type": "Faculty",
            "category": "Service Matters",
            "title": "Wrongful termination of contractual faculty",
            "description": "26 contractual faculty members terminated without notice after raising concerns about lab safety conditions. Reinstatement sought.",
            "assigned_officer": "Dr. Ravi Kumar (PGRC)",
            "status": "under_process",
            "sla_days": 45,
            "created_at": (now - dt.timedelta(days=18)).isoformat(),
        },
        {
            "case_id": "AICTE-2026-RO-0016",
            "aicte_pid": "1-631047285",
            "institution_name": "GLA University",
            "region": "Northern",
            "bureau": "RO",
            "complainant_type": "Stakeholder",
            "category": "Admissions Irregularity",
            "title": "Over-admission beyond sanctioned intake in B.Tech CSE",
            "description": "Regional office inspection found 340 students admitted against sanctioned intake of 240 in B.Tech CSE programme for 2026-27 academic year.",
            "assigned_officer": "RO Northern Cell",
            "status": "transferred",
            "sla_days": 30,
            "created_at": (now - dt.timedelta(days=22)).isoformat(),
        },
        {
            "case_id": "AICTE-2026-PGRC-0145",
            "aicte_pid": "1-788234501",
            "institution_name": "Amity University Rajasthan",
            "region": "Northern",
            "bureau": "PGRC",
            "complainant_type": "Student",
            "category": "Academic Issues",
            "title": "Examinations conducted without prescribed syllabus coverage",
            "description": "Students allege end-semester exams conducted with questions outside the AICTE model curriculum. Marks disputed and revaluation denied by management.",
            "assigned_officer": "Ms. Shweta Patel (PGRC)",
            "status": "received",
            "sla_days": 30,
            "created_at": (now - dt.timedelta(days=3)).isoformat(),
        },
        {
            "case_id": "AICTE-2026-RB-0071",
            "aicte_pid": "1-923456789",
            "institution_name": "Chandigarh University",
            "region": "Northern",
            "bureau": "RB",
            "complainant_type": "Stakeholder",
            "category": "Faculty Deficiency",
            "title": "Insufficient visiting faculty against permanent positions",
            "description": "More than 60% teaching load handled by visiting faculty not on rolls. Permanent faculty count misrepresented in AICTE data portal submissions.",
            "assigned_officer": "Mr. Arvind Mehta (RB)",
            "status": "under_process",
            "sla_days": 45,
            "created_at": (now - dt.timedelta(days=14)).isoformat(),
        },
    ]

    for c in cases:
        try:
            now_str = c.pop("created_at")
            sla_days = c.pop("sla_days", 30)
            sla_deadline = (dt.datetime.fromisoformat(now_str) + dt.timedelta(days=sla_days)).isoformat()
            conn = get_conn()
            with conn:
                conn.execute(
                    """INSERT OR IGNORE INTO aicte_cases
                       (case_id, aicte_pid, institution_name, region, bureau, complainant_type,
                        category, title, description, assigned_officer, status, sla_days,
                        sla_deadline, created_at, updated_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        c["case_id"], c["aicte_pid"], c["institution_name"], c["region"],
                        c["bureau"], c["complainant_type"], c["category"], c["title"],
                        c["description"], c["assigned_officer"], c["status"], sla_days,
                        sla_deadline, now_str, now_str
                    )
                )
            conn.close()
            # Mark disposed cases
            if c["status"] == "disposed":
                disposed_at = (dt.datetime.fromisoformat(now_str) + dt.timedelta(days=sla_days - 10)).isoformat()
                conn = get_conn()
                with conn:
                    conn.execute("UPDATE aicte_cases SET disposed_at=? WHERE case_id=?",
                                 (disposed_at, c["case_id"]))
                conn.close()
        except Exception as e:
            pass


# Seed on import
try:
    seed_aicte_demo_data()
except Exception:
    pass
