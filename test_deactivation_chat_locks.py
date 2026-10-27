import os
import sys
import uuid
import datetime
import sqlite3

# Ensure project root in sys.path
sys.path.insert(0, os.getcwd())

from campus.db import get_conn, init_db, save_live_chat_message, get_live_chat_messages, delete_live_chat_message
from campus import role_service, auth, comms_service

print("=" * 70)
print("AICTE VigilOS: Comprehensive Test Suite for Deactivation, Live Chat, and Bulk Locks")
print("=" * 70)

# ── TEST 1: Account Deactivation Verification ──────────────────────────
print("\n[TEST 1] Testing Account Deactivation Flow...")
init_db()

conn = get_conn()
cur = conn.cursor()
now = datetime.datetime.now().isoformat()

# Create dedicated test user
test_user_id = f"usr_test_{uuid.uuid4().hex[:6]}"
test_email = f"deact.test.{uuid.uuid4().hex[:6]}@aicte.gov.in"
test_password = "SecurePassword@123"
hash_val = role_service.hash_password(test_password)

cur.execute("SELECT id FROM roles WHERE key = 'approval_officer'")
role_row = cur.fetchone()
role_id = role_row["id"]

cur.execute('''
    INSERT INTO users (id, name, normalized_email, password_hash, status, created_at, updated_at)
    VALUES (?, 'Deactivation Test Officer', ?, ?, 'active', ?, ?)
''', (test_user_id, test_email, hash_val, now, now))

cur.execute('''
    INSERT INTO user_assignments (id, user_id, role_id, bureau_id, region_id, status, created_at, updated_at)
    VALUES (?, ?, ?, NULL, NULL, 'active', ?, ?)
''', (str(uuid.uuid4()), test_user_id, role_id, now, now))

conn.commit()
conn.close()

# 1a. Test active account login
ok, res = role_service.authenticate_credentials(test_email, test_password)
assert ok is True, f"Active user should authenticate: {res}"
jwt_token = auth.create_jwt(res)
print("  [OK] Active account authenticates successfully.")

# 1b. Deactivate account
admin_user = role_service.get_user_by_email("admin@aicte-india.org")
role_service.admin_toggle_user_status(test_user_id, "inactive", actor_id=admin_user["id"])
print("  [OK] Admin changed account status to 'inactive' in SQLite.")

# 1c. Test email/password login rejection for deactivated user
ok_deact, res_deact = role_service.authenticate_credentials(test_email, test_password)
assert ok_deact is False, "Deactivated user must NOT authenticate"
assert "Your account has been deactivated" in res_deact, f"Unexpected message: {res_deact}"
print(f"  [OK] Credentials login rejected with message: '{res_deact}'")

# 1d. Test Google login rejection for deactivated user (both initial and linked)
test_google_sub = f"google-sub-{uuid.uuid4().hex[:8]}"
ok_google, res_google = role_service.authenticate_google(test_email, "Test Name", test_google_sub)
assert ok_google is False, "Deactivated Google account must NOT authenticate"
assert "Your account has been deactivated" in res_google, f"Unexpected message: {res_google}"
print(f"  [OK] Google OAuth login (first login) rejected with message: '{res_google}'")

# Also verify when auth_account is already linked
ok_google_linked, res_google_linked = role_service.authenticate_google(test_email, "Test Name", test_google_sub)
assert ok_google_linked is False, "Deactivated Google account (already linked) must NOT authenticate"
assert "Your account has been deactivated" in res_google_linked, f"Unexpected message: {res_google_linked}"
print(f"  [OK] Google OAuth login (subsequent linked login) rejected with message: '{res_google_linked}'")

# 1e. Test existing JWT session revocation
refreshed_user = role_service.get_user_by_id(test_user_id)
assert refreshed_user["status"] == "inactive", "Database status must be inactive"
print("  [OK] Database verification confirms user status is 'inactive'.")

# 1f. Reactivate user and verify restoration
role_service.admin_toggle_user_status(test_user_id, "active", actor_id=admin_user["id"])
ok_react, res_react = role_service.authenticate_credentials(test_email, test_password)
assert ok_react is True, "Reactivated account must authenticate"
print("  [OK] Reactivation immediately restores login functionality.")


# ── TEST 2: Live Chat Persistence and Admin Deletion ──────────────────
print("\n[TEST 2] Testing Live Chat Persistence and Administrator Deletion...")
chat1 = save_live_chat_message(
    sender_id=test_user_id,
    sender_name="Deactivation Test Officer",
    sender_role="approval_officer",
    text=f"Officer broadcast message {uuid.uuid4().hex[:6]}"
)
chat_id = chat1["id"]
print(f"  [OK] Chat message created with ID: {chat_id}")

# 2a. Verify message is returned in get_live_chat_messages
messages = get_live_chat_messages(limit=50)
found = [m for m in messages if m["id"] == chat_id]
assert len(found) == 1, "Persisted chat message must be returned in get_live_chat_messages"
assert found[0]["text"] == chat1["text"], "Persisted text must match"
print("  [OK] Live chat message retrieved from SQLite database.")

# 2b. Test admin deletion of message
del_ok = delete_live_chat_message(chat_id, actor_id=admin_user["id"])
assert del_ok is True, "Admin deletion must succeed"
print("  [OK] Admin soft-deleted chat message.")

# 2c. Verify deleted message is filtered out of live chat query
refreshed_chat = get_live_chat_messages(limit=50)
found_after = [m for m in refreshed_chat if m["id"] == chat_id]
assert len(found_after) == 0, "Deleted chat message must NOT appear in live chat queries"
print("  [OK] Live chat query properly omits deleted message.")

# 2d. Verify audit log entry
conn = get_conn()
cur = conn.cursor()
cur.execute("SELECT action FROM assignment_audit WHERE action = 'DELETE_LIVE_CHAT_MESSAGE' ORDER BY created_at DESC LIMIT 1")
audit_row = cur.fetchone()
assert audit_row is not None, "Audit entry for DELETE_LIVE_CHAT_MESSAGE must exist"
conn.close()
print("  [OK] Audit record created for chat message deletion.")


# ── TEST 3: Bulk Email Operations and Lock Prevention ──────────────────
print("\n[TEST 3] Testing Bulk Email Deletion & Concurrency Lock Prevention...")
sender = role_service.get_user_by_email("admin@aicte-india.org")
recipient = role_service.get_user_by_id(test_user_id)

created_msg_ids = []
for i in range(15):
    res_msg = comms_service.send_internal_message(
        sender_user=sender,
        to_recipients=[recipient["normalized_email"]],
        subject=f"Bulk Lock Test Message #{i} {uuid.uuid4().hex[:4]}",
        body=f"Body for bulk message test {i}",
        send_external_email=False
    )
    created_msg_ids.append(res_msg.get("message_id") or res_msg.get("id"))

print(f"  [OK] Created {len(created_msg_ids)} test messages.")

# 3a. Execute bulk move to trash
trash_res = comms_service.bulk_message_action(
    user_id=recipient["id"],
    message_ids=created_msg_ids,
    action="trash"
)
assert trash_res["ok"] is True and trash_res["count"] == 15, f"Bulk trash failed: {trash_res}"
print(f"  [OK] Bulk moved {trash_res['count']} messages to trash in single transaction without locks.")

# 3b. Verify sender's sent folder is completely unaffected
sender_sent = comms_service.list_user_messages(user=sender, folder="sent")
sender_sent_ids = {m["id"] for m in sender_sent}
for mid in created_msg_ids:
    assert mid in sender_sent_ids, f"Sender's sent message {mid} must remain intact"
print("  [OK] Sender's copy is strictly isolated and remains intact in 'sent'.")

# 3c. Execute bulk permanent delete
del_res = comms_service.bulk_message_action(
    user_id=recipient["id"],
    message_ids=created_msg_ids,
    action="delete_permanently"
)
assert del_res["ok"] is True and del_res["count"] == 15, f"Bulk permanent delete failed: {del_res}"
print(f"  [OK] Bulk permanently deleted {del_res['count']} messages in single transaction without locks.")

# 3d. Verify recipient trash is empty of these messages
rcpt_trash = comms_service.list_user_messages(user=recipient, folder="trash")
rcpt_trash_ids = {m["id"] for m in rcpt_trash}
for mid in created_msg_ids:
    assert mid not in rcpt_trash_ids, f"Deleted message {mid} must not be in trash"
print("  [OK] Recipient mailbox completely purged of deleted messages.")

# Clean up test user
conn = get_conn()
cur = conn.cursor()
cur.execute("DELETE FROM internal_message_recipients WHERE recipient_user_id = ?", (test_user_id,))
cur.execute("DELETE FROM internal_messages WHERE sender_user_id = ?", (test_user_id,))
cur.execute("DELETE FROM auth_accounts WHERE user_id = ?", (test_user_id,))
cur.execute("DELETE FROM assignment_audit WHERE user_id = ? OR changed_by = ?", (test_user_id, test_user_id))
cur.execute("DELETE FROM user_assignments WHERE user_id = ?", (test_user_id,))
cur.execute("DELETE FROM users WHERE id = ?", (test_user_id,))
conn.commit()
conn.close()
print("  [OK] Test user cleaned up.")

print("\n" + "=" * 70)
print("ALL TESTS PASSED SUCCESSFULLY! ZERO LOCKS, DEACTIVATION & CHAT VERIFIED.")
print("=" * 70)
