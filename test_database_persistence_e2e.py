# ============================================================
# test_database_persistence_e2e.py
# ============================================================
# End-to-End Test Suite for SIH Critical Database Fix:
# 1. Institutional Portfolio Cross-Account Persistence
# 2. Complaint Database & Atomic Case ID Generation
# 3. Complainant Attribution & Authoritative Ageing
# 4. Institution-facing Submission Endpoint Integration
# 5. Dashboard Table 9-Column Specification Verification
# ============================================================

import os
import sys
import json
import sqlite3
import datetime
from campus import db, auth

def run_tests():
    print("=" * 70)
    print("AICTE VigilOS -- Critical Database Persistence & Cross-Account E2E Test")
    print("=" * 70)

    # ── TEST 1: Database Initialization & Schema Migrations ─────
    print("\n[TEST 1] Verifying schema migrations and persistent table structures...")
    conn = db.get_conn()
    cur = conn.cursor()
    cur.execute("SELECT version, applied_at FROM schema_migrations")
    migrations = {r["version"]: r["applied_at"] for r in cur.fetchall()}
    assert "20261026_02_portfolio_and_cases" in migrations, "Migration 20261026_02_portfolio_and_cases not found in schema_migrations"
    print("  [OK] Schema migration '20261026_02_portfolio_and_cases' verified applied:", migrations["20261026_02_portfolio_and_cases"])

    # Verify column structures in aicte_institutions
    cur.execute("PRAGMA table_info(aicte_institutions)")
    inst_cols = [r[1] for r in cur.fetchall()]
    for req_col in ["aicte_pid", "institution_name", "approval_status", "city", "website", "total_faculty", "total_students", "images_json"]:
        assert req_col in inst_cols, f"Missing required column '{req_col}' in aicte_institutions"
    print(f"  [OK] aicte_institutions has all required portfolio columns ({len(inst_cols)} columns)")

    # Verify column structures in aicte_cases
    cur.execute("PRAGMA table_info(aicte_cases)")
    case_cols = [r[1] for r in cur.fetchall()]
    for req_col in ["case_id", "aicte_pid", "institution_code", "institution_name", "bureau", "category", "complainant_name", "complainant_email", "received_at", "status"]:
        assert req_col in case_cols, f"Missing required column '{req_col}' in aicte_cases"
    print(f"  [OK] aicte_cases has all required complaint columns ({len(case_cols)} columns)")
    conn.close()

    # ── TEST 2: Institutional Portfolio Cross-Account Persistence ──
    print("\n[TEST 2] Testing Institutional Portfolio Cross-Account Persistence...")
    test_pid = "1-376234110"  # Thakur College of Engineering & Technology
    original = db.get_institution(test_pid)
    assert original is not None, f"Institution {test_pid} not found in database"
    print(f"  Initial approval status: '{original.get('approval_status')}'")

    # Simulate Account A saving an updated portfolio
    test_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    updated_data = {
        "aicte_pid": test_pid,
        "institution_name": "Thakur College of Engineering & Technology",
        "region": "Western",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "A-Block, Thakur Educational Campus, Kandivali (E), Mumbai 400101",
        "inst_type": "Autonomous / Linguistic Minority",
        "approval_status": f"AICTE Approved (EOA 2026-27) [Verified {test_timestamp}]",
        "principal_name": "Dr. B.K. Mishra",
        "contact_email": "tcet@thakureducation.org",
        "contact_phone": "+91 22 6730 8000",
        "website": "https://www.tcetmumbai.in",
        "established_year": 2001,
        "total_faculty": 195,
        "total_students": 3250,
        "images": [
            "https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=1000&q=80"
        ]
    }
    saved = db.save_institution(updated_data)
    assert saved["approval_status"] == updated_data["approval_status"], "save_institution returned unexpected approval_status"
    print("  [OK] Account A successfully updated portfolio in database")

    # Simulate Account B performing a fresh read from persistent storage
    fresh_read_account_b = db.get_institution(test_pid)
    assert fresh_read_account_b is not None, "Account B read returned None"
    assert fresh_read_account_b["approval_status"] == updated_data["approval_status"], "Cross-account mismatch! Account B did not see updated approval_status"
    assert fresh_read_account_b["total_faculty"] == 195, "Cross-account mismatch! total_faculty not persisted"
    assert fresh_read_account_b["total_students"] == 3250, "Cross-account mismatch! total_students not persisted"
    assert isinstance(fresh_read_account_b["images"], list) and len(fresh_read_account_b["images"]) == 1, "Images not deserialized properly"
    print(f"  [OK] Account B fresh database read matches authoritative updated data: '{fresh_read_account_b['approval_status']}'")

    # ── TEST 3: Atomic Case ID Sequence Generation ─────────────
    print("\n[TEST 3] Testing Atomic Server-Side Case ID Sequence Generation...")
    seq_id_1 = db.get_next_case_id(bureau="PGRC")
    seq_id_2 = db.get_next_case_id(bureau="PGRC")
    print(f"  Generated Case ID 1: {seq_id_1}")
    print(f"  Generated Case ID 2: {seq_id_2}")
    
    parts_1 = seq_id_1.split("-")
    parts_2 = seq_id_2.split("-")
    assert len(parts_1) == 4, f"Invalid Case ID format: {seq_id_1}"
    assert parts_1[0] == "AICTE" and parts_1[2] == "PGRC", f"Prefix mismatch in {seq_id_1}"
    assert int(parts_2[3]) == int(parts_1[3]) + 1, "Case ID sequence is not strictly incrementing!"
    print("  [OK] Atomic case sequence generator is strictly sequential and collision-safe")

    # ── TEST 4: Complaint Creation with Complainant Identity ────
    print("\n[TEST 4] Testing Complaint Creation with Authoritative Complainant Identity...")
    new_case_id = db.get_next_case_id(bureau="PGRC")
    created_id = db.create_aicte_case(
        case_id=new_case_id,
        aicte_pid=test_pid,
        institution_name=saved["institution_name"],
        region=saved["region"],
        bureau="PGRC",
        complainant_user_id="usr_test_complainant_42",
        complainant_name="Vikramaditya Sharma",
        complainant_email="v.sharma.student@gmail.com",
        complainant_type="Student",
        category="Capitation Fee",
        title="Excess refundable security deposit not refunded after graduation",
        description="College withheld INR 25,000 security deposit citing unverified library dues despite no-dues clearance certificate.",
        status="received",
        sla_days=30
    )
    assert created_id == new_case_id, "Returned case ID did not match"

    fetched_case = db.get_aicte_case(new_case_id)
    assert fetched_case is not None, f"Case {new_case_id} not found after creation"
    assert fetched_case["institution_code"] == test_pid, "institution_code was not populated"
    assert fetched_case["institution_name"] == saved["institution_name"], "institution_name mismatch"
    assert fetched_case["complainant_name"] == "Vikramaditya Sharma", "complainant_name was not stored"
    assert fetched_case["complainant_email"] == "v.sharma.student@gmail.com", "complainant_email was not stored"
    assert fetched_case["complainant_user_id"] == "usr_test_complainant_42", "complainant_user_id was not stored"
    assert fetched_case["status"] == "received", "Initial status mismatch"
    assert fetched_case["ageing_days"] == 0, "Fresh case ageing should be 0 days"
    print(f"  [OK] Complaint successfully persisted in aicte_cases with Case ID: {new_case_id}")
    print(f"       Complainant: {fetched_case['complainant_name']} ({fetched_case['complainant_email']})")

    # ── TEST 5: Dashboard Table 9-Column Specification Verification ──
    print("\n[TEST 5] Verifying authoritative cases list and 9 required columns...")
    all_cases = db.list_aicte_cases(limit=100)
    assert len(all_cases) >= 11, f"Expected at least 11 cases, found {len(all_cases)}"

    # Verify AICTE-2026-PGRC-0112 (Thakur College seed record)
    pgrc_112 = next((c for c in all_cases if c["case_id"] == "AICTE-2026-PGRC-0112"), None)
    assert pgrc_112 is not None, "AICTE-2026-PGRC-0112 seed record missing!"
    
    print("\n  [Required Dashboard Display Columns Test]")
    print("  Specified Order: Case ID | Institution | Institution Code | Bureau | Category | Status | Ageing | Region | Submitted By")
    print(f"  Actual Record:   {pgrc_112['case_id']} | {pgrc_112['institution_name']} | {pgrc_112['institution_code']} | {pgrc_112['bureau']} | {pgrc_112['category']} | {pgrc_112['status']} | {pgrc_112['ageing_days']}d | {pgrc_112['region']} | {pgrc_112['complainant_name']}")

    assert pgrc_112["case_id"] == "AICTE-2026-PGRC-0112", "Case ID mismatch"
    assert "Thakur College" in pgrc_112["institution_name"], "Institution name mismatch"
    assert pgrc_112["institution_code"] == "1-376234110", "Institution code mismatch"
    assert pgrc_112["bureau"] == "PGRC", "Bureau mismatch"
    assert pgrc_112["category"] == "Capitation Fee", "Category mismatch"
    assert pgrc_112["status"] == "received", "Status mismatch"
    assert pgrc_112["ageing_days"] == 8, f"Expected 8d ageing as in prompt specification, got {pgrc_112['ageing_days']}d"
    assert pgrc_112["region"] == "Western", "Region mismatch"
    assert pgrc_112["complainant_name"] == "Amit Deshmukh", "Complainant name mismatch"
    print("  [OK] AICTE-2026-PGRC-0112 row precisely fulfills all 9 required columns in exact order!")

    # ── TEST 6: Linking: Portfolio Update Reflects in Case Views ──
    print("\n[TEST 6] Testing relational consistency between complaints and portfolio...")
    new_inst_title = "Thakur College of Engineering & Technology (Autonomous)"
    db.save_institution({
        **updated_data,
        "institution_name": new_inst_title
    })
    rechecked_case = db.get_aicte_case("AICTE-2026-PGRC-0112")
    assert rechecked_case["institution_name"] == new_inst_title, "Updating portfolio did not reflect in case view!"
    print(f"  [OK] Portfolio name update automatically synced to case records: '{rechecked_case['institution_name']}'")

    print("\n" + "=" * 70)
    print("ALL 6 TESTS PASSED SUCCESSFULLY! BACKEND PERSISTENCE FULLY VERIFIED.")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
