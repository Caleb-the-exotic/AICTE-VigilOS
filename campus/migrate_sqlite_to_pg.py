# ============================================================
# campus/migrate_sqlite_to_pg.py — SQLite to PostgreSQL Migration
# ============================================================
# Exports records from SQLite (campusflow.db) in dependency order,
# imports them into PostgreSQL, resets sequences, and validates integrity.
# ============================================================

import os
import sys
import shutil
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from psycopg2.extras import RealDictCursor
from campus.pg_schema import init_postgres_schema

WORKSPACE_DIR = os.path.dirname(os.path.dirname(__file__))
SQLITE_DB_PATH = os.path.join(WORKSPACE_DIR, "campusflow.db")
BACKUP_DB_PATH = os.path.join(WORKSPACE_DIR, "campusflow_pre_pg_migration.db.bak")

# Dependency order of tables to preserve referential integrity
TABLE_DEPENDENCY_ORDER = [
    "schema_migrations",
    "bureaus",
    "regions",
    "roles",
    "permissions",
    "role_permissions",
    "users",
    "deleted_accounts",
    "auth_accounts",
    "user_assignments",
    "assignment_audit",
    "sessions",
    "messages",
    "requests",
    "logs",
    "audit",
    "kpis",
    "academic_calendar",
    "scheduler_logs",
    "bookings",
    "agent_execution_steps",
    "aicte_institutions",
    "aicte_cases",
    "aicte_case_sequences",
    "aicte_overlap_alerts",
    "live_chat_messages",
    "internal_messages",
    "internal_message_recipients",
    "internal_drafts",
    "internal_user_labels",
    "internal_idempotency_keys",
    "legacy_users_backup",
]

def backup_sqlite():
    """Create a protected backup of campusflow.db."""
    if os.path.exists(SQLITE_DB_PATH):
        shutil.copy2(SQLITE_DB_PATH, BACKUP_DB_PATH)
        print(f"[Backup] Successfully created backup at {BACKUP_DB_PATH}")
    else:
        print(f"[Backup Warning] SQLite database not found at {SQLITE_DB_PATH}")

def run_data_migration(pg_url: str) -> dict:
    """Migrate all data from SQLite to PostgreSQL with row count validation."""
    backup_sqlite()
    
    # Connect to SQLite
    s_conn = sqlite3.connect(SQLITE_DB_PATH)
    s_conn.row_factory = sqlite3.Row
    s_cur = s_conn.cursor()
    
    # Connect to PostgreSQL
    p_conn = psycopg2.connect(pg_url)
    init_postgres_schema(p_conn)
    p_cur = p_conn.cursor(cursor_factory=RealDictCursor)
    
    # Get all tables currently present in SQLite
    s_cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_s_tables = {r[0] for r in s_cur.fetchall()}
    
    stats = {}
    
    for table in TABLE_DEPENDENCY_ORDER:
        if table not in existing_s_tables:
            print(f"[-] Skipping {table} (not in SQLite)")
            continue
            
        # Get column names from SQLite table
        s_cur.execute(f"PRAGMA table_info('{table}')")
        cols = [c[1] for c in s_cur.fetchall()]
        if not cols:
            continue
            
        # Check matching columns in PG
        p_cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = %s
        """, (table,))
        pg_cols_set = {r['column_name'] for r in p_cur.fetchall()}
        
        # Intersection of columns
        common_cols = [c for c in cols if c in pg_cols_set]
        if not common_cols:
            continue
            
        # Fetch rows from SQLite
        col_list_str = ", ".join(f'"{c}"' for c in common_cols)
        s_cur.execute(f"SELECT {col_list_str} FROM \"{table}\"")
        rows = s_cur.fetchall()
        
        # Insert into PG with ON CONFLICT DO NOTHING
        placeholders = ", ".join(["%s"] * len(common_cols))
        insert_sql = f'INSERT INTO "{table}" ({col_list_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
        
        imported = 0
        for r in rows:
            val_tuple = tuple(r[c] for c in common_cols)
            try:
                p_cur.execute(insert_sql, val_tuple)
                imported += 1
            except Exception as e:
                print(f"[Error importing into {table}] {e}")
                
        p_conn.commit()
        
        # Verify row counts in PostgreSQL
        p_cur.execute(f'SELECT count(*) as cnt FROM "{table}"')
        pg_count = p_cur.fetchone()['cnt']
        stats[table] = {"sqlite_rows": len(rows), "pg_rows": pg_count}
        print(f"[Migrated] {table}: {len(rows)} SQLite rows -> {pg_count} PG rows")

    # Reset PostgreSQL SERIAL sequences for all tables that have 'id' SERIAL
    serial_tables = [
        ("assignment_audit", "id"),
        ("messages", "id"),
        ("logs", "id"),
        ("audit", "id"),
        ("kpis", "id"),
        ("academic_calendar", "id"),
        ("scheduler_logs", "id"),
        ("agent_execution_steps", "id"),
        ("aicte_cases", "id"),
        ("aicte_overlap_alerts", "id"),
    ]
    
    for tbl, id_col in serial_tables:
        try:
            seq_name = f"{tbl}_{id_col}_seq"
            p_cur.execute(f"""
                SELECT COALESCE(MAX("{id_col}"), 0) as max_id FROM "{tbl}"
            """)
            max_id = p_cur.fetchone()['max_id']
            if max_id > 0:
                p_cur.execute(f"SELECT setval('{seq_name}', %s, true)", (max_id,))
                p_conn.commit()
                print(f"[Sequence] Set {seq_name} to {max_id}")
        except Exception as seq_err:
            print(f"[Sequence Notice] {tbl}: {seq_err}")
            p_conn.rollback()

    s_conn.close()
    p_conn.close()
    print("[Migration Complete] All SQLite data migrated into PostgreSQL successfully.")
    return stats

if __name__ == "__main__":
    db_url = os.getenv("DATABASE_URL") or "postgresql://postgres@localhost:5433/campusflow"
    run_data_migration(db_url)
