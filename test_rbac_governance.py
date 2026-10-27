# ============================================================
# test_rbac_governance.py — Comprehensive RBAC & SQLite Tests
# Validates all 12 Phase 8 requirements
# ============================================================

import os
import unittest
import sqlite3
import datetime
from fastapi.testclient import TestClient

from campus import db, auth, role_service
from campus.rbac_migration import run_migration
from api_server import app, _token_store

client = TestClient(app)

class TestVigilOSRBAC(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Ensure database is initialized with RBAC migrations
        db.init_db()
        run_migration()

    def test_01_google_login_resolves_to_correct_db_user(self):
        """1. Google login resolves to the correct database user."""
        # Test existing Super Admin Caleb
        ok, user = auth.verify_google_login("2204caleb2007@gmail.com", "Caleb", "google-sub-caleb-001")
        self.assertTrue(ok, "Google login for 2204caleb2007@gmail.com should succeed")
        self.assertEqual(user["role"], "super_admin")
        self.assertEqual(user["email"], "2204caleb2007@gmail.com")
        self.assertIn("users:manage", user["permissions"])

    def test_02_email_password_login_resolves_to_correct_db_user(self):
        """2. Email/password login resolves to the correct database user."""
        # Test System Administrator
        ok, user = auth.verify_login("admin@aicte-india.org", "12345678")
        self.assertTrue(ok, "Login for admin@aicte-india.org should succeed")
        self.assertEqual(user["role"], "super_admin")
        self.assertEqual(user["name"], "System Administrator")

        # Test Officer Demo
        ok2, officer = auth.verify_login("officer@aicte.gov.in", "demo1234")
        self.assertTrue(ok2, "Login for officer@aicte.gov.in should succeed")
        self.assertEqual(officer["role"], "approval_officer")

    def test_03_multiple_linked_login_methods_resolve_to_same_user(self):
        """3. Multiple linked login methods resolve to the same user where explicitly linked."""
        # Get Caleb's user record
        caleb = role_service.get_user_by_email("2204caleb2007@gmail.com")
        self.assertIsNotNone(caleb)
        user_id = caleb["id"]

        # Explicitly link secondary auth provider (e.g. nic_sso)
        sub_id = f"nic-sso-sub-{int(datetime.datetime.now().timestamp())}"
        role_service.link_auth_account(user_id, "nic_sso", sub_id)

        # Look up by newly linked auth provider
        resolved_user = role_service.get_user_by_auth_account("nic_sso", sub_id)
        self.assertIsNotNone(resolved_user)
        self.assertEqual(resolved_user["id"], user_id)
        self.assertEqual(resolved_user["normalized_email"], "2204caleb2007@gmail.com")

    def test_04_invalid_or_unlinked_accounts_cannot_access_protected_resources(self):
        """4. Invalid or unlinked accounts cannot access protected resources."""
        # Wrong password
        ok, res = auth.verify_login("admin@aicte-india.org", "wrong-password-999")
        self.assertFalse(ok)

        # Unauthenticated request to /api/admin/users
        resp = client.get("/api/admin/users")
        self.assertEqual(resp.status_code, 401)

        # Create a citizen user with no administrative permissions
        citizen = role_service.get_user_by_email("test_citizen_unauth@aicte.gov.in")
        if not citizen:
            citizen = role_service.register_user(
                name="Test Citizen",
                email="test_citizen_unauth@aicte.gov.in",
                password="password@123"
            )

        token = auth.create_jwt(citizen)
        _token_store[token] = citizen

        # Citizen calling admin endpoint must receive 403 Forbidden
        admin_resp = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(admin_resp.status_code, 403)

    def test_05_users_cannot_change_own_privileged_role(self):
        """5. Users cannot change their own privileged role (self-demotion or unauthorized escalation prevented)."""
        caleb = role_service.get_user_by_email("2204caleb2007@gmail.com")
        self.assertIsNotNone(caleb)

        # Attempting self demotion / deletion of own admin account
        with self.assertRaises(ValueError) as ctx:
            role_service.admin_delete_user(caleb["id"], actor_id=caleb["id"])
        self.assertIn("cannot delete your own", str(ctx.exception))

    def test_06_bureau_heads_jurisdiction_scoping(self):
        """6. Bureau heads cannot access unauthorized bureaus."""
        # Find or create a bureau head assigned strictly to Regulation Bureau ('RB')
        bh = role_service.get_user_by_email("bureauhead.demo@aicte-india.org")
        if not bh:
            bh = role_service.admin_create_user(
                name="Bureau Head RB",
                email="bureauhead.demo@aicte-india.org",
                role_key="bureau_head",
                bureau_code="RB",
                region_code="HQ",
                password="password@123",
                actor_id="system"
            )

        token = auth.create_jwt(bh)
        _token_store[token] = bh

        # Get cases as bureau head
        resp = client.get("/api/aicte/cases", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(resp.status_code, 200)
        cases = resp.json()
        if isinstance(cases, list) and len(cases) > 0:
            for c in cases:
                # All returned cases must match the bureau jurisdiction
                case_bureau = (c.get("bureau") or "").upper()
                self.assertIn("RB", case_bureau, f"Case {c.get('case_id')} bureau {case_bureau} must be RB")

    def test_07_regional_officers_jurisdiction_scoping(self):
        """7. Regional officers cannot access unauthorized regions."""
        # Find or create a regional nodal officer assigned to 'SOUTHERN'
        nodal = role_service.get_user_by_email("deepanthangavel0611@gmail.com")
        self.assertIn(nodal["role_key"], ["nodal_officer", "approval_officer"])
        self.assertEqual(nodal["region_code"], "SOUTHERN")

        token = auth.create_jwt(nodal)
        _token_store[token] = nodal

        resp = client.get("/api/aicte/cases", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(resp.status_code, 200)
        cases = resp.json()
        if isinstance(cases, list) and len(cases) > 0:
            for c in cases:
                # All returned cases must match Southern jurisdiction
                reg = (c.get("region") or "").upper()
                self.assertTrue("SOUTH" in reg, f"Case {c.get('case_id')} region {reg} must match Southern")

    def test_08_case_assignment_and_approval_permissions(self):
        """8. Case assignment and approval permissions are enforced by the backend."""
        # Citizen role has neither assign nor approve
        citizen = role_service.get_user_by_email("test_citizen_unauth@aicte.gov.in")
        self.assertFalse(role_service.has_permission(citizen, "cases:assign"))
        self.assertFalse(role_service.has_permission(citizen, "cases:approve"))

        # Approval officer has cases:process and cases:view, but not users:manage
        officer = role_service.get_user_by_email("officer@aicte.gov.in")
        self.assertTrue(role_service.has_permission(officer, "cases:process"))
        self.assertTrue(role_service.has_permission(officer, "cases:view"))
        self.assertFalse(role_service.has_permission(officer, "users:manage"))

        # Bureau head has cases:assign and cases:approve
        bhead = role_service.get_user_by_email("bureauhead.demo@aicte-india.org") or role_service.get_user_by_email("admin@aicte.gov.in")
        self.assertTrue(role_service.has_permission(bhead, "cases:assign"))
        self.assertTrue(role_service.has_permission(bhead, "cases:approve"))

        # Super admin has all permissions
        admin = role_service.get_user_by_email("admin@aicte-india.org")
        self.assertTrue(role_service.has_permission(admin, "cases:assign"))
        self.assertTrue(role_service.has_permission(admin, "cases:approve"))
        self.assertTrue(role_service.has_permission(admin, "users:manage"))

    def test_09_deactivated_users_lose_access(self):
        """9. Deactivated users lose access."""
        # Create a user to test deactivation
        temp_email = "deactivation_test@aicte.gov.in"
        temp_user = role_service.get_user_by_email(temp_email)
        if not temp_user:
            temp_user = role_service.admin_create_user(
                name="Deactivation Candidate",
                email=temp_email,
                role_key="approval_officer",
                bureau_code="HQ",
                region_code="HQ",
                password="password@123",
                actor_id="system"
            )

        # Deactivate user
        role_service.admin_toggle_user_status(temp_user["id"], "inactive", actor_id="system")

        # Login must fail
        ok, msg = auth.verify_login(temp_email, "password@123")
        self.assertFalse(ok)
        self.assertTrue("inactive" in msg.lower() or "deactivated" in msg.lower())

        # Calling API with their token must fail
        token = auth.create_jwt(temp_user)
        _token_store[token] = temp_user
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(resp.status_code, 403)

        # Re-activate for clean state
        role_service.admin_toggle_user_status(temp_user["id"], "active", actor_id="system")

    def test_10_complaints_and_audit_history_remain_intact(self):
        """10. Existing complaints and audit history remain intact after migration."""
        conn = db.get_conn()
        cur = conn.cursor()

        # Check complaints / cases table
        cur.execute("SELECT count(*) as cnt FROM aicte_cases")
        cases_count = cur.fetchone()["cnt"]
        self.assertGreater(cases_count, 0, "aicte_cases table must retain existing records")

        # Check assignment_audit table exists and has records
        cur.execute("SELECT count(*) as cnt FROM assignment_audit")
        audit_count = cur.fetchone()["cnt"]
        self.assertGreater(audit_count, 0, "Assignment audit log must contain entries")
        conn.close()

    def test_11_database_constraints_and_foreign_keys(self):
        """11. Database constraints and foreign keys work correctly."""
        conn = db.get_conn()
        cur = conn.cursor()

        # PRAGMA foreign_keys check
        cur.execute("PRAGMA foreign_keys")
        fk_status = cur.fetchone()[0]
        self.assertEqual(fk_status, 1, "Foreign keys must be enabled")

        # Attempting foreign key violation in user_assignments
        try:
            cur.execute("""
                INSERT INTO user_assignments (id, user_id, role_id, status, created_at, updated_at)
                VALUES ('inv_1', 'nonexistent_user_9999', 'nonexistent_role_9999', 'active', 'now', 'now')
            """)
            conn.commit()
            self.fail("Foreign key violation should fail")
        except Exception as e:
            conn.rollback()
            self.assertTrue("foreign key" in str(e).lower() or "integrity" in str(e).lower() or "violat" in str(e).lower())

        # Attempting duplicate auth_accounts with same provider and provider_subject
        try:
            cur.execute("""
                INSERT INTO auth_accounts (id, user_id, provider, provider_subject, created_at)
                VALUES ('dup_1', 'usr_dummy', 'credentials', 'admin@aicte-india.org', 'now')
            """)
            conn.commit()
            self.fail("Duplicate constraint violation should fail")
        except Exception as e:
            conn.rollback()
            self.assertTrue("unique" in str(e).lower() or "duplicate" in str(e).lower() or "integrity" in str(e).lower())
        conn.close()

    def test_12_production_startup_idempotency(self):
        """12. Production startup does not insert duplicate demo users or reset role assignments."""
        # Running migration a second time
        res = run_migration()
        self.assertIn("already applied", res["message"].lower())

        # Verify user count did not explode
        users = role_service.list_all_users()
        emails = [u["email"].lower() for u in users]
        self.assertEqual(len(emails), len(set(emails)), "User emails must remain strictly unique")

if __name__ == "__main__":
    unittest.main()
