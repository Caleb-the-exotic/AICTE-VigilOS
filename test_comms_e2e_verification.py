import os
import sys
import uuid
import json

# Ensure project root is in path
sys.path.insert(0, os.getcwd())

from campus.db import get_conn
from campus import comms_service

print("Starting E2E Comms Verification...")

# 1. Fetch two active users
conn = get_conn()
cur = conn.cursor()
cur.execute("SELECT id, name, normalized_email FROM users WHERE status = 'active' LIMIT 2")
rows = cur.fetchall()

if len(rows) < 2:
    print("Need at least 2 users for verification, creating second user...")
    u1 = dict(rows[0])
    u2 = {
        "id": "usr_e2e_peer",
        "name": "E2E Peer Officer",
        "normalized_email": "peer.officer@aicte.gov.in",
        "email": "peer.officer@aicte.gov.in",
        "bureau_code": "HQ",
        "region_code": "HQ",
        "status": "active"
    }
    cur.execute('''
        INSERT OR IGNORE INTO users (id, name, normalized_email, bureau_code, region_code, status)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (u2["id"], u2["name"], u2["normalized_email"], u2["bureau_code"], u2["region_code"], u2["status"]))
    conn.commit()
else:
    u1 = dict(rows[0])
    u2 = dict(rows[1])

conn.close()

user_a = {
    "id": u1["id"],
    "name": u1["name"],
    "email": u1["normalized_email"],
    "role_key": "super_admin",
    "bureau": "Central Vigilance HQ",
    "region": "HQ (New Delhi)"
}

user_b = {
    "id": u2["id"],
    "name": u2["name"],
    "email": u2["normalized_email"],
    "role_key": "approval_officer",
    "bureau": "Regional Bureau",
    "region": "Northern"
}

print(f"User A: {user_a['name']} ({user_a['id']})")
print(f"User B: {user_b['name']} ({user_b['id']})")

# --- TEST 1: Send Message & Test Idempotency ---
idem_key = f"test-idem-{uuid.uuid4().hex[:8]}"
send_res_1 = comms_service.send_internal_message(
    sender_user=user_a,
    to_recipients=[user_b["email"]],
    subject="Confidential Vigilance Report - E2E Test",
    body="Detailed audit of institutional accounts.",
    send_external_email=False,
    idempotency_key=idem_key
)
msg_id = send_res_1["message_id"]
print(f"Created message {msg_id}")

# Attempt duplicate send with identical idempotency key
send_res_2 = comms_service.send_internal_message(
    sender_user=user_a,
    to_recipients=[user_b["email"]],
    subject="Confidential Vigilance Report - E2E Test (Duplicate)",
    body="Duplicate attempt should return cached response without second message creation.",
    send_external_email=False,
    idempotency_key=idem_key
)

assert send_res_1["message_id"] == send_res_2["message_id"], "Idempotency failed: generated different message_id!"
print("PASS: Idempotency prevents duplicate message delivery.")

# Verify User B received message in inbox
b_inbox = comms_service.list_user_messages(user=user_b, folder="inbox")
assert any(m["id"] == msg_id for m in b_inbox), "User B did not receive message in inbox!"
print("PASS: User B received message in inbox.")

# Verify User A has message in sent
a_sent = comms_service.list_user_messages(user=user_a, folder="sent")
assert any(m["id"] == msg_id for m in a_sent), "User A does not have message in sent!"
print("PASS: User A has message in sent folder.")

# --- TEST 2: Isolated Trash Behavior ---
# User B moves message to trash
comms_service.set_message_user_state(message_id=msg_id, user_id=user_b["id"], folder="trash")

# Verify User B sees it in trash and NOT in inbox
b_inbox_after = comms_service.list_user_messages(user=user_b, folder="inbox")
assert not any(m["id"] == msg_id for m in b_inbox_after), "Message still visible in User B inbox after trashing!"

b_trash = comms_service.list_user_messages(user=user_b, folder="trash")
assert any(m["id"] == msg_id for m in b_trash), "Message not visible in User B trash!"

# Verify User A still has message in sent and NOT in User A trash
a_sent_after = comms_service.list_user_messages(user=user_a, folder="sent")
assert any(m["id"] == msg_id for m in a_sent_after), "User A sent message was affected by User B trash!"

a_trash = comms_service.list_user_messages(user=user_a, folder="trash")
assert not any(m["id"] == msg_id for m in a_trash), "Message leaked into User A trash when User B trashed it!"
print("PASS: Trashing in User B is strictly isolated from User A.")

# --- TEST 3: Permanent Deletion & Cascade Clean-up ---
# User B permanently deletes from Trash
comms_service.set_message_user_state(message_id=msg_id, user_id=user_b["id"], is_permanent_delete=True)

# User B trash should be empty of this message
b_trash_after = comms_service.list_user_messages(user=user_b, folder="trash")
assert not any(m["id"] == msg_id for m in b_trash_after), "Message still in User B trash after permanent delete!"

# User A still has sent copy
a_sent_still = comms_service.list_user_messages(user=user_a, folder="sent")
assert any(m["id"] == msg_id for m in a_sent_still), "User A copy lost when User B permanently deleted!"
print("PASS: Permanent deletion by User B preserves User A copy.")

# User A now permanently deletes sent copy
comms_service.set_message_user_state(message_id=msg_id, user_id=user_a["id"], is_permanent_delete=True)
a_sent_final = comms_service.list_user_messages(user=user_a, folder="sent")
assert not any(m["id"] == msg_id for m in a_sent_final), "Message still in User A sent after permanent delete!"

# Message record should be completely purged since all parties permanently deleted
conn = get_conn()
cur = conn.cursor()
cur.execute("SELECT id FROM internal_messages WHERE id = ?", (msg_id,))
row = cur.fetchone()
conn.close()
assert row is None, "Underlying message was not purged after all parties permanently deleted!"
print("PASS: Cascading purge cleaned up message when all parties permanently deleted.")

# --- TEST 4: Drafts Autosave & Resume ---
draft = comms_service.save_draft(
    user=user_a,
    to_recipients=["principal@college.edu"],
    subject="Draft Inspection Memo",
    body="Initial notes on campus infrastructure..."
)
dft_id = draft["draft_id"]

# Update same draft
draft_update = comms_service.save_draft(
    user=user_a,
    draft_id=dft_id,
    to_recipients=["principal@college.edu", "dean@college.edu"],
    subject="Draft Inspection Memo - Revised",
    body="Updated notes on campus infrastructure and labs..."
)
assert draft_update["draft_id"] == dft_id, "Draft update created new draft ID instead of updating existing!"

# Fetch drafts
dfts = comms_service.get_user_drafts(user_id=user_a["id"])
matched_dft = next((d for d in dfts if d["id"] == dft_id), None)
assert matched_dft is not None, "Draft not found in user drafts!"
assert matched_dft["subject"] == "Draft Inspection Memo - Revised", "Draft content not updated!"
print("PASS: Drafts autosave reuses ID and updates content.")

# Send email referencing draft_id
send_from_draft = comms_service.send_internal_message(
    sender_user=user_a,
    to_recipients=["principal@college.edu"],
    subject="Draft Inspection Memo - Revised",
    body="Finalized text.",
    send_external_email=False,
    draft_id=dft_id
)

# Verify draft is cleaned up after sending
dfts_after_send = comms_service.get_user_drafts(user_id=user_a["id"])
assert not any(d["id"] == dft_id for d in dfts_after_send), "Draft was not deleted after message was sent!"
print("PASS: Draft automatically deleted upon send.")

# --- TEST 5: Custom User Labels ---
label_name = f"Confidential-{uuid.uuid4().hex[:4]}"
comms_service.create_user_label(user_id=user_a["id"], name=label_name, color="#f97316")
labels = comms_service.get_user_labels(user_id=user_a["id"])
assert any(l["name"] == label_name for l in labels), "Created label not found in user labels!"

# User B must NOT see User A private label
b_labels = comms_service.get_user_labels(user_id=user_b["id"])
assert not any(l["name"] == label_name for l in b_labels), "User A label leaked into User B labels!"
print("PASS: User labels are strictly isolated per account.")

print("\nALL E2E COMMS & MAILING VERIFICATION TESTS PASSED SUCCESSFULLY!")
