# ============================================================
# campus/institution_registration_service.py
# Business logic for institution self-registration & approval.
# ============================================================

import uuid
import datetime
import json
from typing import Optional, List, Dict, Any

from campus.db import get_conn
from campus import role_service


# ── Helpers ───────────────────────────────────────────────────────

def _now() -> str:
    return datetime.datetime.now().isoformat()


def _uuid() -> str:
    return str(uuid.uuid4())


def _app_id() -> str:
    """Human-readable application ID like APP-YYYYMMDD-XXXX."""
    ts = datetime.datetime.now().strftime("%Y%m%d")
    short = str(uuid.uuid4()).replace("-", "")[:6].upper()
    return f"APP-{ts}-{short}"


def _row_to_dict(cur, row) -> Optional[Dict]:
    if row is None:
        return None
    if hasattr(row, "keys"):
        return dict(row)
    if cur.description:
        cols = [d[0] for d in cur.description]
        return dict(zip(cols, row))
    return None


# ── Submit Registration ────────────────────────────────────────────

def submit_registration(
    applicant_user_id: Optional[str],
    institution_name: str,
    aicte_code: Optional[str],
    inst_type: Optional[str],
    affiliation: Optional[str],
    address: Optional[str],
    city: Optional[str],
    district: Optional[str],
    state: Optional[str],
    region: Optional[str],
    official_email: str,
    contact_phone: Optional[str],
    rep_name: Optional[str],
    rep_designation: Optional[str],
    rep_email: Optional[str],
    rep_phone: Optional[str],
    website: Optional[str],
    documents: Optional[List[Dict]],
    declaration_accepted: bool,
    idempotency_key: Optional[str] = None,
    password: Optional[str] = None,
) -> Dict:
    """
    Submit a new institution registration application.
    Returns the created application record.
    Raises ValueError on duplicate detection.
    """
    conn = get_conn()
    try:
        cur = conn.cursor()

        # 1. Idempotency check — return existing if key already used
        if idempotency_key:
            cur.execute(
                "SELECT id FROM institution_registrations WHERE idempotency_key = %s",
                (idempotency_key,),
            )
            row = cur.fetchone()
            if row:
                existing_id = row[0] if not hasattr(row, "keys") else row["id"]
                cur.execute(
                    "SELECT * FROM institution_registrations WHERE id = %s", (existing_id,)
                )
                return _row_to_dict(cur, cur.fetchone())

        # 2. Duplicate pending/approved application guard
        cur.execute("""
            SELECT id, status FROM institution_registrations
            WHERE LOWER(official_email) = LOWER(%s)
              AND status IN ('pending', 'approved')
        """, (official_email,))
        dup = cur.fetchone()
        if dup:
            dup_d = _row_to_dict(cur, dup)
            status = dup_d["status"] if dup_d else "pending"
            raise ValueError(
                f"A {status} application already exists for this email address. "
                f"Application ID: {dup_d['id'] if dup_d else ''}."
            )

        # 3. Insert
        app_id = _app_id()
        now = _now()
        docs_json = json.dumps(documents or [])
        history = json.dumps([{"status": "pending", "timestamp": now, "note": "Application submitted"}])
        pw_hash = role_service.hash_password(password.strip()) if password and password.strip() else None

        cur.execute("""
            INSERT INTO institution_registrations (
                id, applicant_user_id, institution_name, aicte_code, inst_type, affiliation,
                address, city, district, state, region, official_email, contact_phone,
                rep_name, rep_designation, rep_email, rep_phone, website,
                documents_json, declaration_accepted, status, submitted_at, updated_at,
                idempotency_key, status_history_json, password_hash
            ) VALUES (
                %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
            )
        """, (
            app_id, applicant_user_id, institution_name, aicte_code, inst_type, affiliation,
            address, city, district, state, region, official_email, contact_phone,
            rep_name, rep_designation, rep_email, rep_phone, website,
            docs_json, 1 if declaration_accepted else 0,
            "pending", now, now, idempotency_key, history, pw_hash,
        ))
        conn.commit()

        cur.execute("SELECT * FROM institution_registrations WHERE id = %s", (app_id,))
        return _row_to_dict(cur, cur.fetchone())

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Get Application ────────────────────────────────────────────────

def get_registration(app_id: str) -> Optional[Dict]:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM institution_registrations WHERE id = %s", (app_id,))
        return _row_to_dict(cur, cur.fetchone())
    finally:
        conn.close()


def get_my_registration(user_id: str) -> Optional[Dict]:
    """Return latest application for a given user."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM institution_registrations
            WHERE applicant_user_id = %s
            ORDER BY submitted_at DESC
            LIMIT 1
        """, (user_id,))
        return _row_to_dict(cur, cur.fetchone())
    finally:
        conn.close()


def list_registrations(
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> Dict:
    conn = get_conn()
    try:
        cur = conn.cursor()
        conditions = []
        params = []
        if status and status != "all":
            conditions.append("r.status = %s")
            params.append(status)
        if search:
            conditions.append("""
                (LOWER(r.institution_name) LIKE %s
                OR LOWER(r.aicte_code) LIKE %s
                OR LOWER(r.id) LIKE %s
                OR LOWER(r.official_email) LIKE %s)
            """)
            sq = f"%{search.lower()}%"
            params.extend([sq, sq, sq, sq])

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        offset = (page - 1) * page_size

        cur.execute(f"SELECT COUNT(*) FROM institution_registrations r {where}", params)
        row = cur.fetchone()
        total = row[0] if row else 0

        cur.execute(f"""
            SELECT r.*,
                   u.name AS applicant_name,
                   u.normalized_email AS applicant_email,
                   rv.name AS reviewer_name
            FROM institution_registrations r
            LEFT JOIN users u ON r.applicant_user_id = u.id
            LEFT JOIN users rv ON r.reviewer_id = rv.id
            {where}
            ORDER BY r.submitted_at DESC
            LIMIT %s OFFSET %s
        """, params + [page_size, offset])

        rows = cur.fetchall()
        items = []
        if rows:
            if hasattr(rows[0], "keys"):
                items = [dict(r) for r in rows]
            elif cur.description:
                cols = [d[0] for d in cur.description]
                items = [dict(zip(cols, r)) for r in rows]

        return {"total": total, "page": page, "page_size": page_size, "items": items}
    finally:
        conn.close()


# ── Approve / Reject ───────────────────────────────────────────────

def approve_registration(app_id: str, reviewer_id: str, review_notes: str = "") -> Dict:
    """
    Transactionally approve an institution registration.
    Creates an aicte_institutions record on success.
    """
    conn = get_conn()
    try:
        cur = conn.cursor()

        # Lock the row for update
        cur.execute("""
            SELECT * FROM institution_registrations
            WHERE id = %s
            FOR UPDATE
        """, (app_id,))
        app = _row_to_dict(cur, cur.fetchone())
        if not app:
            raise ValueError(f"Application {app_id} not found.")
        if app["status"] != "pending":
            raise ValueError(f"Application is already {app['status']}. Cannot re-approve.")

        # Check for existing institution with same email
        cur.execute(
            "SELECT aicte_pid FROM aicte_institutions WHERE LOWER(contact_email) = LOWER(%s)",
            (app["official_email"],),
        )
        existing = cur.fetchone()

        now = _now()
        aicte_pid = None

        if existing:
            # Activate / reuse existing institution record
            aicte_pid = existing[0] if not hasattr(existing, "keys") else existing["aicte_pid"]
        else:
            # Create new institution record
            aicte_pid = f"1-REG-{str(uuid.uuid4()).replace('-','')[:9].upper()}"
            cur.execute("""
                INSERT INTO aicte_institutions (
                    aicte_pid, institution_name, region, state, district, city, address,
                    inst_type, contact_email, contact_phone, principal_name, website,
                    approval_status, created_at, updated_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                aicte_pid,
                app["institution_name"],
                app.get("region") or "—",
                app.get("state") or "—",
                app.get("district"),
                app.get("city"),
                app.get("address"),
                app.get("inst_type") or "Engineering College",
                app["official_email"],
                app.get("contact_phone"),
                app.get("rep_name"),
                app.get("website"),
                "AICTE Approved (Registered via VigilOS)",
                now, now,
            ))

        # Update application status
        history = json.loads(app.get("status_history_json") or "[]")
        history.append({
            "status": "approved",
            "timestamp": now,
            "reviewer_id": reviewer_id,
            "note": review_notes or "Application approved.",
        })

        cur.execute("""
            UPDATE institution_registrations
            SET status = 'approved',
                reviewer_id = %s,
                reviewed_at = %s,
                review_notes = %s,
                updated_at = %s,
                status_history_json = %s,
                created_institution_pid = %s
            WHERE id = %s
        """, (reviewer_id, now, review_notes, now, json.dumps(history), aicte_pid, app_id))

        # Ensure user account exists and is activated for this approved institution
        user_id = app.get("applicant_user_id")
        cur.execute("SELECT id, password_hash FROM users WHERE LOWER(normalized_email) = LOWER(%s)", (app["official_email"],))
        existing_user = cur.fetchone()

        reg_pw_hash = app.get("password_hash")

        if existing_user:
            user_id = existing_user[0] if not hasattr(existing_user, "keys") else existing_user["id"]
            existing_pw = existing_user[1] if not hasattr(existing_user, "keys") else existing_user["password_hash"]
            effective_pw = reg_pw_hash if reg_pw_hash and not existing_pw else existing_pw
            cur.execute("""
                UPDATE users
                SET institution = %s, department = 'Administration', status = 'active',
                    password_hash = COALESCE(%s, password_hash)
                WHERE id = %s
            """, (app["institution_name"], effective_pw, user_id))
            cur.execute("""
                INSERT INTO auth_accounts (id, user_id, provider, provider_subject, created_at)
                VALUES (%s, %s, 'credentials', %s, %s)
                ON CONFLICT DO NOTHING
            """, (_uuid(), user_id, app["official_email"].lower(), now))
        else:
            user_id = _uuid()
            effective_pw = reg_pw_hash or role_service.hash_password("AictePass@2026")
            cur.execute("""
                INSERT INTO users (
                    id, name, normalized_email, password_hash, status,
                    institution, department, two_factor_enabled, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, 'active', %s, 'Administration', 0, %s, %s)
            """, (
                user_id,
                app.get("rep_name") or app["institution_name"],
                app["official_email"].lower(),
                effective_pw,
                app["institution_name"],
                now, now,
            ))
            # Link citizen / institutional role
            cur.execute("""
                INSERT INTO user_assignments (id, user_id, role_id, bureau_id, region_id, status, created_at, updated_at)
                VALUES (%s, %s, 'role_citizen', 'bur_pgrc', 'reg_hq', 'active', %s, %s)
            """, (_uuid(), user_id, now, now))
            cur.execute("""
                INSERT INTO auth_accounts (id, user_id, provider, provider_subject, created_at)
                VALUES (%s, %s, 'credentials', %s, %s)
                ON CONFLICT DO NOTHING
            """, (_uuid(), user_id, app["official_email"].lower(), now))

        # Update application with assigned applicant_user_id
        cur.execute("UPDATE institution_registrations SET applicant_user_id = %s WHERE id = %s", (user_id, app_id))

        # Notify applicant user
        cur.execute("""
            INSERT INTO officer_notifications (
                id, recipient_user_id, type, title, body, action_url, reference_id, is_read, created_at, idempotency_key
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, 0, %s, %s)
            ON CONFLICT (idempotency_key) DO NOTHING
        """, (
            _uuid(),
            user_id,
            "registration_approved",
            f"Institution Registration Approved: {app['institution_name']}",
            f"Your registration application {app_id} has been approved. Your institution is now registered with AICTE PID {aicte_pid}.",
            f"/profile",
            app_id,
            now,
            f"notif_approved_{app_id}",
        ))

        # Notify officers in DB
        for oid in get_officer_user_ids():
            cur.execute("""
                INSERT INTO officer_notifications (
                    id, recipient_user_id, type, title, body, action_url, reference_id, is_read, created_at, idempotency_key
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, 0, %s, %s)
                ON CONFLICT (idempotency_key) DO NOTHING
            """, (
                _uuid(),
                oid,
                "registration_approved",
                f"Institution Approved: {app['institution_name']}",
                f"Registration {app_id} approved. Generated AICTE PID: {aicte_pid}.",
                f"/cases?tab=registrations&app_id={app_id}",
                app_id,
                now,
                f"notif_approved_officer_{app_id}_{oid}",
            ))

        conn.commit()

        cur.execute("SELECT * FROM institution_registrations WHERE id = %s", (app_id,))
        updated = _row_to_dict(cur, cur.fetchone())
        if updated:
            updated["aicte_pid"] = aicte_pid
        return updated

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def reject_registration(app_id: str, reviewer_id: str, reason: str, review_notes: str = "") -> Dict:
    """Reject a pending registration application."""
    conn = get_conn()
    try:
        cur = conn.cursor()

        cur.execute("SELECT * FROM institution_registrations WHERE id = %s FOR UPDATE", (app_id,))
        app = _row_to_dict(cur, cur.fetchone())
        if not app:
            raise ValueError(f"Application {app_id} not found.")
        if app["status"] != "pending":
            raise ValueError(f"Application is already {app['status']}.")
        if not reason or not reason.strip():
            raise ValueError("Rejection reason is required.")

        now = _now()
        history = json.loads(app.get("status_history_json") or "[]")
        history.append({
            "status": "rejected",
            "timestamp": now,
            "reviewer_id": reviewer_id,
            "reason": reason,
            "note": review_notes or "",
        })

        cur.execute("""
            UPDATE institution_registrations
            SET status = 'rejected',
                reviewer_id = %s,
                reviewed_at = %s,
                rejection_reason = %s,
                review_notes = %s,
                updated_at = %s,
                status_history_json = %s
            WHERE id = %s
        """, (reviewer_id, now, reason, review_notes, now, json.dumps(history), app_id))

        # Notify applicant if registered user
        if app.get("applicant_user_id"):
            cur.execute("""
                INSERT INTO officer_notifications (
                    id, recipient_user_id, type, title, body, action_url, reference_id, is_read, created_at, idempotency_key
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, 0, %s, %s)
                ON CONFLICT (idempotency_key) DO NOTHING
            """, (
                _uuid(),
                app["applicant_user_id"],
                "registration_rejected",
                f"Institution Registration Update: {app['institution_name']}",
                f"Your registration application {app_id} was reviewed and rejected. Reason: {reason}",
                f"/complaint-portal.html",
                app_id,
                now,
                f"notif_rejected_{app_id}",
            ))

        # Notify officers in DB
        for oid in get_officer_user_ids():
            cur.execute("""
                INSERT INTO officer_notifications (
                    id, recipient_user_id, type, title, body, action_url, reference_id, is_read, created_at, idempotency_key
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, 0, %s, %s)
                ON CONFLICT (idempotency_key) DO NOTHING
            """, (
                _uuid(),
                oid,
                "registration_rejected",
                f"Institution Rejected: {app['institution_name']}",
                f"Registration {app_id} rejected. Reason: {reason}",
                f"/cases?tab=registrations&app_id={app_id}",
                app_id,
                now,
                f"notif_rejected_officer_{app_id}_{oid}",
            ))

        conn.commit()

        cur.execute("SELECT * FROM institution_registrations WHERE id = %s", (app_id,))
        return _row_to_dict(cur, cur.fetchone())

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def mark_email_sent(app_id: str, status: str = "sent") -> None:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE institution_registrations
            SET email_sent_at = %s, email_status = %s
            WHERE id = %s
        """, (_now(), status, app_id))
        conn.commit()
    finally:
        conn.close()


def send_registration_decision_email(app: Dict, decision: str, reason: str = "") -> bool:
    """
    Safely dispatches decision email via campus.gmail_mailer.
    Records delivery status in institution_registrations table.
    Does not crash or reverse approval if email sending encounters temporary failure.
    """
    to_email = app.get("official_email")
    if not to_email:
        return False

    app_id = app.get("id")
    inst_name = app.get("institution_name")
    aicte_pid = app.get("created_institution_pid") or app.get("aicte_pid") or "Registered"

    try:
        from campus import gmail_mailer
        if decision == "approved":
            subject = f"[AICTE VigilOS] Institution Registration Approved — {inst_name} ({app_id})"
            text_body = f"""Dear Administrator / Authorized Representative,

We are pleased to inform you that the institution registration application for:
{inst_name} (Application Ref: {app_id})

has been formally APPROVED by the AICTE Regulatory Directorate.

Permanent / Verification Reference: {aicte_pid}

Your institutional portal is now active. You may access AICTE VigilOS to manage your verified institutional profile, monitor compliance proceedings, and submit official grievances:
Portal URL: https://aicte-vigil-os.vercel.app/

All India Council for Technical Education (AICTE)
Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070
"""
            html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f17; color: #f1f5f9; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid #10b981; border-radius: 14px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 20px; color: white;">
      <h2 style="margin: 0; font-size: 20px;">AICTE VigilOS — Registration Approved</h2>
      <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Institutional Self-Registration Confirmation</div>
    </div>
    <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
      <p>Dear Authorized Representative,</p>
      <p>We are pleased to inform you that your registration application for <strong>{inst_name}</strong> has been officially approved.</p>
      <div style="background: #1e293b; border-left: 4px solid #10b981; padding: 14px; margin: 16px 0; border-radius: 6px;">
        <div><strong>Application Reference:</strong> {app_id}</div>
        <div><strong>AICTE Permanent ID:</strong> {aicte_pid}</div>
        <div><strong>Status:</strong> Approved & Verified</div>
      </div>
      <p>Your institutional access is now fully active. You may access the institutional portal below:</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="https://aicte-vigil-os.vercel.app/" style="background: #10b981; color: white; padding: 10px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">Access AICTE VigilOS Portal</a>
      </p>
    </div>
  </div>
</body>
</html>"""
        else:
            subject = f"[AICTE VigilOS] Institution Registration Update — {inst_name} ({app_id})"
            text_body = f"""Dear Authorized Representative,

Regarding your application for {inst_name} (Reference: {app_id}):

The reviewing regulatory committee has reviewed the submitted documentation and determined that the application cannot be approved at this time.

Reason / Required Correction:
{reason}

You may submit a corrected application with updated verification documents via the AICTE VigilOS registration portal:
https://aicte-vigil-os.vercel.app/complaint-portal.html

All India Council for Technical Education (AICTE)
Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070
"""
            html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f17; color: #f1f5f9; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid #ef4444; border-radius: 14px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #7f1d1d 0%, #ef4444 100%); padding: 20px; color: white;">
      <h2 style="margin: 0; font-size: 20px;">AICTE VigilOS — Registration Review Notice</h2>
      <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Institutional Application Status Update</div>
    </div>
    <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
      <p>Dear Authorized Representative,</p>
      <p>Your application for <strong>{inst_name}</strong> (Reference: <code>{app_id}</code>) has been reviewed by the regulatory committee.</p>
      <div style="background: #1e293b; border-left: 4px solid #ef4444; padding: 14px; margin: 16px 0; border-radius: 6px;">
        <div style="color: #fca5a5; font-weight: 600; margin-bottom: 4px;">Reason / Correction Required:</div>
        <div style="color: #e2e8f0;">{reason}</div>
      </div>
      <p>You may correct and resubmit your application through the portal with the necessary documentation.</p>
    </div>
  </div>
</body>
</html>"""

        gmail_mailer.send_email(
            to_email=to_email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
        )
        mark_email_sent(app_id, status="sent")
        return True
    except Exception as e:
        print(f"[Email Dispatcher Notice] Could not send {decision} email to {to_email}: {e}")
        mark_email_sent(app_id, status=f"failed: {str(e)[:40]}")
        return False


# ── Notifications ──────────────────────────────────────────────────

def create_notification(
    recipient_user_id: str,
    notif_type: str,
    title: str,
    body: str,
    action_url: str,
    reference_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> Optional[Dict]:
    """Create a persistent officer notification. Idempotent on key."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        if idempotency_key:
            cur.execute(
                "SELECT id FROM officer_notifications WHERE idempotency_key = %s",
                (idempotency_key,),
            )
            if cur.fetchone():
                return None  # Already created

        notif_id = _uuid()
        now = _now()
        cur.execute("""
            INSERT INTO officer_notifications
                (id, recipient_user_id, type, title, body, action_url, reference_id, is_read, created_at, idempotency_key)
            VALUES (%s,%s,%s,%s,%s,%s,%s,0,%s,%s)
            ON CONFLICT (idempotency_key) DO NOTHING
        """, (notif_id, recipient_user_id, notif_type, title, body, action_url, reference_id, now, idempotency_key))
        conn.commit()
        return {"id": notif_id, "created_at": now}
    except Exception as e:
        conn.rollback()
        print(f"[Notification] Error creating notification: {e}")
        return None
    finally:
        conn.close()


def get_notifications(user_id: str, unread_only: bool = False, is_admin: bool = False) -> List[Dict]:
    conn = get_conn()
    try:
        cur = conn.cursor()
        # Strictly scope to the active authenticated user so each officer/admin receives exactly 1 notification
        params = [user_id]
        where = "WHERE recipient_user_id = %s"
        if unread_only:
            where += " AND is_read = 0"
        cur.execute(f"""
            SELECT * FROM officer_notifications
            {where}
            ORDER BY created_at DESC
            LIMIT 200
        """, params)
        rows = cur.fetchall()
        if not rows:
            return []
        if hasattr(rows[0], "keys"):
            items = [dict(r) for r in rows]
        elif cur.description:
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
        else:
            items = []

        seen = set()
        deduped = []
        for n in items:
            key = (n.get("title"), n.get("body"), n.get("action_url"))
            if key in seen:
                continue
            seen.add(key)
            deduped.append(n)
        return deduped
    finally:
        conn.close()


def mark_notification_read(notif_id: str, user_id: str, is_admin: bool = False) -> bool:
    conn = get_conn()
    try:
        cur = conn.cursor()
        if is_admin:
            cur.execute("UPDATE officer_notifications SET is_read = 1 WHERE id = %s", (notif_id,))
        else:
            cur.execute("""
                UPDATE officer_notifications SET is_read = 1
                WHERE id = %s AND (recipient_user_id = %s OR recipient_user_id IN ('all', 'broadcast'))
            """, (notif_id, user_id))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def mark_all_notifications_read(user_id: str, is_admin: bool = False) -> int:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE officer_notifications SET is_read = 1
            WHERE recipient_user_id = %s AND is_read = 0
        """, (user_id,))
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


def get_unread_notification_count(user_id: str, is_admin: bool = False) -> int:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT COUNT(*) FROM officer_notifications
            WHERE recipient_user_id = %s AND is_read = 0
        """, (user_id,))
        row = cur.fetchone()
        return row[0] if row else 0
    finally:
        conn.close()


def delete_notification(notif_id: str, user_id: str, is_admin: bool = False) -> bool:
    """Permanently delete a notification from PostgreSQL DB. Admins can delete any notification; regular users only their own."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        if is_admin:
            cur.execute("DELETE FROM officer_notifications WHERE id = %s", (notif_id,))
        else:
            cur.execute("DELETE FROM officer_notifications WHERE id = %s AND recipient_user_id = %s", (notif_id, user_id))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def delete_all_notifications(user_id: str, is_admin: bool = False) -> int:
    """Permanently delete notifications from PostgreSQL DB. Admins delete all; regular users only their own."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        if is_admin:
            cur.execute("DELETE FROM officer_notifications")
        else:
            cur.execute("DELETE FROM officer_notifications WHERE recipient_user_id = %s", (user_id,))
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


# ── Fetch authorized officers to notify ───────────────────────────

def get_admin_and_bureau_head_ids() -> List[str]:
    """Return all active Super Admins and Bureau Heads who assign cases to lower officials."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT u.id FROM users u
            JOIN user_assignments ua ON ua.user_id = u.id AND ua.status = 'active'
            JOIN roles r ON ua.role_id = r.id
            WHERE r.key IN ('super_admin', 'admin', 'bureau_head')
              AND u.status = 'active'
        """)
        rows = cur.fetchall()
        if not rows:
            return ["usr_caleb", "usr_admin", "usr_62f1b9335aa9", "usr_hariprasath"]
        return [r[0] if not hasattr(r, "keys") else r["id"] for r in rows]
    finally:
        conn.close()

def find_officer_user_id_by_string(officer_str: str) -> Optional[str]:
    """Given an assigned officer string e.g. 'Monisha Yathavan (Approval Officer)', find user ID."""
    if not officer_str or not officer_str.strip():
        return None
    cleaned = officer_str.strip()
    name_part = cleaned.split("(")[0].strip()
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id FROM users u
            WHERE LOWER(u.name) = LOWER(%s)
               OR LOWER(u.normalized_email) = LOWER(%s)
               OR LOWER(u.id) = LOWER(%s)
            LIMIT 1
        """, (name_part, name_part, name_part))
        row = cur.fetchone()
        if row:
            return row[0] if not hasattr(row, "keys") else row["id"]
        return None
    finally:
        conn.close()

def get_assignable_officials() -> List[Dict[str, Any]]:
    """Return hierarchy of officials available for case assignment."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.name, u.normalized_email, r.key as role_key, r.display_name as role_label,
                   COALESCE(b.code, 'HQ') as bureau_code, COALESCE(reg.code, 'HQ') as region_code
            FROM users u
            JOIN user_assignments ua ON u.id = ua.user_id AND ua.status = 'active'
            JOIN roles r ON ua.role_id = r.id
            LEFT JOIN bureaus b ON ua.bureau_id = b.id
            LEFT JOIN regions reg ON ua.region_id = reg.id
            WHERE r.key != 'citizen' AND u.status = 'active'
            ORDER BY 
                CASE r.key 
                    WHEN 'super_admin' THEN 1 
                    WHEN 'bureau_head' THEN 2 
                    WHEN 'approval_officer' THEN 3 
                    WHEN 'nodal_officer' THEN 4 
                    ELSE 5 
                END, u.name ASC
        """)
        rows = cur.fetchall()
        if not rows:
            return []
        if hasattr(rows[0], "keys"):
            return [dict(r) for r in rows]
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in rows]
    finally:
        conn.close()

def get_officer_user_ids() -> List[str]:
    """Return all active super_admin, bureau_head, approval_officer and administrative officer user IDs."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT u.id FROM users u
            LEFT JOIN user_assignments ua ON ua.user_id = u.id
            LEFT JOIN roles r ON ua.role_id = r.id
            WHERE (r.key IN ('super_admin', 'admin', 'bureau_head', 'approval_officer', 'nodal_officer')
                   OR u.institution LIKE '%AICTE%'
                   OR u.id LIKE '%admin%'
                   OR u.id LIKE '%officer%')
              AND u.status = 'active'
        """)
        rows = cur.fetchall()
        if not rows:
            return ["usr_admin", "usr_officer_demo"]
        return [r[0] if not hasattr(r, "keys") else r["id"] for r in rows]
    finally:
        conn.close()


# ── Portal Context & Self-Service Operations ───────────────────────

def get_portal_context(user_id: Optional[str] = None, email: Optional[str] = None) -> Dict[str, Any]:
    """
    Authoritative state for the complete Institution Portal website.
    Resolves verification status, registration application history,
    official AICTE portfolio profile, case statistics, and notifications.
    """
    conn = get_conn()
    try:
        cur = conn.cursor()
        user_record = None
        if user_id:
            cur.execute("""
                SELECT u.id, u.name, u.normalized_email as email, u.status, u.institution,
                       COALESCE(r.key, 'citizen') as role
                FROM users u
                LEFT JOIN user_assignments ua ON ua.user_id = u.id AND ua.status = 'active'
                LEFT JOIN roles r ON ua.role_id = r.id
                WHERE u.id = %s
            """, (user_id,))
            user_record = _row_to_dict(cur, cur.fetchone())

        # Find registration application
        app_record = None
        if user_id:
            cur.execute("""
                SELECT * FROM institution_registrations
                WHERE applicant_user_id = %s
                ORDER BY submitted_at DESC LIMIT 1
            """, (user_id,))
            app_record = _row_to_dict(cur, cur.fetchone())

        if not app_record and email:
            cur.execute("""
                SELECT * FROM institution_registrations
                WHERE LOWER(official_email) = LOWER(%s)
                ORDER BY submitted_at DESC LIMIT 1
            """, (email,))
            app_record = _row_to_dict(cur, cur.fetchone())

        # Determine verification status
        status = "unregistered"
        if app_record:
            status = app_record.get("status", "pending")
        elif user_record and user_record.get("institution"):
            status = "approved"

        # Find official institution profile in aicte_institutions
        profile = None
        pid = None
        if app_record and app_record.get("created_institution_pid"):
            pid = app_record["created_institution_pid"]
        elif app_record and status == "approved":
            cur.execute(
                "SELECT * FROM aicte_institutions WHERE LOWER(contact_email) = LOWER(%s) OR LOWER(institution_name) = LOWER(%s) LIMIT 1",
                (app_record.get("official_email", ""), app_record.get("institution_name", ""))
            )
            profile = _row_to_dict(cur, cur.fetchone())
            if profile:
                pid = profile.get("aicte_pid")

        if not profile and pid:
            cur.execute("SELECT * FROM aicte_institutions WHERE aicte_pid = %s", (pid,))
            profile = _row_to_dict(cur, cur.fetchone())

        if not profile and user_record and user_record.get("institution"):
            cur.execute(
                "SELECT * FROM aicte_institutions WHERE LOWER(institution_name) = LOWER(%s) LIMIT 1",
                (user_record["institution"],)
            )
            profile = _row_to_dict(cur, cur.fetchone())
            if profile:
                pid = profile.get("aicte_pid")
                status = "approved"

        if not profile and email:
            cur.execute(
                "SELECT * FROM aicte_institutions WHERE LOWER(contact_email) = LOWER(%s) LIMIT 1",
                (email,)
            )
            profile = _row_to_dict(cur, cur.fetchone())
            if profile:
                pid = profile.get("aicte_pid")
                status = "approved"

        # KPIs and Complaints
        kpis = {
            "total_complaints": 0,
            "open_complaints": 0,
            "resolved_complaints": 0,
            "pending_responses": 0,
        }
        recent_complaints = []

        target_pid = pid or (profile.get("aicte_pid") if profile else None)
        target_name = (profile.get("institution_name") if profile else None) or (app_record.get("institution_name") if app_record else None)

        if target_pid or target_name or user_id:
            # Query complaints
            conds = []
            params = []
            if target_pid:
                conds.append("aicte_pid = %s")
                params.append(target_pid)
            elif target_name:
                conds.append("LOWER(institution_name) = LOWER(%s)")
                params.append(target_name)
            elif user_id:
                conds.append("complainant_user_id = %s")
                params.append(user_id)

            where_clause = " OR ".join(conds)
            cur.execute(f"""
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status IN ('received', 'under_process', 'transferred', 'escalated') THEN 1 END) as open_cnt,
                    COUNT(CASE WHEN status IN ('disposed', 'resolved') THEN 1 END) as resolved_cnt,
                    COUNT(CASE WHEN status = 'under_process' THEN 1 END) as pending_cnt
                FROM aicte_cases
                WHERE {where_clause}
            """, tuple(params))
            stats_row = cur.fetchone()
            if stats_row:
                s_dict = stats_row if hasattr(stats_row, "keys") else dict(zip(["total", "open_cnt", "resolved_cnt", "pending_cnt"], stats_row))
                kpis["total_complaints"] = s_dict.get("total") or 0
                kpis["open_complaints"] = s_dict.get("open_cnt") or 0
                kpis["resolved_complaints"] = s_dict.get("resolved_cnt") or 0
                kpis["pending_responses"] = s_dict.get("pending_cnt") or 0

            cur.execute(f"""
                SELECT case_id, aicte_pid, institution_name, bureau, category, title, description,
                       status, assigned_officer, sla_days, sla_deadline, received_at, created_at, updated_at
                FROM aicte_cases
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT 10
            """, tuple(params))
            case_rows = cur.fetchall()
            if case_rows:
                if hasattr(case_rows[0], "keys"):
                    recent_complaints = [dict(r) for r in case_rows]
                elif cur.description:
                    cols = [d[0] for d in cur.description]
                    recent_complaints = [dict(zip(cols, r)) for r in case_rows]

        # Recent notifications
        recent_notifications = []
        if user_id:
            cur.execute("""
                SELECT id, title, body as message, type as notification_type, action_url, is_read, created_at
                FROM officer_notifications
                WHERE recipient_user_id = %s
                ORDER BY created_at DESC
                LIMIT 10
            """, (user_id,))
            notif_rows = cur.fetchall()
            if notif_rows:
                if hasattr(notif_rows[0], "keys"):
                    recent_notifications = [dict(r) for r in notif_rows]
                elif cur.description:
                    cols = [d[0] for d in cur.description]
                    recent_notifications = [dict(zip(cols, r)) for r in notif_rows]

        return {
            "user": user_record,
            "status": status,
            "application": app_record,
            "profile": profile,
            "kpis": kpis,
            "recent_complaints": recent_complaints,
            "recent_notifications": recent_notifications,
        }
    finally:
        conn.close()


def update_institution_profile(pid: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save updates to an approved institution profile in PostgreSQL.
    Permitted fields: contact_email, contact_phone, website, principal_name, address, city, district, state, region.
    """
    conn = get_conn()
    try:
        cur = conn.cursor()
        now = _now()
        cur.execute("""
            UPDATE aicte_institutions
            SET contact_email = COALESCE(%s, contact_email),
                contact_phone = COALESCE(%s, contact_phone),
                website = COALESCE(%s, website),
                principal_name = COALESCE(%s, principal_name),
                address = COALESCE(%s, address),
                city = COALESCE(%s, city),
                district = COALESCE(%s, district),
                state = COALESCE(%s, state),
                region = COALESCE(%s, region),
                updated_at = %s
            WHERE aicte_pid = %s
            RETURNING *
        """, (
            updates.get("contact_email"),
            updates.get("contact_phone"),
            updates.get("website"),
            updates.get("principal_name"),
            updates.get("address"),
            updates.get("city"),
            updates.get("district"),
            updates.get("state"),
            updates.get("region"),
            now,
            pid,
        ))
        row = cur.fetchone()
        conn.commit()
        if not row:
            raise ValueError(f"Institution with PID '{pid}' not found.")
        return _row_to_dict(cur, row)
    finally:
        conn.close()



def delete_registration(app_id: str) -> bool:
    """Permanently delete an institution registration from PostgreSQL DB."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM institution_registrations WHERE id = %s", (app_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()
