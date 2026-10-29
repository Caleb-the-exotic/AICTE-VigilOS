# ============================================================
# campus/db.py — PostgreSQL Authoritative Persistence Layer
# ============================================================
# All campus workflows, messages, logs, audit trails, and accounts
# are stored here. PostgreSQL is the sole production source of truth.
# ============================================================

import os
import sys
import json
import datetime
import uuid
import re
from collections.abc import Mapping

try:
    import psycopg2
    from psycopg2.pool import ThreadedConnectionPool
    from psycopg2.extras import RealDictCursor
    HAS_PG = True
except ImportError:
    HAS_PG = False

_POOL = None

def get_pool():
    global _POOL
    if _POOL is None:
        db_url = os.getenv("DATABASE_URL") or "postgresql://postgres:postgres@localhost:5432/campusflow"
        if db_url.startswith("postgres://"):
            db_url = "postgresql://" + db_url[len("postgres://"):]
        try:
            _POOL = ThreadedConnectionPool(minconn=1, maxconn=25, dsn=db_url)
        except Exception as e:
            print(f"[PostgreSQL Connection Pool Error] {e}", file=sys.stderr)
            raise e
    return _POOL

class UniversalRow(Mapping):
    """
    Unified dict-like row supporting key access (row['name']),
    attribute/get access (row.get('name')), and positional access (row[0]),
    ensuring 100% compatibility with SQLite row access and JSON serialization.
    """
    def __init__(self, d):
        self._d = d if isinstance(d, dict) else dict(d)
        self._values = None

    def __getitem__(self, key):
        if isinstance(key, int):
            if self._values is None:
                self._values = list(self._d.values())
            return self._values[key]
        return self._d[key]

    def __iter__(self):
        return iter(self._d)

    def __len__(self):
        return len(self._d)

    def __repr__(self):
        return repr(self._d)

    def get(self, key, default=None):
        return self._d.get(key, default)

    def keys(self):
        return self._d.keys()

    def values(self):
        return self._d.values()

    def items(self):
        return self._d.items()

class PGCursorWrapper:
    def __init__(self, cur):
        self._cur = cur

    def _adapt_sql(self, sql: str) -> str:
        s = sql.strip()
        # Support PRAGMA table_info and PRAGMA foreign_keys
        if s.upper().startswith("PRAGMA"):
            if "FOREIGN_KEYS" in s.upper():
                return "SELECT 1 AS foreign_keys"
            if "TABLE_INFO" in s.upper():
                m = re.search(r'(?i)PRAGMA\s+table_info\((\w+)\)', s)
                if m:
                    tbl = m.group(1).lower()
                    return f"SELECT ordinal_position AS cid, column_name AS name, data_type AS type FROM information_schema.columns WHERE table_name = '{tbl}' ORDER BY ordinal_position"
            return ""

        # Translate INSERT OR IGNORE INTO <table> (...)
        if "INSERT OR IGNORE" in s.upper():
            s = re.sub(r'(?i)INSERT\s+OR\s+IGNORE\s+INTO', 'INSERT INTO', s)
            if "ON CONFLICT" not in s.upper():
                s = s + " ON CONFLICT DO NOTHING"

        # Translate INSERT OR REPLACE INTO internal_idempotency_keys
        if "INSERT OR REPLACE INTO" in s.upper() and "INTERNAL_IDEMPOTENCY_KEYS" in s.upper():
            s = re.sub(r'(?i)INSERT\s+OR\s+REPLACE\s+INTO\s+internal_idempotency_keys', 'INSERT INTO internal_idempotency_keys', s)
            if "ON CONFLICT" not in s.upper():
                s = s + " ON CONFLICT (idempotency_key) DO UPDATE SET response_json = EXCLUDED.response_json, message_id = EXCLUDED.message_id"

        # Convert ? placeholders to %s while preserving literal %
        if "?" in s:
            s = s.replace("?", "\x00PARAM\x00")
            s = s.replace("%", "%%")
            s = s.replace("\x00PARAM\x00", "%s")

        return s

    def execute(self, sql, params=None):
        adapted = self._adapt_sql(sql)
        if not adapted:
            return self

        if params is not None:
            if not isinstance(params, (tuple, list)):
                params = (params,)
            self._cur.execute(adapted, params)
        else:
            self._cur.execute(adapted)
        return self

    def executemany(self, sql, params_seq):
        adapted = self._adapt_sql(sql)
        if not adapted:
            return self
        self._cur.executemany(adapted, params_seq)
        return self

    def fetchall(self):
        rows = self._cur.fetchall()
        return [UniversalRow(r) for r in rows]

    def fetchone(self):
        r = self._cur.fetchone()
        return UniversalRow(r) if r is not None else None

    @property
    def rowcount(self):
        return self._cur.rowcount

    @property
    def description(self):
        return self._cur.description

    def close(self):
        self._cur.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

class PGConnectionWrapper:
    def __init__(self, conn, pool=None):
        self._conn = conn
        self._pool = pool
        self._closed = False

    def cursor(self):
        return PGCursorWrapper(self._conn.cursor(cursor_factory=RealDictCursor))

    def execute(self, sql, params=None):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def executescript(self, sql_script):
        cur = self.cursor()
        for statement in sql_script.split(';'):
            cleaned = statement.strip()
            if cleaned:
                cur.execute(cleaned)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        try:
            self._conn.rollback()
        except Exception:
            pass

    def close(self):
        if not self._closed:
            self._closed = True
            if self._pool is not None:
                self._pool.putconn(self._conn)
            else:
                self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type:
                self.rollback()
            else:
                self.commit()
        finally:
            self.close()

def get_conn():
    """
    Return a thread-safe connection to the authoritative PostgreSQL database.
    Centralized single source of truth for AICTE VigilOS.
    """
    pool = get_pool()
    raw_conn = pool.getconn()
    return PGConnectionWrapper(raw_conn, pool)




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
    """Create all PostgreSQL tables, indexes, and initial seeds."""
    from campus.pg_schema import init_postgres_schema
    conn = get_conn()
    try:
        init_postgres_schema(conn)
    finally:
        conn.close()

    _seed_academic_calendar()


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
            "SELECT id, sender_id, sender_name, sender_role, text, created_at FROM live_chat_messages WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT ?",
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
                created_at  TEXT NOT NULL,
                deleted_at  TEXT
            );
            """)
        try:
            rows = conn.execute(
                "SELECT id, sender_id, sender_name, sender_role, text, created_at FROM live_chat_messages WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT ?",
                (limit,)
            ).fetchall()
            return [dict(r) for r in rows]
        except Exception:
            return []
    finally:
        conn.close()


def delete_live_chat_message(message_id: str, actor_id: str = "admin") -> bool:
    """Soft delete a live chat message and record audit trail."""
    conn = get_conn()
    now = datetime.datetime.now().isoformat()
    try:
        with conn:
            conn.execute(
                "UPDATE live_chat_messages SET deleted_at = ? WHERE id = ?",
                (now, message_id)
            )
            try:
                conn.execute(
                    """INSERT INTO assignment_audit (user_id, changed_by, action, created_at)
                       VALUES (?, ?, 'DELETE_LIVE_CHAT_MESSAGE', ?)""",
                    (actor_id, actor_id, now)
                )
            except Exception:
                pass
        return True
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

def _format_institution_record(row) -> dict:
    if not row:
        return {}
    d = dict(row)
    images_raw = d.get("images_json") or "[]"
    try:
        d["images"] = json.loads(images_raw) if isinstance(images_raw, str) else list(images_raw)
    except Exception:
        d["images"] = []
    if "city" not in d or not d["city"]:
        d["city"] = d.get("district") or ""
    if "approval_status" not in d or not d["approval_status"]:
        d["approval_status"] = "AICTE Approved (EOA 2026-27)"
    if "established_year" not in d or d["established_year"] is None:
        d["established_year"] = 2000
    if "total_faculty" not in d or d["total_faculty"] is None:
        d["total_faculty"] = 50
    if "total_students" not in d or d["total_students"] is None:
        d["total_students"] = 1000
    return d


def get_all_institutions() -> list[dict]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM aicte_institutions ORDER BY institution_name").fetchall()
    conn.close()
    return [_format_institution_record(r) for r in rows]


def get_institution(aicte_pid: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM aicte_institutions WHERE aicte_pid=?", (aicte_pid,)).fetchone()
    conn.close()
    return _format_institution_record(row) if row else None


def save_institution(inst_data: dict) -> dict:
    """Save or update an institutional portfolio in the persistent database."""
    pid = inst_data.get("aicte_pid")
    if not pid:
        raise ValueError("aicte_pid is required to save an institution")

    now = datetime.datetime.now().isoformat()
    images = inst_data.get("images", [])
    images_json = json.dumps(images if isinstance(images, list) else [])
    
    name = inst_data.get("institution_name", "").strip()
    region = inst_data.get("region", "Central").strip()
    state = inst_data.get("state", "").strip()
    city = inst_data.get("city", "").strip()
    district = inst_data.get("district", "").strip() or city
    address = inst_data.get("address", "").strip()
    inst_type = inst_data.get("inst_type", "Engineering College").strip()
    approval_status = inst_data.get("approval_status", "AICTE Approved (EOA 2026-27)").strip()
    principal_name = inst_data.get("principal_name", "").strip()
    contact_email = inst_data.get("contact_email", "").strip()
    contact_phone = inst_data.get("contact_phone", "").strip()
    website = inst_data.get("website", "").strip()
    established_year = int(inst_data.get("established_year") or 2000)
    total_faculty = int(inst_data.get("total_faculty") or 50)
    total_students = int(inst_data.get("total_students") or 1000)

    conn = get_conn()
    with conn:
        existing = conn.execute("SELECT * FROM aicte_institutions WHERE aicte_pid=?", (pid,)).fetchone()
        if existing:
            ex_d = dict(existing)
            name = name or ex_d.get("institution_name", "")
            region = region or ex_d.get("region", "")
            state = state or ex_d.get("state", "")
            city = city or ex_d.get("city", "")
            district = district or ex_d.get("district", "")
            address = address or ex_d.get("address", "")
            inst_type = inst_type or ex_d.get("inst_type", "")
            approval_status = approval_status or ex_d.get("approval_status", "")
            principal_name = principal_name or ex_d.get("principal_name", "")
            contact_email = contact_email or ex_d.get("contact_email", "")
            contact_phone = contact_phone or ex_d.get("contact_phone", "")
            website = website or ex_d.get("website", "")
            if not inst_data.get("images") and ex_d.get("images_json"):
                images_json = ex_d["images_json"]
            if not inst_data.get("established_year") and ex_d.get("established_year"):
                established_year = ex_d["established_year"]
            if not inst_data.get("total_faculty") and ex_d.get("total_faculty"):
                total_faculty = ex_d["total_faculty"]
            if not inst_data.get("total_students") and ex_d.get("total_students"):
                total_students = ex_d["total_students"]

            conn.execute("""
                UPDATE aicte_institutions SET
                    institution_name = ?,
                    region = ?,
                    state = ?,
                    city = ?,
                    district = ?,
                    address = ?,
                    inst_type = ?,
                    approval_status = ?,
                    principal_name = ?,
                    contact_email = ?,
                    contact_phone = ?,
                    website = ?,
                    established_year = ?,
                    total_faculty = ?,
                    total_students = ?,
                    images_json = ?,
                    updated_at = ?
                WHERE aicte_pid = ?
            """, (
                name, region, state, city, district, address, inst_type,
                approval_status, principal_name, contact_email, contact_phone,
                website, established_year, total_faculty, total_students,
                images_json, now, pid
            ))
        else:
            conn.execute("""
                INSERT INTO aicte_institutions (
                    aicte_pid, institution_name, region, state, city, district,
                    address, inst_type, approval_status, principal_name,
                    contact_email, contact_phone, website, established_year,
                    total_faculty, total_students, images_json, created_at, updated_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                pid, name, region, state, city, district, address, inst_type,
                approval_status, principal_name, contact_email, contact_phone,
                website, established_year, total_faculty, total_students,
                images_json, now, now
            ))

        # Keep case institution references in sync
        conn.execute("""
            UPDATE aicte_cases
            SET institution_name = ?, region = ?, updated_at = ?
            WHERE aicte_pid = ?
        """, (name, region, now, pid))

    conn.close()
    return get_institution(pid)


def upsert_institution(aicte_pid: str, institution_name: str, region: str, state: str,
                       district: str = "", address: str = "", inst_type: str = "Engineering College") -> None:
    save_institution({
        "aicte_pid": aicte_pid,
        "institution_name": institution_name,
        "region": region,
        "state": state,
        "district": district,
        "address": address,
        "inst_type": inst_type,
    })


def delete_institution(aicte_pid: str) -> bool:
    """
    Cascade delete an institution from aicte_institutions and clean up dependencies:
    - aicte_overlap_alerts referencing aicte_pid
    - aicte_cases referencing aicte_pid
    - institution_registrations referencing aicte_pid
    - users affiliated with this institution
    """
    conn = get_conn()
    with conn:
        row = conn.execute("SELECT institution_name FROM aicte_institutions WHERE aicte_pid = ?", (aicte_pid,)).fetchone()
        inst_name = row["institution_name"] if row and hasattr(row, "keys") else (row[0] if row else None)

        conn.execute("DELETE FROM aicte_overlap_alerts WHERE aicte_pid = ?", (aicte_pid,))
        conn.execute("DELETE FROM aicte_cases WHERE aicte_pid = ?", (aicte_pid,))
        conn.execute("""
            UPDATE institution_registrations
            SET created_institution_pid = NULL,
                status = 'rejected',
                rejection_reason = 'Institution record deleted by administrator'
            WHERE created_institution_pid = ?
        """, (aicte_pid,))

        if inst_name:
            conn.execute("UPDATE users SET institution = NULL WHERE LOWER(institution) = LOWER(?)", (inst_name,))

        conn.execute("DELETE FROM aicte_institutions WHERE aicte_pid = ?", (aicte_pid,))
    conn.close()
    return True


# ═══════════════════════════════════════════════════════════════════
# PS26264 — AICTE CASE SEQUENCE GENERATOR
# ═══════════════════════════════════════════════════════════════════

def get_next_case_id(bureau: str, year: int = None) -> str:
    """
    Generate an atomic, concurrency-safe, sequential Case ID on the server.
    Format: AICTE-{year}-{bureau}-{number:04d} (e.g. AICTE-2026-PGRC-0113)
    """
    if not year:
        year = datetime.datetime.now().year
    bureau_clean = bureau.strip().upper() if bureau else "PGRC"
    conn = get_conn()
    with conn:
        conn.execute("""
            INSERT INTO aicte_case_sequences (bureau, year, last_seq)
            VALUES (?, ?, 1)
            ON CONFLICT(bureau, year) DO UPDATE SET last_seq = aicte_case_sequences.last_seq + 1
        """, (bureau_clean, year))
        row = conn.execute(
            "SELECT last_seq FROM aicte_case_sequences WHERE bureau=? AND year=?",
            (bureau_clean, year)
        ).fetchone()
        next_seq = row[0] if row else 1
    conn.close()
    return f"AICTE-{year}-{bureau_clean}-{next_seq:04d}"


# ═══════════════════════════════════════════════════════════════════
# PS26264 — AICTE CASE CRUD
# ═══════════════════════════════════════════════════════════════════

def create_aicte_case(case_id: str, aicte_pid: str, institution_name: str, region: str,
                      bureau: str, complainant_type: str, category: str, title: str,
                      description: str = "", assigned_officer: str = "",
                      sla_days: int = 30, status: str = "received",
                      institution_code: str = "", complainant_user_id: str = "",
                      complainant_name: str = "", complainant_email: str = "",
                      received_at: str = "") -> str:
    now = datetime.datetime.now().isoformat()
    received_time = received_at or now
    sla_deadline = (datetime.datetime.now() + datetime.timedelta(days=sla_days)).isoformat()
    inst_code = institution_code or aicte_pid
    comp_name = complainant_name or complainant_type or "Public"

    conn = get_conn()
    with conn:
        conn.execute(
            """INSERT OR IGNORE INTO aicte_cases
               (case_id, aicte_pid, institution_code, institution_name, region, bureau,
                complainant_user_id, complainant_name, complainant_email, complainant_type,
                category, title, description, assigned_officer, status, sla_days,
                sla_deadline, received_at, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (case_id, aicte_pid, inst_code, institution_name, region, bureau,
             complainant_user_id, comp_name, complainant_email, complainant_type,
             category, title, description, assigned_officer, status, sla_days,
             sla_deadline, received_time, now, now)
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
        if status.strip().lower() == "breached":
            clauses.append("status != 'disposed'")
        else:
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

    cases = [dict(r) for r in rows]
    now = datetime.datetime.now()

    # Authoritative calculation of ageing_days and SLA status
    for c in cases:
        if not c.get("institution_code"):
            c["institution_code"] = c.get("aicte_pid", "")
        if not c.get("complainant_name"):
            c["complainant_name"] = c.get("complainant_type") or "Public"

        r_time = c.get("received_at") or c.get("created_at")
        is_disposed = c.get("status") in ("disposed", "resolved", "closed")

        if is_disposed and (c.get("resolved_at") or c.get("disposed_at")):
            end_time = c.get("resolved_at") or c.get("disposed_at")
            try:
                delta = datetime.datetime.fromisoformat(end_time) - datetime.datetime.fromisoformat(r_time)
                c["ageing_days"] = max(0, delta.days)
            except Exception:
                c["ageing_days"] = 0
        else:
            try:
                delta = now - datetime.datetime.fromisoformat(r_time)
                c["ageing_days"] = max(0, delta.days)
            except Exception:
                c["ageing_days"] = 0

        sla_dl = c.get("sla_deadline")
        if sla_dl and not is_disposed:
            try:
                c["sla_breached"] = now > datetime.datetime.fromisoformat(sla_dl)
            except Exception:
                c["sla_breached"] = False
        else:
            c["sla_breached"] = False

    if status and status.strip().lower() == "breached":
        cases = [c for c in cases if c.get("status") == "breached" or (c.get("ageing_days") or 0) > 30 or c.get("sla_breached")]
    return cases


def get_aicte_case(case_id: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM aicte_cases WHERE case_id=?", (case_id,)).fetchone()
    conn.close()
    if not row:
        return None
    c = dict(row)
    now = datetime.datetime.now()
    r_time = c.get("received_at") or c.get("created_at")
    is_disposed = c.get("status") in ("disposed", "resolved", "closed")
    if is_disposed and (c.get("resolved_at") or c.get("disposed_at")):
        end_time = c.get("resolved_at") or c.get("disposed_at")
        try:
            delta = datetime.datetime.fromisoformat(end_time) - datetime.datetime.fromisoformat(r_time)
            c["ageing_days"] = max(0, delta.days)
        except Exception:
            c["ageing_days"] = 0
    else:
        try:
            delta = now - datetime.datetime.fromisoformat(r_time)
            c["ageing_days"] = max(0, delta.days)
        except Exception:
            c["ageing_days"] = 0
    sla_dl = c.get("sla_deadline")
    if sla_dl and not is_disposed:
        try:
            c["sla_breached"] = now > datetime.datetime.fromisoformat(sla_dl)
        except Exception:
            c["sla_breached"] = False
    else:
        c["sla_breached"] = False
    return c


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


def update_aicte_case_details(case_id: str, updates: dict) -> dict:
    """Update title, description, category, bureau, status, assigned_officer, sla_days, etc."""
    now = datetime.datetime.now().isoformat()
    conn = get_conn()
    cur = conn.cursor()
    allowed = ["title", "description", "category", "bureau", "status", "assigned_officer", "sla_days", "region"]
    set_clauses = []
    params = []
    for f in allowed:
        if f in updates and updates[f] is not None:
            set_clauses.append(f"{f} = ?")
            params.append(updates[f])

    if set_clauses:
        set_clauses.append("updated_at = ?")
        params.append(now)
        params.append(case_id)
        cur.execute(f"UPDATE aicte_cases SET {', '.join(set_clauses)} WHERE case_id = ?", tuple(params))
        if updates.get("status") == "disposed":
            cur.execute("UPDATE aicte_cases SET disposed_at = ? WHERE case_id = ?", (now, case_id))
        conn.commit()
    conn.close()
    return get_aicte_case(case_id)


def delete_aicte_case(case_id: str) -> bool:
    """Permanently delete an AICTE case record from the database."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM aicte_cases WHERE case_id = ?", (case_id,))
    conn.commit()
    conn.close()
    return True



def get_overlap_cases() -> list[dict]:
    """Find all institutions with concurrent active cases in BOTH RB and PGRC."""
    conn = get_conn()
    rows = conn.execute("""
        SELECT aicte_pid, institution_name, region,
               string_agg(DISTINCT bureau, ',') as bureaus,
               COUNT(*) as total_cases
        FROM aicte_cases
        WHERE status NOT IN ('disposed')
        GROUP BY aicte_pid, institution_name, region
        HAVING string_agg(DISTINCT bureau, ',') LIKE '%RB%' AND string_agg(DISTINCT bureau, ',') LIKE '%PGRC%'
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
        SELECT COUNT(*) FROM (
            SELECT aicte_pid
            FROM aicte_cases
            WHERE status NOT IN ('disposed')
            GROUP BY aicte_pid
            HAVING 'RB' = ANY(array_agg(bureau)) 
               AND 'PGRC' = ANY(array_agg(bureau))
               AND NOT ('[]' != ALL(array_agg(COALESCE(linked_case_ids, '[]'))))
        ) sub
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
    # Only seed if table is completely empty
    conn_check = get_conn()
    cur_check = conn_check.cursor()
    cur_check.execute("SELECT COUNT(*) FROM aicte_institutions")
    inst_count = cur_check.fetchone()[0]
    conn_check.close()

    if inst_count == 0:
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
        # [OVERLAP SCENARIO 1]: Shri Ram — Faculty non-payment (PGRC) + cadre ratio (RB)
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
            "assigned_officer": "Hariprasath (Bureau Head)",
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
            "assigned_officer": "Monisha Yathavan (Approval Officer)",
            "status": "escalated",
            "sla_days": 30,
            "created_at": (now - dt.timedelta(days=8)).isoformat(),
        },
        # [OVERLAP SCENARIO 2]: Thakur College — Capitation fee (PGRC) + fee regulation (RB)
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
            "assigned_officer": "Deepan Thangavel (Approval Officer)",
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
            "assigned_officer": "Surya Prakash D (Regional Nodal Officer)",
            "status": "received",
            "sla_days": 30,
            "created_at": (now - dt.timedelta(days=2)).isoformat(),
        },
        # [SLA BREACH SCENARIO]: KL University — approaching deadline
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
            "assigned_officer": "Swetha NC (Regional Nodal Officer)",
            "status": "escalated",
            "sla_days": 30,
            "created_at": (now - dt.timedelta(days=31)).isoformat(),
        },
        # [DISPOSED]: complete with audit history
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
            "assigned_officer": "Demo (Approval Officer)",
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
            "assigned_officer": "Approval Officer (Approval Officer)",
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
            "assigned_officer": "Bureau Head RB (Bureau Head)",
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
            "assigned_officer": "Caleb (Super Admin)",
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
            "assigned_officer": "System Administrator (Super Admin)",
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
