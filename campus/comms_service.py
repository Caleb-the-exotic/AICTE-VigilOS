# ============================================================
# campus/comms_service.py — Internal Messaging & Directory Service
# ============================================================
# Provides backend persistence and queries for:
# - User & Institutional Contact Directory
# - Internal message sending & delivery with verified sender identity
# - Inbox, Sent, Starred, Trash folders & unread counters
# - Optional external email delivery via Gmail API v1
# ============================================================

import os
import uuid
import datetime
import json
import secrets
from typing import List, Dict, Any, Optional, Tuple
from campus.db import get_conn
from campus import role_service, gmail_mailer

def get_recipient_directory(current_user: Dict[str, Any], query: Optional[str] = None, category: Optional[str] = None) -> Dict[str, Any]:
    """
    Search and retrieve the integrated directory of registered VigilOS users
    and institutional contacts across colleges, universities, bureaus, and regions.
    """
    conn = get_conn()
    cur = conn.cursor()

    q_clean = query.strip().lower() if query else ""
    current_uid = current_user.get("id")
    current_bureau = current_user.get("bureau_code") or "HQ"
    current_region = current_user.get("region_code") or "HQ"

    # 1. Fetch all registered users with their assignments
    cur.execute('''
        SELECT 
            u.id, u.name, u.normalized_email as email, u.status,
            COALESCE(u.institution, '') as user_institution,
            COALESCE(u.department, '') as department,
            COALESCE(r.key, 'citizen') as role,
            COALESCE(r.display_name, 'Citizen / Complainant') as role_label,
            COALESCE(b.code, 'HQ') as bureau_code,
            COALESCE(b.name, 'National Portal') as bureau_name,
            COALESCE(reg.code, 'HQ') as region_code,
            COALESCE(reg.name, 'HQ (New Delhi)') as region_name
        FROM users u
        LEFT JOIN user_assignments ua ON u.id = ua.user_id AND ua.status = 'active'
        LEFT JOIN roles r ON ua.role_id = r.id
        LEFT JOIN bureaus b ON ua.bureau_id = b.id
        LEFT JOIN regions reg ON ua.region_id = reg.id
        WHERE u.status = 'active'
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
    user_rows = cur.fetchall()

    registered_users = []
    for r in user_rows:
        row = dict(r)
        # Determine organizational display name
        inst_display = row["user_institution"] or row["bureau_name"] or "AICTE Central Office"
        dept_display = row["department"] or row["bureau_name"]

        user_obj = {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "role": row["role"],
            "role_label": row["role_label"],
            "institution": inst_display,
            "department": dept_display,
            "bureau": row["bureau_name"],
            "bureau_code": row["bureau_code"],
            "region": row["region_name"],
            "region_code": row["region_code"],
            "is_registered": True,
            "is_current_user": (row["id"] == current_uid),
            "contact_type": "registered_user",
        }

        # Apply search query filtering
        if q_clean:
            searchable = f"{user_obj['name']} {user_obj['email']} {user_obj['institution']} {user_obj['department']} {user_obj['role_label']} {user_obj['bureau']} {user_obj['region']}".lower()
            if q_clean not in searchable:
                continue

        # Apply category filtering
        if category == "my_institution":
            # Match current user's bureau or institution
            if row["bureau_code"] != current_bureau and user_obj["institution"] != current_user.get("institution"):
                continue
        elif category == "bureaus":
            if row["role"] not in ("super_admin", "bureau_head", "approval_officer"):
                continue
        elif category == "regions":
            if row["role"] != "nodal_officer" and row["bureau_code"] != "RO":
                continue
        elif category == "other_institutions":
            if "AICTE" in user_obj["institution"] or row["bureau_code"] == "HQ":
                continue

        registered_users.append(user_obj)

    # 2. Fetch approved institutional contacts from aicte_institutions
    cur.execute('''
        SELECT 
            aicte_pid, institution_name, region, state, district,
            inst_type, contact_email, contact_phone, principal_name
        FROM aicte_institutions
        WHERE contact_email IS NOT NULL AND contact_email != ''
        ORDER BY institution_name ASC
    ''')
    inst_rows = cur.fetchall()
    conn.close()

    institutional_contacts = []
    # Set of registered emails to avoid duplication
    registered_emails = {u["email"].lower() for u in registered_users}

    for r in inst_rows:
        row = dict(r)
        email = (row["contact_email"] or "").strip().lower()
        if not email or email in registered_emails:
            continue

        contact_obj = {
            "id": f"inst_{row['aicte_pid']}",
            "aicte_pid": row["aicte_pid"],
            "name": f"{row['principal_name']} (Principal / Director)" if row.get("principal_name") else f"{row['institution_name']} (Administration)",
            "email": email,
            "role": "institution_head",
            "role_label": "Head of Institution / College Registry",
            "institution": row["institution_name"],
            "department": f"{row['inst_type']} · {row['district']}",
            "bureau": "AICTE Approved College",
            "bureau_code": "COLLEGE",
            "region": f"{row['region']} Region ({row['state']})",
            "region_code": row["region"].upper(),
            "phone": row.get("contact_phone"),
            "is_registered": False,
            "is_current_user": False,
            "contact_type": "institutional_contact",
            "delivery_method": "external_email",
        }

        if q_clean:
            searchable = f"{contact_obj['name']} {contact_obj['email']} {contact_obj['institution']} {contact_obj['department']} {contact_obj['region']}".lower()
            if q_clean not in searchable:
                continue

        if category in ("bureaus", "my_institution"):
            # Institutional contacts do not appear in internal bureau filter
            continue
        elif category == "regions":
            if row["region"].upper() != current_region.upper():
                continue

        institutional_contacts.append(contact_obj)

    # 3. Build group summaries by Institution / Organization
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for u in registered_users:
        grp = u["institution"] or "AICTE Central Headquarters"
        grouped.setdefault(grp, []).append(u)

    for c in institutional_contacts:
        grp = c["institution"]
        grouped.setdefault(grp, []).append(c)

    return {
        "registered_users": registered_users,
        "institutional_contacts": institutional_contacts,
        "total_count": len(registered_users) + len(institutional_contacts),
        "grouped_by_institution": [
            {"institution": k, "contacts": v} for k, v in grouped.items()
        ],
        "current_user": {
            "id": current_uid,
            "name": current_user.get("name"),
            "email": current_user.get("email"),
            "institution": current_user.get("institution") or current_user.get("bureau") or "Central Vigilance HQ",
            "bureau": current_user.get("bureau") or "National Portal",
            "region": current_user.get("region") or "HQ (New Delhi)",
        }
    }

def send_internal_message(
    sender_user: Dict[str, Any],
    to_recipients: List[str],
    subject: str,
    body: str,
    in_reply_to: Optional[str] = None,
    thread_id: Optional[str] = None,
    send_external_email: bool = True,
    attachments: Optional[List[Dict[str, Any]]] = None,
    idempotency_key: Optional[str] = None,
    draft_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Authoritatively creates, logs, and delivers an internal VigilOS message.
    Preserves verified sender identity from trusted backend records.
    Delivers to recipient inboxes and optionally sends official external email via Gmail API v1.
    Supports idempotency keys to prevent duplicate sending.
    """
    sender_uid = sender_user["id"]
    now_dt = datetime.datetime.now()
    now_iso = now_dt.isoformat()
    year = now_dt.year

    conn = get_conn()
    cur = conn.cursor()

    # Check for duplicate submission via idempotency key
    if idempotency_key:
        try:
            cur.execute(
                "SELECT response_json FROM internal_idempotency_keys WHERE idempotency_key = ? AND user_id = ?",
                (idempotency_key.strip(), sender_uid)
            )
            cached_row = cur.fetchone()
            if cached_row:
                print(f"[Comms] Duplicate send prevented by idempotency key: {idempotency_key}")
                conn.close()
                return json.loads(cached_row["response_json"])
        except Exception as e:
            print(f"[Comms] Idempotency check notice: {e}")

    # Generate server-side message ID and reference number
    msg_id = f"msg_{uuid.uuid4().hex[:14]}"
    msg_ref = f"AICTE-MSG-{year}-{secrets.randbelow(90000) + 10000}"
    thread_id = thread_id or f"th_{uuid.uuid4().hex[:12]}"
    clean_subj = subject.strip() or "(No Subject)"
    clean_body = body.strip()

    if not clean_body:
        conn.close()
        raise ValueError("Message body cannot be empty.")
    if not to_recipients:
        conn.close()
        raise ValueError("At least one recipient must be specified.")

    # Resolve authoritative sender details
    sender_email = (sender_user.get("email") or sender_user.get("normalized_email", "")).strip().lower()
    sender_name = sender_user.get("name") or "AICTE Officer"
    sender_role = sender_user.get("role_key") or sender_user.get("role") or "approval_officer"
    sender_role_label = sender_user.get("role_label") or sender_user.get("role_name")
    if not sender_role_label:
        from campus import role_system
        sender_role_label = role_system.ROLES.get(sender_role, {}).get("display_name", sender_role.replace("_", " ").title())
    sender_bureau = sender_user.get("bureau") or "National Portal"
    sender_bureau_code = sender_user.get("bureau_code") or "HQ"
    sender_region = sender_user.get("region") or "HQ (New Delhi)"
    sender_region_code = sender_user.get("region_code") or "HQ"
    sender_institution = sender_user.get("institution") or f"AICTE {sender_bureau}"

    try:
        # 1. Insert into internal_messages with sender_folder = 'sent'
        cur.execute('''
            INSERT INTO internal_messages (
                id, message_ref, sender_user_id, sender_email, sender_name,
                sender_role, sender_role_label, sender_bureau, sender_bureau_code,
                sender_region, sender_region_code, sender_institution,
                subject, body, thread_id, in_reply_to, delivery_type,
                attachments_json, created_at, sent_at, status, sender_folder
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', 'sent')
        ''', (
            msg_id, msg_ref, sender_uid, sender_email, sender_name,
            sender_role, sender_role_label, sender_bureau, sender_bureau_code,
            sender_region, sender_region_code, sender_institution,
            clean_subj, clean_body, thread_id, in_reply_to,
            "both" if send_external_email else "internal",
            json.dumps(attachments or []), now_iso, now_iso
        ))


        # 2. Resolve recipients and insert into internal_message_recipients
        resolved_recipients = []
        external_emails_to_dispatch = []

        seen_emails = set()
        for raw_to in to_recipients:
            clean_to = raw_to.strip().lower()
            # If formatted like "Name <email@domain.com>", extract email
            if "<" in clean_to and ">" in clean_to:
                clean_to = clean_to.split("<")[1].split(">")[0].strip().lower()

            if not clean_to or clean_to in seen_emails:
                continue
            seen_emails.add(clean_to)

            # Check if recipient is a registered user
            cur.execute('''
                SELECT u.id, u.name, u.normalized_email, COALESCE(u.institution, '') as institution,
                       COALESCE(r.display_name, 'Officer') as role_label
                FROM users u
                LEFT JOIN user_assignments ua ON u.id = ua.user_id AND ua.status = 'active'
                LEFT JOIN roles r ON ua.role_id = r.id
                WHERE u.normalized_email = ?
                LIMIT 1
            ''', (clean_to,))
            user_row = cur.fetchone()

            if user_row:
                # Registered user
                rcpt_id = f"rcpt_{uuid.uuid4().hex[:12]}"
                recip_data = {
                    "id": rcpt_id,
                    "recipient_user_id": user_row["id"],
                    "recipient_email": clean_to,
                    "recipient_name": user_row["name"],
                    "recipient_type": "to",
                    "is_registered": 1,
                    "institution": user_row["institution"] or "AICTE Registered Member",
                    "role_label": user_row["role_label"],
                    "folder": "inbox",
                    "delivery_status": "delivered",
                }
                cur.execute('''
                    INSERT INTO internal_message_recipients (
                        id, message_id, recipient_user_id, recipient_email, recipient_name,
                        recipient_type, is_registered, institution, role_label, folder, delivery_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    recip_data["id"], msg_id, recip_data["recipient_user_id"],
                    recip_data["recipient_email"], recip_data["recipient_name"],
                    recip_data["recipient_type"], recip_data["is_registered"],
                    recip_data["institution"], recip_data["role_label"],
                    recip_data["folder"], recip_data["delivery_status"]
                ))
                resolved_recipients.append(recip_data)

                if send_external_email:
                    external_emails_to_dispatch.append((clean_to, user_row["name"]))
            else:
                # Institutional contact or external email
                cur.execute('''
                    SELECT institution_name, principal_name
                    FROM aicte_institutions
                    WHERE LOWER(contact_email) = ?
                    LIMIT 1
                ''', (clean_to,))
                inst_row = cur.fetchone()

                inst_name = inst_row["institution_name"] if inst_row else "External Institution"
                p_name = inst_row["principal_name"] if inst_row and inst_row.get("principal_name") else clean_to.split("@")[0].title()

                rcpt_id = f"rcpt_{uuid.uuid4().hex[:12]}"
                recip_data = {
                    "id": rcpt_id,
                    "recipient_user_id": None,
                    "recipient_email": clean_to,
                    "recipient_name": p_name,
                    "recipient_type": "to",
                    "is_registered": 0,
                    "institution": inst_name,
                    "role_label": "Institutional Contact",
                    "folder": "inbox",
                    "delivery_status": "delivered",
                }
                cur.execute('''
                    INSERT INTO internal_message_recipients (
                        id, message_id, recipient_user_id, recipient_email, recipient_name,
                        recipient_type, is_registered, institution, role_label, folder, delivery_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    recip_data["id"], msg_id, None,
                    recip_data["recipient_email"], recip_data["recipient_name"],
                    recip_data["recipient_type"], recip_data["is_registered"],
                    recip_data["institution"], recip_data["role_label"],
                    recip_data["folder"], recip_data["delivery_status"]
                ))
                resolved_recipients.append(recip_data)
                # Unregistered contacts automatically receive email via Gmail API
                external_emails_to_dispatch.append((clean_to, p_name))

        conn.commit()

        # 3. Deliver external email via Gmail API v1 if required
        dispatched_email_count = 0
        if external_emails_to_dispatch:
            for ext_email, ext_name in external_emails_to_dispatch:
                try:
                    official_email_body = f"""{clean_body}

----------------------------------------------------------------------
[AICTE VigilOS Internal Communication System]
Official Transmittal Reference: {msg_ref}
Sender: {sender_name}
VigilOS Role: {sender_role_label}
Bureau / Department: {sender_institution}
Jurisdiction / Region: {sender_region}
Official Email: {sender_email}
Sent at: {now_iso}
----------------------------------------------------------------------
This message was transmitted through AICTE VigilOS — National Technical
Education Oversight & Vigilance Portal.
"""
                    import html
                    clean_body_html = html.escape(clean_body).replace("\n", "<br/>")
                    official_email_html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AICTE VigilOS Official Message</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; padding: 24px; margin: 0;">
  <div style="max-width: 620px; margin: 0 auto; background: #111827; border: 1px solid #dc2626; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <div style="background: linear-gradient(135deg, #991b1b, #dc2626); padding: 20px 24px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">AICTE Vigil<span style="color: #fca5a5;">OS</span></h2>
      <p style="margin: 4px 0 0; font-size: 11px; opacity: 0.95; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600;">Official Bureau & Institutional Transmittal</p>
    </div>
    <div style="padding: 24px;">
      <div style="background: #1f2937; border-left: 4px solid #ef4444; padding: 14px 18px; border-radius: 8px; margin-bottom: 22px; font-size: 13px; color: #9ca3af; line-height: 1.5;">
        <div style="margin: 2px 0;"><strong style="color: #f3f4f6;">Reference:</strong> <span style="color: #ef4444; font-family: monospace; font-weight: 700;">{msg_ref}</span></div>
        <div style="margin: 2px 0;"><strong style="color: #f3f4f6;">From:</strong> {sender_name} ({sender_role_label})</div>
        <div style="margin: 2px 0;"><strong style="color: #f3f4f6;">Bureau / Institution:</strong> {sender_institution}</div>
        <div style="margin: 2px 0;"><strong style="color: #f3f4f6;">Jurisdiction:</strong> {sender_region}</div>
        <div style="margin: 2px 0;"><strong style="color: #f3f4f6;">Subject:</strong> <span style="color: #ffffff; font-weight: 600;">{clean_subj}</span></div>
        <div style="margin: 2px 0;"><strong style="color: #f3f4f6;">Timestamp:</strong> {now_iso}</div>
      </div>
      <div style="font-size: 14px; line-height: 1.7; color: #f3f4f6; margin: 20px 0; background: #0f172a; padding: 18px; border-radius: 8px; border: 1px solid #1e293b;">
        {clean_body_html}
      </div>
    </div>
    <div style="background: #090d16; padding: 16px 24px; border-top: 1px solid #1f2937; font-size: 11px; color: #6b7280; text-align: center; line-height: 1.4;">
      This official communication was transmitted through <strong>AICTE VigilOS</strong> — National Technical Education Oversight & Vigilance Portal.
      <br/>Responses and updates are logged authoritatively into the VigilOS case audit trail.
    </div>
  </div>
</body>
</html>"""

                    gmail_mailer.send_email(
                        to_email=ext_email,
                        subject=f"[AICTE VigilOS] {clean_subj}",
                        html_body=official_email_html,
                        text_body=official_email_body,
                        body=official_email_body
                    )
                    dispatched_email_count += 1
                    print(f"[Comms Mailer] Successfully dispatched official email to {ext_email} via Gmail API")
                except Exception as mail_err:
                    print(f"[Comms Mailer Notice] Could not dispatch external copy to {ext_email}: {mail_err}")
                    # Internal message was still successfully stored in DB

        res_payload = {
            "ok": True,
            "message_id": msg_id,
            "message_ref": msg_ref,
            "thread_id": thread_id,
            "sender": {
                "id": sender_uid,
                "name": sender_name,
                "email": sender_email,
                "role": sender_role,
                "role_label": sender_role_label,
                "bureau": sender_bureau,
                "region": sender_region,
                "institution": sender_institution,
            },
            "recipients": resolved_recipients,
            "sent_at": now_iso,
            "dispatched_email_count": dispatched_email_count,
        }

        # Record idempotency key if provided
        if idempotency_key:
            try:
                cur.execute('''
                    INSERT OR REPLACE INTO internal_idempotency_keys 
                    (idempotency_key, user_id, message_id, response_json, created_at)
                    VALUES (?, ?, ?, ?, ?)
                ''', (idempotency_key.strip(), sender_uid, msg_id, json.dumps(res_payload), now_iso))
                conn.commit()
            except Exception as iek_err:
                print(f"[Comms] Could not record idempotency key: {iek_err}")

        # If converted from an active draft, delete the draft record
        if draft_id:
            try:
                cur.execute("DELETE FROM internal_drafts WHERE id = ? AND user_id = ?", (draft_id.strip(), sender_uid))
                conn.commit()
            except Exception as dft_err:
                print(f"[Comms] Could not cleanup converted draft: {dft_err}")

        return res_payload

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def _dedupe_messages(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    res = []
    for m in items:
        mid = m.get("id")
        if mid not in seen:
            seen.add(mid)
            res.append(m)
    res.sort(key=lambda x: x.get("ts", 0), reverse=True)
    return res

def list_user_messages(user: Dict[str, Any], folder: str = "inbox", query: Optional[str] = None, label: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetch persistent messages for the user by folder: inbox, sent, starred, trash, drafts, or label:<name>.
    Strictly isolated per-user:
    - User A trashing or permanently deleting an email never affects User B's mailbox copy.
    - Trashed items only show for users who specifically trashed their own copy.
    - Permanently deleted items are removed from that user's view and purged from DB once no references remain.
    """
    user_id = user["id"]
    conn = get_conn()
    cur = conn.cursor()

    q_clean = query.strip().lower() if query else ""
    target_label = label.strip() if label else (folder[6:].strip() if folder.startswith("label:") else None)

    try:
        # 1. Drafts Folder
        if folder == "drafts":
            rows = get_user_drafts(user_id)
            if q_clean:
                rows = [
                    m for m in rows
                    if q_clean in f"{m.get('subject', '')} {m.get('body', '')} {m.get('to', '')}".lower()
                ]
            return rows

        rows: List[Dict[str, Any]] = []

        # 2. Sent Folder (Messages sent by this user that they haven't trashed or deleted)
        if folder == "sent":
            cur.execute('''
                SELECT 
                    m.id, m.message_ref, m.subject, m.body, m.created_at, m.sent_at,
                    m.sender_user_id, m.sender_name, m.sender_email, m.sender_role,
                    m.sender_role_label, m.sender_bureau, m.sender_region, m.sender_institution,
                    m.thread_id, m.delivery_type, m.attachments_json,
                    COALESCE(m.sender_labels_json, '[]') as labels_json,
                    COALESCE(m.sender_starred, 0) as starred,
                    'sent' as folder,
                    1 as is_sent_by_me,
                    1 as read
                FROM internal_messages m
                WHERE m.sender_user_id = ? 
                  AND (m.sender_folder IS NULL OR m.sender_folder = 'sent')
                ORDER BY m.created_at DESC
            ''', (user_id,))
            rows = [dict(r) for r in cur.fetchall()]
            _populate_message_metadata(cur, rows, user_name=user.get("name"), is_sent=True)

        # 3. Starred Folder (Starred received items AND starred sent items, excluding trash & deleted)
        elif folder == "starred":
            # Received starred
            cur.execute('''
                SELECT 
                    m.id, m.message_ref, m.subject, m.body, m.created_at, m.sent_at,
                    m.sender_user_id, m.sender_name, m.sender_email, m.sender_role,
                    m.sender_role_label, m.sender_bureau, m.sender_region, m.sender_institution,
                    m.thread_id, m.delivery_type, m.attachments_json,
                    r.id as recipient_entry_id, r.read_at, r.starred, r.folder,
                    COALESCE(r.labels_json, '[]') as labels_json,
                    0 as is_sent_by_me
                FROM internal_message_recipients r
                JOIN internal_messages m ON r.message_id = m.id
                WHERE r.recipient_user_id = ? 
                  AND r.starred = 1 
                  AND (r.folder IS NULL OR r.folder NOT IN ('trash', 'deleted'))
                ORDER BY m.created_at DESC
            ''', (user_id,))
            recv_rows = [dict(r) for r in cur.fetchall()]
            _populate_message_metadata(cur, recv_rows, user_name=user.get("name"), is_sent=False)

            # Sent starred
            cur.execute('''
                SELECT 
                    m.id, m.message_ref, m.subject, m.body, m.created_at, m.sent_at,
                    m.sender_user_id, m.sender_name, m.sender_email, m.sender_role,
                    m.sender_role_label, m.sender_bureau, m.sender_region, m.sender_institution,
                    m.thread_id, m.delivery_type, m.attachments_json,
                    COALESCE(m.sender_labels_json, '[]') as labels_json,
                    1 as starred,
                    'sent' as folder,
                    1 as is_sent_by_me,
                    1 as read
                FROM internal_messages m
                WHERE m.sender_user_id = ? 
                  AND m.sender_starred = 1
                  AND (m.sender_folder IS NULL OR m.sender_folder = 'sent')
                ORDER BY m.created_at DESC
            ''', (user_id,))
            sent_rows = [dict(r) for r in cur.fetchall()]
            _populate_message_metadata(cur, sent_rows, user_name=user.get("name"), is_sent=True)

            rows = _dedupe_messages(recv_rows + sent_rows)

        # 4. Trash Folder (Strictly items trashed by THIS user, never leaking other accounts)
        elif folder == "trash":
            # 4a. Received items moved to trash by this recipient
            cur.execute('''
                SELECT 
                    m.id, m.message_ref, m.subject, m.body, m.created_at, m.sent_at,
                    m.sender_user_id, m.sender_name, m.sender_email, m.sender_role,
                    m.sender_role_label, m.sender_bureau, m.sender_region, m.sender_institution,
                    m.thread_id, m.delivery_type, m.attachments_json,
                    r.id as recipient_entry_id, r.read_at, r.starred, 'trash' as folder,
                    COALESCE(r.labels_json, '[]') as labels_json,
                    0 as is_sent_by_me
                FROM internal_message_recipients r
                JOIN internal_messages m ON r.message_id = m.id
                WHERE r.recipient_user_id = ? 
                  AND r.folder = 'trash'
                ORDER BY m.created_at DESC
            ''', (user_id,))
            recv_trash = [dict(r) for r in cur.fetchall()]
            _populate_message_metadata(cur, recv_trash, user_name=user.get("name"), is_sent=False)

            # 4b. Sent items moved to trash by this sender
            cur.execute('''
                SELECT 
                    m.id, m.message_ref, m.subject, m.body, m.created_at, m.sent_at,
                    m.sender_user_id, m.sender_name, m.sender_email, m.sender_role,
                    m.sender_role_label, m.sender_bureau, m.sender_region, m.sender_institution,
                    m.thread_id, m.delivery_type, m.attachments_json,
                    COALESCE(m.sender_labels_json, '[]') as labels_json,
                    COALESCE(m.sender_starred, 0) as starred,
                    'trash' as folder,
                    1 as is_sent_by_me,
                    1 as read
                FROM internal_messages m
                WHERE m.sender_user_id = ? 
                  AND m.sender_folder = 'trash'
                ORDER BY m.created_at DESC
            ''', (user_id,))
            sent_trash = [dict(r) for r in cur.fetchall()]
            _populate_message_metadata(cur, sent_trash, user_name=user.get("name"), is_sent=True)

            rows = _dedupe_messages(recv_trash + sent_trash)

        # 5. Label Filter View
        elif target_label:
            # Check received items matching label
            cur.execute('''
                SELECT 
                    m.id, m.message_ref, m.subject, m.body, m.created_at, m.sent_at,
                    m.sender_user_id, m.sender_name, m.sender_email, m.sender_role,
                    m.sender_role_label, m.sender_bureau, m.sender_region, m.sender_institution,
                    m.thread_id, m.delivery_type, m.attachments_json,
                    r.id as recipient_entry_id, r.read_at, r.starred, r.folder,
                    COALESCE(r.labels_json, '[]') as labels_json,
                    0 as is_sent_by_me
                FROM internal_message_recipients r
                JOIN internal_messages m ON r.message_id = m.id
                WHERE r.recipient_user_id = ? 
                  AND (r.folder IS NULL OR r.folder NOT IN ('trash', 'deleted'))
                ORDER BY m.created_at DESC
            ''', (user_id,))
            recv_candidates = [dict(r) for r in cur.fetchall()]
            _populate_message_metadata(cur, recv_candidates, user_name=user.get("name"), is_sent=False)
            recv_matching = [m for m in recv_candidates if target_label in m.get("labels", [])]

            # Check sent items matching label
            cur.execute('''
                SELECT 
                    m.id, m.message_ref, m.subject, m.body, m.created_at, m.sent_at,
                    m.sender_user_id, m.sender_name, m.sender_email, m.sender_role,
                    m.sender_role_label, m.sender_bureau, m.sender_region, m.sender_institution,
                    m.thread_id, m.delivery_type, m.attachments_json,
                    COALESCE(m.sender_labels_json, '[]') as labels_json,
                    COALESCE(m.sender_starred, 0) as starred,
                    'sent' as folder,
                    1 as is_sent_by_me,
                    1 as read
                FROM internal_messages m
                WHERE m.sender_user_id = ? 
                  AND (m.sender_folder IS NULL OR m.sender_folder = 'sent')
                ORDER BY m.created_at DESC
            ''', (user_id,))
            sent_candidates = [dict(r) for r in cur.fetchall()]
            _populate_message_metadata(cur, sent_candidates, user_name=user.get("name"), is_sent=True)
            sent_matching = [m for m in sent_candidates if target_label in m.get("labels", [])]

            rows = _dedupe_messages(recv_matching + sent_matching)

        # 6. Default: Inbox Folder (Received by this user, not trashed or deleted)
        else:
            cur.execute('''
                SELECT 
                    m.id, m.message_ref, m.subject, m.body, m.created_at, m.sent_at,
                    m.sender_user_id, m.sender_name, m.sender_email, m.sender_role,
                    m.sender_role_label, m.sender_bureau, m.sender_region, m.sender_institution,
                    m.thread_id, m.delivery_type, m.attachments_json,
                    r.id as recipient_entry_id, r.read_at, r.starred, r.folder,
                    COALESCE(r.labels_json, '[]') as labels_json,
                    0 as is_sent_by_me
                FROM internal_message_recipients r
                JOIN internal_messages m ON r.message_id = m.id
                WHERE r.recipient_user_id = ? 
                  AND (r.folder IS NULL OR r.folder = 'inbox')
                ORDER BY m.created_at DESC
            ''', (user_id,))
            rows = [dict(r) for r in cur.fetchall()]
            _populate_message_metadata(cur, rows, user_name=user.get("name"), is_sent=False)

        # Apply search query filtering
        if q_clean:
            filtered = []
            for m in rows:
                searchable = f"{m.get('subject', '')} {m.get('body', '')} {m.get('from', '')} {m.get('to', '')} {m.get('message_ref', '')} {m.get('sender_institution', '')}".lower()
                if q_clean in searchable:
                    filtered.append(m)
            return filtered

        return rows
    finally:
        conn.close()

def _populate_message_metadata(cur, rows: List[Dict[str, Any]], user_name: Optional[str] = None, is_sent: bool = False):
    """Helper to populate recipient summaries, timestamps, and parsed label lists."""
    for row in rows:
        row["from"] = row.get("sender_name") or row.get("sender_email") or "AICTE Officer"
        if is_sent:
            cur.execute('''
                SELECT recipient_name, recipient_email, role_label, institution, is_registered
                FROM internal_message_recipients
                WHERE message_id = ?
            ''', (row["id"],))
            rcpts = [dict(rc) for rc in cur.fetchall()]
            row["recipients"] = rcpts
            row["to"] = ", ".join([rc["recipient_name"] or rc["recipient_email"] for rc in rcpts]) or "Recipient"
            row["read"] = True
        else:
            row["to"] = user_name or "Me"
            row["read"] = bool(row.get("read_at"))

        # Parse labels
        try:
            row["labels"] = json.loads(row.get("labels_json") or "[]")
        except Exception:
            row["labels"] = []

        # Parse starred
        row["starred"] = bool(row.get("starred"))

        # Parse timestamp
        created_str = row.get("created_at") or row.get("sent_at")
        if created_str:
            try:
                row["ts"] = int(datetime.datetime.fromisoformat(created_str).timestamp() * 1000)
            except Exception:
                row["ts"] = 0
        else:
            row["ts"] = 0

def get_message_detail(message_id: str, current_user: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fetch full message details. Verifies that the requesting user is either
    the sender or one of the recipients (strict message-level authorization).
    Marks message as read for the recipient.
    """
    user_id = current_user["id"]
    conn = get_conn()
    cur = conn.cursor()

    try:
        cur.execute('SELECT * FROM internal_messages WHERE id = ?', (message_id,))
        m = cur.fetchone()
        if not m:
            raise ValueError("Message not found.")

        msg = dict(m)

        # Fetch recipients
        cur.execute('SELECT * FROM internal_message_recipients WHERE message_id = ?', (message_id,))
        recipients = [dict(r) for r in cur.fetchall()]

        is_sender = (msg["sender_user_id"] == user_id)
        current_rcpt = next((r for r in recipients if r.get("recipient_user_id") == user_id), None)
        is_recipient = current_rcpt is not None

        # Allow super_admin or involved parties
        if not (is_sender or is_recipient or current_user.get("role") == "super_admin"):
            raise PermissionError("Access denied. You are not an authorized recipient of this internal message.")

        # If current user is a recipient, mark read
        if is_recipient:
            now_iso = datetime.datetime.now().isoformat()
            cur.execute('''
                UPDATE internal_message_recipients
                SET read_at = COALESCE(read_at, ?)
                WHERE message_id = ? AND recipient_user_id = ?
            ''', (now_iso, message_id, user_id))
            conn.commit()
            msg["read"] = True
            msg["starred"] = bool(current_rcpt.get("starred"))
            msg["folder"] = current_rcpt.get("folder") or "inbox"
            try:
                msg["labels"] = json.loads(current_rcpt.get("labels_json") or "[]")
            except Exception:
                msg["labels"] = []
        else:
            # Current user is the sender
            msg["read"] = True
            msg["starred"] = bool(msg.get("sender_starred"))
            msg["folder"] = msg.get("sender_folder") or "sent"
            try:
                msg["labels"] = json.loads(msg.get("sender_labels_json") or "[]")
            except Exception:
                msg["labels"] = []

        msg["recipients"] = recipients
        msg["is_sender"] = is_sender
        msg["from"] = msg["sender_name"]
        msg["to"] = ", ".join([r["recipient_name"] or r["recipient_email"] for r in recipients])
        created_str = msg.get("created_at")
        msg["ts"] = int(datetime.datetime.fromisoformat(created_str).timestamp() * 1000) if created_str else 0
        return msg
    finally:
        conn.close()

def set_message_user_state(
    message_id: str,
    user_id: str,
    read: Optional[bool] = None,
    starred: Optional[bool] = None,
    folder: Optional[str] = None,
    labels: Optional[List[str]] = None,
    is_permanent_delete: bool = False,
    conn=None,
    cur=None,
    auto_commit: bool = True,
) -> bool:
    """
    Update read, starred, folder, labels, or permanent deletion state
    strictly isolated to the authenticated user's account.
    Reuses connection if supplied, preventing SQLite locking conflicts.
    """
    created_conn = False
    if conn is None:
        conn = get_conn()
        cur = conn.cursor()
        created_conn = True
    elif cur is None:
        cur = conn.cursor()

    now_iso = datetime.datetime.now().isoformat()

    try:
        # Check if draft with this ID
        if message_id.startswith("dft_"):
            if is_permanent_delete or folder == "trash":
                cur.execute("DELETE FROM internal_drafts WHERE id = ? AND user_id = ?", (message_id, user_id))
                if auto_commit:
                    conn.commit()
                return True

        # Check user's role on the message
        cur.execute("SELECT id, folder, starred, labels_json FROM internal_message_recipients WHERE message_id = ? AND recipient_user_id = ?", (message_id, user_id))
        rcpt_entry = cur.fetchone()

        cur.execute("SELECT id, sender_folder, sender_starred, sender_labels_json FROM internal_messages WHERE id = ? AND sender_user_id = ?", (message_id, user_id))
        sender_entry = cur.fetchone()

        if not rcpt_entry and not sender_entry:
            # Check draft
            cur.execute("SELECT id FROM internal_drafts WHERE id = ? AND user_id = ?", (message_id, user_id))
            if cur.fetchone():
                cur.execute("DELETE FROM internal_drafts WHERE id = ? AND user_id = ?", (message_id, user_id))
                if auto_commit:
                    conn.commit()
                return True
            return False

        # ── PERMANENT DELETE ──
        if is_permanent_delete:
            if rcpt_entry:
                cur.execute('''
                    UPDATE internal_message_recipients
                    SET folder = 'deleted', deleted_at = ?
                    WHERE message_id = ? AND recipient_user_id = ?
                ''', (now_iso, message_id, user_id))

            if sender_entry:
                cur.execute('''
                    UPDATE internal_messages
                    SET sender_folder = 'deleted', sender_deleted_at = ?
                    WHERE id = ? AND sender_user_id = ?
                ''', (now_iso, message_id, user_id))

            # Garbage Collection: If all recipients and the sender have permanently deleted, purge completely
            cur.execute("SELECT sender_folder FROM internal_messages WHERE id = ?", (message_id,))
            msg_check = cur.fetchone()
            if msg_check and msg_check["sender_folder"] == "deleted":
                cur.execute('''
                    SELECT COUNT(*) as active_cnt
                    FROM internal_message_recipients
                    WHERE message_id = ? AND (folder IS NULL OR folder != 'deleted')
                ''', (message_id,))
                rcpt_check = cur.fetchone()
                if not rcpt_check or rcpt_check["active_cnt"] == 0:
                    # Purge underlying message from database
                    cur.execute("DELETE FROM internal_messages WHERE id = ?", (message_id,))
                    print(f"[Comms Purge] Message {message_id} completely purged as all mailbox copies were deleted.")

            if auto_commit:
                conn.commit()
            return True

        # ── FOLDER / TRASH / RESTORE ──
        if folder is not None:
            if folder == "restore":
                # Restore to normal location
                if rcpt_entry:
                    cur.execute("UPDATE internal_message_recipients SET folder = 'inbox' WHERE message_id = ? AND recipient_user_id = ?", (message_id, user_id))
                if sender_entry:
                    cur.execute("UPDATE internal_messages SET sender_folder = 'sent' WHERE id = ? AND sender_user_id = ?", (message_id, user_id))
            else:
                if rcpt_entry:
                    cur.execute("UPDATE internal_message_recipients SET folder = ? WHERE message_id = ? AND recipient_user_id = ?", (folder, message_id, user_id))
                if sender_entry:
                    cur.execute("UPDATE internal_messages SET sender_folder = ? WHERE id = ? AND sender_user_id = ?", (folder, message_id, user_id))

        # ── READ / UNREAD ──
        if read is not None:
            val = now_iso if read else None
            if rcpt_entry:
                cur.execute("UPDATE internal_message_recipients SET read_at = ? WHERE message_id = ? AND recipient_user_id = ?", (val, message_id, user_id))

        # ── STARRED / UNSTARRED ──
        if starred is not None:
            s_val = 1 if starred else 0
            if rcpt_entry:
                cur.execute("UPDATE internal_message_recipients SET starred = ? WHERE message_id = ? AND recipient_user_id = ?", (s_val, message_id, user_id))
            if sender_entry:
                cur.execute("UPDATE internal_messages SET sender_starred = ? WHERE id = ? AND sender_user_id = ?", (s_val, message_id, user_id))

        # ── LABELS ──
        if labels is not None:
            lbl_json = json.dumps(labels)
            if rcpt_entry:
                cur.execute("UPDATE internal_message_recipients SET labels_json = ? WHERE message_id = ? AND recipient_user_id = ?", (lbl_json, message_id, user_id))
            if sender_entry:
                cur.execute("UPDATE internal_messages SET sender_labels_json = ? WHERE id = ? AND sender_user_id = ?", (lbl_json, message_id, user_id))

        if auto_commit:
            conn.commit()
        return True
    except Exception as e:
        if created_conn:
            conn.rollback()
        raise e
    finally:
        if created_conn:
            conn.close()

# Alias for backward compatibility
set_message_recipient_state = set_message_user_state

def bulk_message_action(user_id: str, message_ids: List[str], action: str, label_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Execute bulk operations across selected messages with account isolation.
    Runs entirely within a single atomic transaction on one SQLite connection to prevent locking.
    """
    clean_ids = [m for m in message_ids if m]
    if not clean_ids:
        return {"ok": True, "count": 0}

    conn = get_conn()
    cur = conn.cursor()
    success_count = 0

    try:
        for mid in clean_ids:
            if action == "trash":
                set_message_user_state(mid, user_id, folder="trash", conn=conn, cur=cur, auto_commit=False)
            elif action == "restore":
                set_message_user_state(mid, user_id, folder="restore", conn=conn, cur=cur, auto_commit=False)
            elif action == "delete_permanently":
                cur.execute("DELETE FROM internal_drafts WHERE id = ? AND user_id = ?", (mid, user_id))
                set_message_user_state(mid, user_id, is_permanent_delete=True, conn=conn, cur=cur, auto_commit=False)
            elif action == "read":
                set_message_user_state(mid, user_id, read=True, conn=conn, cur=cur, auto_commit=False)
            elif action == "unread":
                set_message_user_state(mid, user_id, read=False, conn=conn, cur=cur, auto_commit=False)
            elif action == "star":
                set_message_user_state(mid, user_id, starred=True, conn=conn, cur=cur, auto_commit=False)
            elif action == "unstar":
                set_message_user_state(mid, user_id, starred=False, conn=conn, cur=cur, auto_commit=False)
            elif action in ("add_label", "remove_label") and label_name:
                _modify_message_label(cur, mid, user_id, label_name, "add" if action == "add_label" else "remove")
            success_count += 1

        conn.commit()
        return {"ok": True, "count": success_count}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def _modify_message_label(cur, message_id: str, user_id: str, label_name: str, op: str):
    """Add or remove a label on a message for the user."""
    # Check recipient
    cur.execute("SELECT labels_json FROM internal_message_recipients WHERE message_id = ? AND recipient_user_id = ?", (message_id, user_id))
    r = cur.fetchone()
    if r:
        try:
            lbls = json.loads(r["labels_json"] or "[]")
        except Exception:
            lbls = []
        if op == "add" and label_name not in lbls:
            lbls.append(label_name)
        elif op == "remove" and label_name in lbls:
            lbls = [x for x in lbls if x != label_name]
        cur.execute("UPDATE internal_message_recipients SET labels_json = ? WHERE message_id = ? AND recipient_user_id = ?", (json.dumps(lbls), message_id, user_id))

    # Check sender
    cur.execute("SELECT sender_labels_json FROM internal_messages WHERE id = ? AND sender_user_id = ?", (message_id, user_id))
    s = cur.fetchone()
    if s:
        try:
            lbls = json.loads(s["sender_labels_json"] or "[]")
        except Exception:
            lbls = []
        if op == "add" and label_name not in lbls:
            lbls.append(label_name)
        elif op == "remove" and label_name in lbls:
            lbls = [x for x in lbls if x != label_name]
        cur.execute("UPDATE internal_messages SET sender_labels_json = ? WHERE id = ? AND sender_user_id = ?", (json.dumps(lbls), message_id, user_id))

# ── DRAFTS SERVICE ──────────────────────────────────────────────
def save_draft(
    user: Dict[str, Any],
    to_recipients: Optional[List[Any]] = None,
    subject: Optional[str] = "",
    body: Optional[str] = "",
    draft_id: Optional[str] = None,
    thread_id: Optional[str] = None,
    in_reply_to: Optional[str] = None,
    attachments: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Save or update an automatic draft associated with authenticated user."""
    user_id = user["id"]
    now_iso = datetime.datetime.now().isoformat()
    conn = get_conn()
    cur = conn.cursor()

    try:
        # Standardize recipients into JSON
        cleaned_recips = []
        for r in (to_recipients or []):
            if isinstance(r, dict):
                cleaned_recips.append({
                    "email": (r.get("email") or "").strip().lower(),
                    "name": r.get("name") or "",
                    "role_label": r.get("role_label") or "",
                    "institution": r.get("institution") or "",
                    "is_registered": bool(r.get("is_registered", True)),
                })
            elif isinstance(r, str) and r.strip():
                clean_email = r.strip().lower()
                cleaned_recips.append({
                    "email": clean_email,
                    "name": clean_email.split("@")[0].replace(".", " ").title(),
                    "is_registered": False,
                })

        recips_json = json.dumps(cleaned_recips)
        clean_subj = (subject or "").strip()
        clean_body = (body or "").strip()
        att_json = json.dumps(attachments or [])

        # If existing draft ID belongs to this user, update it
        if draft_id and draft_id.startswith("dft_"):
            cur.execute("SELECT id FROM internal_drafts WHERE id = ? AND user_id = ?", (draft_id, user_id))
            if cur.fetchone():
                cur.execute('''
                    UPDATE internal_drafts
                    SET to_recipients_json = ?, subject = ?, body = ?, thread_id = ?, in_reply_to = ?, attachments_json = ?, updated_at = ?
                    WHERE id = ? AND user_id = ?
                ''', (recips_json, clean_subj, clean_body, thread_id, in_reply_to, att_json, now_iso, draft_id, user_id))
                conn.commit()
                return {"ok": True, "draft_id": draft_id, "updated_at": now_iso}

        # Check if an existing draft by this user already matches this thread or subject to avoid duplication
        if clean_subj:
            cur.execute('''
                SELECT id FROM internal_drafts
                WHERE user_id = ? AND subject = ?
                ORDER BY updated_at DESC LIMIT 1
            ''', (user_id, clean_subj))
            matched = cur.fetchone()
            if matched:
                matched_id = matched["id"]
                cur.execute('''
                    UPDATE internal_drafts
                    SET to_recipients_json = ?, subject = ?, body = ?, thread_id = ?, in_reply_to = ?, attachments_json = ?, updated_at = ?
                    WHERE id = ? AND user_id = ?
                ''', (recips_json, clean_subj, clean_body, thread_id, in_reply_to, att_json, now_iso, matched_id, user_id))
                conn.commit()
                return {"ok": True, "draft_id": matched_id, "updated_at": now_iso}

        # Otherwise create a new draft
        new_dft_id = f"dft_{uuid.uuid4().hex[:14]}"
        cur.execute('''
            INSERT INTO internal_drafts (id, user_id, to_recipients_json, subject, body, thread_id, in_reply_to, attachments_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (new_dft_id, user_id, recips_json, clean_subj, clean_body, thread_id, in_reply_to, att_json, now_iso, now_iso))
        conn.commit()
        return {"ok": True, "draft_id": new_dft_id, "updated_at": now_iso}
    finally:
        conn.close()

def get_user_drafts(user_id: str) -> List[Dict[str, Any]]:
    """Retrieve all drafts for the authenticated user."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM internal_drafts WHERE user_id = ? ORDER BY updated_at DESC", (user_id,))
        rows = [dict(r) for r in cur.fetchall()]
        drafts = []
        for row in rows:
            try:
                recips = json.loads(row.get("to_recipients_json") or "[]")
            except Exception:
                recips = []
            to_str = ", ".join([rc.get("name") or rc.get("email") for rc in recips]) if recips else ""
            ts = int(datetime.datetime.fromisoformat(row["updated_at"]).timestamp() * 1000) if row.get("updated_at") else 0
            drafts.append({
                "id": row["id"],
                "message_ref": f"DRAFT-{row['id'][-6:].upper()}",
                "subject": row["subject"] or "(Draft - No Subject)",
                "body": row["body"] or "",
                "from": "Draft",
                "to": to_str or "(No recipients)",
                "recipients": recips,
                "thread_id": row["thread_id"],
                "in_reply_to": row["in_reply_to"],
                "attachments": json.loads(row.get("attachments_json") or "[]"),
                "ts": ts,
                "read": True,
                "starred": False,
                "folder": "drafts",
                "is_draft": True,
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            })
        return drafts
    finally:
        conn.close()

def delete_draft(draft_id: str, user_id: str) -> bool:
    """Delete draft by ID belonging to authenticated user."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM internal_drafts WHERE id = ? AND user_id = ?", (draft_id, user_id))
        conn.commit()
        return True
    finally:
        conn.close()

# ── LABELS SERVICE ──────────────────────────────────────────────
def get_user_labels(user_id: str) -> List[Dict[str, Any]]:
    """Retrieve all custom and default labels for the authenticated user."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, name, color FROM internal_user_labels WHERE user_id = ? ORDER BY name ASC", (user_id,))
        rows = [dict(r) for r in cur.fetchall()]
        if not rows:
            now_iso = datetime.datetime.now().isoformat()
            for def_name in ["Important", "Admin", "Personal"]:
                cur.execute(
                    "INSERT OR IGNORE INTO internal_user_labels (id, user_id, name, color, created_at) VALUES (?, ?, ?, 'red', ?)",
                    (f"lbl_{user_id}_{def_name.lower()}", user_id, def_name, now_iso)
                )
            conn.commit()
            cur.execute("SELECT id, name, color FROM internal_user_labels WHERE user_id = ? ORDER BY name ASC", (user_id,))
            rows = [dict(r) for r in cur.fetchall()]
        return rows
    finally:
        conn.close()

def create_user_label(user_id: str, name: str, color: str = "red") -> Dict[str, Any]:
    """Create a new personal label for the authenticated user."""
    clean_name = name.strip()
    if not clean_name:
        raise ValueError("Label name cannot be empty.")
    conn = get_conn()
    cur = conn.cursor()
    now_iso = datetime.datetime.now().isoformat()
    lbl_id = f"lbl_{uuid.uuid4().hex[:12]}"
    try:
        cur.execute('''
            INSERT INTO internal_user_labels (id, user_id, name, color, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (lbl_id, user_id, clean_name, color, now_iso))
        conn.commit()
        return {"id": lbl_id, "name": clean_name, "color": color}
    finally:
        conn.close()

def delete_user_label(user_id: str, label_name: str) -> bool:
    """Delete a custom label for the authenticated user."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM internal_user_labels WHERE user_id = ? AND name = ?", (user_id, label_name.strip()))
        conn.commit()
        return True
    finally:
        conn.close()

def get_unread_count(user_id: str) -> int:
    """Return count of unread messages in user's inbox."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute('''
            SELECT COUNT(*) as unread_count
            FROM internal_message_recipients
            WHERE recipient_user_id = ? 
              AND (folder IS NULL OR folder = 'inbox') 
              AND read_at IS NULL
        ''', (user_id,))
        row = cur.fetchone()
        return row["unread_count"] if row else 0
    finally:
        conn.close()

# Backwards compatibility alias
set_message_recipient_state = set_message_user_state

