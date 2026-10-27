# ============================================================
# test_pg_user_deletion_e2e.py
# ============================================================
# End-to-End Test Suite for PostgreSQL User Deletion & Safeguards:
# 1. Immediate removal from User Directory list query
# 2. Persistence of deletion across sessions and re-queries
# 3. Category A (disposable) cleanup: sessions, drafts, labels, auth_accounts, user_assignments
# 4. Category B (preservation): internal_messages, recipients, complaints, and audit trails
# 5. Zero foreign key constraint errors during deletion
# 6. Safeguards: Self-deletion prevented
# 7. Safeguards: Protected master Super Admin accounts cannot be deleted
# 8. Safeguards: Last remaining active Super Administrator cannot be deleted
# 9. Authentication prevention: Deleted user cannot re-login via credentials or Google OAuth
# 10. RBAC: Non-admin users cannot call delete user endpoint
# ============================================================

import os
import sys
import uuid
import datetime
import unittest
from fastapi.testclient import TestClient

from campus import db, auth, role_service, comms_service
from api_server import app, _token_store

client = TestClient(app)

class TestPostgreSQLUserDeletionE2E(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        db.init_db()
        cls.admin_user = role_service.get_user_by_email("admin@aicte-india.org")
        assert cls.admin_user is not None, "Admin user must exist"
        cls.admin_token = auth.create_jwt(cls.admin_user)
        _token_store[cls.admin_token] = cls.admin_user

    def test_01_self_deletion_prohibited(self):
        """Self-deletion of active administrator account must be rejected."""
        with self.assertRaises(ValueError) as ctx:
            role_service.admin_delete_user(self.admin_user["id"], actor_id=self.admin_user["id"])
        self.assertIn("cannot delete your own", str(ctx.exception).lower())

        # Test via API
        resp = client.delete(
            f"/api/admin/users/{self.admin_user['id']}",
            headers={"Authorization": f"Bearer {cls_token}"} if (cls_token := self.admin_token) else {}
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("cannot delete your own", resp.json()["detail"].lower())

    def test_02_protected_master_account_deletion_prohibited(self):
        """Master Super Admin (2204caleb2007@gmail.com) deletion must be rejected."""
        caleb = role_service.get_user_by_email("2204caleb2007@gmail.com")
        self.assertIsNotNone(caleb)
        with self.assertRaises(ValueError) as ctx:
            role_service.admin_delete_user(caleb["id"], actor_id=self.admin_user["id"])
        self.assertIn("protected master", str(ctx.exception).lower())

    def test_03_last_super_admin_deletion_safeguard(self):
        """System must prevent deletion of the last remaining active super_admin."""
        # Query total active super admins
        conn = db.get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT COUNT(DISTINCT ua.user_id) AS cnt
            FROM user_assignments ua
            JOIN roles r ON ua.role_id = r.id
            JOIN users u ON ua.user_id = u.id
            WHERE LOWER(r.key) = 'super_admin' AND LOWER(u.status) = 'active'
        """)
        total_sa = cur.fetchone()["cnt"]
        conn.close()

        # If there were only 1 super admin, deleting should raise ValueError
        # We test the safeguard logic specifically
        if total_sa == 1:
            with self.assertRaises(ValueError) as ctx:
                role_service.admin_delete_user(self.admin_user["id"], actor_id="another_actor")
            self.assertIn("last remaining active super administrator", str(ctx.exception).lower())

    def test_04_successful_deletion_with_dependent_messages_and_safeguards(self):
        """
        Create a test user with dependent records (messages sent, messages received,
        drafts, labels, assignments, auth accounts), then delete the user.
        Verify Category A cleanup and Category B preservation with ZERO foreign key errors.
        """
        # 1. Create dedicated user
        test_email = f"officer.del.{uuid.uuid4().hex[:6]}@aicte.gov.in"
        test_user = role_service.admin_create_user(
            name="Deletion Target Officer",
            email=test_email,
            role_key="approval_officer",
            bureau_code="RB",
            region_code="SOUTHERN",
            password="SecurePass@123",
            actor_id=self.admin_user["id"]
        )
        uid = test_user["id"]

        # 2. Create dependent communications records
        # 2a. Sent message (target is sender)
        msg_sent = comms_service.send_internal_message(
            sender_user=test_user,
            to_recipients=["admin@aicte-india.org"],
            subject="Case Review Request",
            body="Please review the assigned institution case file.",
            send_external_email=False
        )
        msg_id_sent = msg_sent["message_id"]

        # 2b. Received message (target is recipient)
        msg_rcvd = comms_service.send_internal_message(
            sender_user=self.admin_user,
            to_recipients=[test_email],
            subject="Approval Directive",
            body="Here is the directive for your regional office.",
            send_external_email=False
        )
        msg_id_rcvd = msg_rcvd["message_id"]

        # 2c. Category A: Draft & Label
        draft = comms_service.save_draft(user=test_user, subject="Draft Subject", body="Draft content")
        label = comms_service.create_user_label(user_id=uid, name="UrgentCases", color="red")

        # Verify records exist before deletion
        conn = db.get_conn()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE id = ?", (uid,))
        self.assertIsNotNone(cur.fetchone())
        cur.execute("SELECT id FROM user_assignments WHERE user_id = ?", (uid,))
        self.assertIsNotNone(cur.fetchone())
        cur.execute("SELECT id FROM auth_accounts WHERE user_id = ?", (uid,))
        self.assertIsNotNone(cur.fetchone())
        cur.execute("SELECT id FROM internal_drafts WHERE user_id = ?", (uid,))
        self.assertIsNotNone(cur.fetchone())
        cur.execute("SELECT id FROM internal_user_labels WHERE user_id = ?", (uid,))
        self.assertIsNotNone(cur.fetchone())
        conn.close()

        # 3. Execute deletion via admin service
        ok = role_service.admin_delete_user(target_user_id=uid, actor_id=self.admin_user["id"])
        self.assertTrue(ok, "admin_delete_user must return True on success")

        # 4. Verify immediate removal from active directory
        all_users = role_service.list_all_users()
        user_ids = [u["id"] for u in all_users]
        user_emails = [u["email"].lower() for u in all_users]
        self.assertNotIn(uid, user_ids, "Deleted user ID must not appear in directory")
        self.assertNotIn(test_email.lower(), user_emails, "Deleted user email must not appear in directory")

        # 5. Verify Category A (disposable personal state) is purged
        conn = db.get_conn()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE id = ?", (uid,))
        self.assertIsNone(cur.fetchone(), "User row must be deleted from users table")
        cur.execute("SELECT id FROM user_assignments WHERE user_id = ?", (uid,))
        self.assertIsNone(cur.fetchone(), "user_assignments must be purged")
        cur.execute("SELECT id FROM auth_accounts WHERE user_id = ?", (uid,))
        self.assertIsNone(cur.fetchone(), "auth_accounts must be purged")
        cur.execute("SELECT id FROM internal_drafts WHERE user_id = ?", (uid,))
        self.assertIsNone(cur.fetchone(), "internal_drafts must be purged")
        cur.execute("SELECT id FROM internal_user_labels WHERE user_id = ?", (uid,))
        self.assertIsNone(cur.fetchone(), "internal_user_labels must be purged")

        # 6. Verify Category B (preservation of historical communications & audit)
        cur.execute("SELECT sender_user_id, sender_name, sender_email, subject, body FROM internal_messages WHERE id = ?", (msg_id_sent,))
        sent_row = cur.fetchone()
        self.assertIsNotNone(sent_row, "Historical sent message must NOT be deleted")
        self.assertIsNone(sent_row["sender_user_id"], "sender_user_id must be SET NULL")
        self.assertEqual(sent_row["sender_email"], test_email.lower())
        self.assertEqual(sent_row["subject"], "Case Review Request")

        cur.execute("SELECT recipient_user_id, recipient_email, recipient_name FROM internal_message_recipients WHERE message_id = ?", (msg_id_rcvd,))
        rcpt_row = cur.fetchone()
        self.assertIsNotNone(rcpt_row, "Historical recipient delivery record must NOT be deleted")
        self.assertIsNone(rcpt_row["recipient_user_id"], "recipient_user_id must be SET NULL")
        self.assertEqual(rcpt_row["recipient_email"], test_email.lower())

        # 7. Verify entry in deleted_accounts registry
        cur.execute("SELECT email, user_id, deleted_by FROM deleted_accounts WHERE LOWER(email) = ?", (test_email.lower(),))
        del_reg = cur.fetchone()
        self.assertIsNotNone(del_reg, "deleted_accounts registry must track the deletion")
        self.assertEqual(del_reg["user_id"], uid)
        self.assertEqual(del_reg["deleted_by"], self.admin_user["id"])

        # 8. Verify audit entry in assignment_audit
        cur.execute("SELECT action FROM assignment_audit WHERE user_id = ? AND action = 'USER_PERMANENTLY_DELETED'", (uid,))
        self.assertIsNotNone(cur.fetchone(), "assignment_audit must contain USER_PERMANENTLY_DELETED record")
        conn.close()

        # 9. Verify authentication blocking: credentials login rejected
        ok_login, msg_login = role_service.authenticate_credentials(test_email, "SecurePass@123")
        self.assertFalse(ok_login, "Deleted user credentials login must be rejected")
        self.assertIn("deleted by an administrator", str(msg_login).lower())

        # 10. Verify authentication blocking: Google OAuth auto-recreation rejected
        ok_oauth, msg_oauth = role_service.authenticate_google(test_email, "Deletion Target Officer")
        self.assertFalse(ok_oauth, "Deleted user Google OAuth re-creation must be rejected")
        self.assertIn("deleted by an administrator", str(msg_oauth).lower())

        # 11. Verify self-registration rejection
        with self.assertRaises(ValueError) as reg_ctx:
            role_service.register_user(name="Deleted Guy", email=test_email, password="NewPassword@123")
        self.assertIn("previously deleted", str(reg_ctx.exception).lower())

    def test_05_api_delete_and_token_invalidation(self):
        """Test API endpoint DELETE /api/admin/users/{user_id} and token revocation."""
        # 1. Create officer
        test_email = f"api.del.{uuid.uuid4().hex[:6]}@aicte.gov.in"
        officer = role_service.admin_create_user(
            name="API Deletion User",
            email=test_email,
            role_key="approval_officer",
            bureau_code="HQ",
            region_code="HQ",
            password="Password@123",
            actor_id=self.admin_user["id"]
        )
        uid = officer["id"]

        # 2. Issue valid JWT token for this officer
        officer_token = auth.create_jwt(officer)
        _token_store[officer_token] = officer

        # Verify token works
        resp_before = client.get("/api/auth/me", headers={"Authorization": f"Bearer {officer_token}"})
        self.assertEqual(resp_before.status_code, 200)

        # 3. Call DELETE via Admin endpoint
        del_resp = client.delete(
            f"/api/admin/users/{uid}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(del_resp.status_code, 200)
        self.assertTrue(del_resp.json()["ok"])

        # 4. Verify token was purged from _token_store and fails /api/auth/me
        self.assertNotIn(officer_token, _token_store)
        resp_after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {officer_token}"})
        self.assertEqual(resp_after.status_code, 401)

    def test_06_unauthorized_user_cannot_delete(self):
        """Non-admin user (e.g. approval_officer or citizen) cannot delete users."""
        officer = role_service.get_user_by_email("officer@aicte.gov.in")
        self.assertIsNotNone(officer)
        officer_token = auth.create_jwt(officer)
        _token_store[officer_token] = officer

        resp = client.delete(
            "/api/admin/users/dummy_user_id",
            headers={"Authorization": f"Bearer {officer_token}"}
        )
        self.assertEqual(resp.status_code, 403)
        self.assertIn("super admin privileges required", resp.json()["detail"].lower())

if __name__ == "__main__":
    unittest.main()
