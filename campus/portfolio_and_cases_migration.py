# ============================================================
# campus/portfolio_and_cases_migration.py
# ============================================================
# Version: 20261026_02_portfolio_and_cases
#
# Critical Database Fix:
# 1. Institutional Portfolio Database:
#    - Adds missing columns to aicte_institutions:
#      city, approval_status, website, established_year,
#      total_faculty, total_students, images_json, updated_at
#    - Seeds/updates full canonical portfolio records for all
#      15 AICTE institutions from DEFAULT_INSTITUTIONS
#
# 2. Complaint Database:
#    - Adds missing columns to aicte_cases:
#      institution_code, complainant_user_id, complainant_name,
#      complainant_email, received_at, resolved_at
#    - Seeds/updates authoritative complainant identity, received_at
#      timestamps, and institution codes for all existing cases
#    - Aligns AICTE-2026-PGRC-0112 (Thakur College) with 8-day ageing,
#      real complainant name ("Amit Deshmukh"), and PGRC bureau
#
# 3. Transaction-safe Case ID Sequences:
#    - Creates aicte_case_sequences table for server-side unique
#      case ID generation: AICTE-{year}-{bureau}-{number:04d}
# ============================================================

import os
import datetime
import json
from campus.db import get_conn

MIGRATION_VERSION = "20261026_02_portfolio_and_cases"

DEFAULT_PORTFOLIOS = [
    {
        "aicte_pid": "1-109723481",
        "institution_name": "Shri Ram Institute of Technology",
        "region": "Northern",
        "state": "Madhya Pradesh",
        "city": "Jabalpur",
        "address": "Near IT Park, Bargi Hills, Jabalpur, MP 482003",
        "inst_type": "Private / Self-Financed",
        "approval_status": "Notice Issued — Under Review",
        "principal_name": "Dr. R.K. Saxena",
        "contact_email": "director@sritgroup.net",
        "contact_phone": "+91 761 4001000",
        "website": "https://www.sritgroup.net",
        "established_year": 2001,
        "total_faculty": 142,
        "total_students": 2180,
        "images": [
            "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1000&q=80",
            "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80",
        ],
    },
    {
        "aicte_pid": "1-376234110",
        "institution_name": "Thakur College of Engineering & Technology",
        "region": "Western",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "A-Block, Thakur Educational Campus, Shyamnarayan Thakur Marg, Kandivali (E), Mumbai 400101",
        "inst_type": "Autonomous / Linguistic Minority",
        "approval_status": "AICTE Approved (EOA 2026-27)",
        "principal_name": "Dr. B.K. Mishra",
        "contact_email": "tcet@thakureducation.org",
        "contact_phone": "+91 22 6730 8000",
        "website": "https://www.tcetmumbai.in",
        "established_year": 2001,
        "total_faculty": 185,
        "total_students": 3120,
        "images": [
            "https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=1000&q=80",
            "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80",
        ],
    },
    {
        "aicte_pid": "1-204561892",
        "institution_name": "KL University (Koneru Lakshmaiah)",
        "region": "Southern",
        "state": "Andhra Pradesh",
        "city": "Vaddeswaram",
        "address": "Green Fields, Vaddeswaram, Guntur District, AP 522502",
        "inst_type": "Deemed to be University",
        "approval_status": "Show-Cause Notice (Anti-Ragging)",
        "principal_name": "Dr. G.P.S. Varma",
        "contact_email": "registrar@kluniversity.in",
        "contact_phone": "+91 863 2399999",
        "website": "https://www.kluniversity.in",
        "established_year": 1980,
        "total_faculty": 620,
        "total_students": 9400,
        "images": [
            "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1000&q=80",
            "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80",
        ],
    },
    {
        "aicte_pid": "1-445871203",
        "institution_name": "Kalinga Institute of Industrial Technology",
        "region": "Eastern",
        "state": "Odisha",
        "city": "Bhubaneswar",
        "address": "Patia, Bhubaneswar, Odisha 751024",
        "inst_type": "Deemed to be University",
        "approval_status": "Approved (EOA 2026-27)",
        "principal_name": "Prof. Sasmita Samanta",
        "contact_email": "info@kiit.ac.in",
        "contact_phone": "+91 674 2725113",
        "website": "https://kiit.ac.in",
        "established_year": 1992,
        "total_faculty": 1200,
        "total_students": 28000,
        "images": [
            "https://images.unsplash.com/photo-1519452635265-7b1fbfd1e4e0?auto=format&fit=crop&w=1000&q=80",
        ],
    },
    {
        "aicte_pid": "1-512398067",
        "institution_name": "SRM Institute of Science and Technology",
        "region": "Southern",
        "state": "Tamil Nadu",
        "city": "Kattankulathur",
        "address": "SRM Nagar, Kattankulathur, Chengalpattu District, TN 603203",
        "inst_type": "Deemed to be University",
        "approval_status": "Inquiry Ongoing (Faculty Affairs)",
        "principal_name": "Dr. C. Muthamizhchelvan",
        "contact_email": "registrar@srmist.edu.in",
        "contact_phone": "+91 44 27417000",
        "website": "https://www.srmist.edu.in",
        "established_year": 1985,
        "total_faculty": 1650,
        "total_students": 42000,
        "images": [
            "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=1000&q=80",
        ],
    },
    {
        "aicte_pid": "1-631047285",
        "institution_name": "GLA University",
        "region": "Northern",
        "state": "Uttar Pradesh",
        "city": "Mathura",
        "address": "17km Stone, NH-2, Mathura-Delhi Road, Chaumuhan, Mathura, UP 281406",
        "inst_type": "Private State University",
        "approval_status": "Transferred to Regional Directorate",
        "principal_name": "Prof. Phalguni Gupta",
        "contact_email": "glauniversity@gla.ac.in",
        "contact_phone": "+91 5662 250900",
        "website": "https://www.gla.ac.in",
        "established_year": 1998,
        "total_faculty": 480,
        "total_students": 12500,
        "images": [
            "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1000&q=80",
        ],
    },
    {
        "aicte_pid": "1-788234501",
        "institution_name": "Amity University Rajasthan",
        "region": "Northern",
        "state": "Rajasthan",
        "city": "Jaipur",
        "address": "SP-1, Kant Kalwar, RIICO Industrial Area, NH-11C, Jaipur, Rajasthan 303002",
        "inst_type": "Private University",
        "approval_status": "Notice Issued (Curriculum Audit)",
        "principal_name": "Prof. Amit Jain",
        "contact_email": "vc@jpr.amity.edu",
        "contact_phone": "+91 1426 405555",
        "website": "https://www.amity.edu/jaipur",
        "established_year": 2008,
        "total_faculty": 210,
        "total_students": 4500,
        "images": [
            "https://images.unsplash.com/photo-1571260899304-425eee4c7efc?auto=format&fit=crop&w=1000&q=80",
        ],
    },
    {
        "aicte_pid": "1-890123456",
        "institution_name": "VIT Bhopal University",
        "region": "Central",
        "state": "Madhya Pradesh",
        "city": "Sehore",
        "address": "Bhopal-Indore Highway, Kothrikalan, Sehore, Madhya Pradesh 466114",
        "inst_type": "Private State University",
        "approval_status": "Approved (EOA 2026-27)",
        "principal_name": "Dr. P. Gunasekaran",
        "contact_email": "info@vitbhopal.ac.in",
        "contact_phone": "+91 75 6025 4500",
        "website": "https://vitbhopal.ac.in",
        "established_year": 2017,
        "total_faculty": 340,
        "total_students": 8200,
        "images": [
            "https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?auto=format&fit=crop&w=1000&q=80",
        ],
    },
    {
        "aicte_pid": "1-923456789",
        "institution_name": "Chandigarh University",
        "region": "Northern",
        "state": "Punjab",
        "city": "Mohali",
        "address": "NH-95, Chandigarh-Ludhiana Highway, Gharuan, Mohali, Punjab 140413",
        "inst_type": "Private University",
        "approval_status": "Inspection Scheduled (Cadre Ratio)",
        "principal_name": "Prof. R.S. Bawa",
        "contact_email": "vc@cumail.in",
        "contact_phone": "+91 160 3051003",
        "website": "https://www.cuchd.in",
        "established_year": 2012,
        "total_faculty": 1400,
        "total_students": 32000,
        "images": [
            "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1000&q=80",
        ],
    },
    {
        "aicte_pid": "1-101234567",
        "institution_name": "Dr. A.P.J. Abdul Kalam Technical University",
        "region": "Northern",
        "state": "Uttar Pradesh",
        "city": "Lucknow",
        "address": "Sec-11, Jankipuram Vistar, Lucknow, Uttar Pradesh 226031",
        "inst_type": "State Government University",
        "approval_status": "Approved (EOA 2026-27)",
        "principal_name": "Prof. J.P. Pandey",
        "contact_email": "registrar@aktu.ac.in",
        "contact_phone": "+91 522 2336305",
        "website": "https://aktu.ac.in",
        "established_year": 2000,
        "total_faculty": 250,
        "total_students": 150000,
        "images": [
            "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=1000&q=80",
        ],
    },
    {
        "aicte_pid": "1-112345678",
        "institution_name": "Vellore Institute of Technology",
        "region": "Southern",
        "state": "Tamil Nadu",
        "city": "Vellore",
        "address": "Katpadi, Vellore, Tamil Nadu 632014",
        "inst_type": "Deemed to be University",
        "approval_status": "Approved (EOA 2026-27)",
        "principal_name": "Dr. Rambabu Kodali",
        "contact_email": "registrar@vit.ac.in",
        "contact_phone": "+91 416 2202020",
        "website": "https://vit.ac.in",
        "established_year": 1984,
        "total_faculty": 1900,
        "total_students": 45000,
        "images": [
            "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1000&q=80",
        ],
    },
    {
        "aicte_pid": "1-123456789",
        "institution_name": "College of Engineering Pune (COEP)",
        "region": "Western",
        "state": "Maharashtra",
        "city": "Pune",
        "address": "Wellesley Road, Shivajinagar, Pune, Maharashtra 411005",
        "inst_type": "State Autonomous Institute",
        "approval_status": "Approved (EOA 2026-27)",
        "principal_name": "Dr. D.N. Malkhede",
        "contact_email": "director@coep.ac.in",
        "contact_phone": "+91 20 25507000",
        "website": "https://www.coep.org.in",
        "established_year": 1854,
        "total_faculty": 280,
        "total_students": 4200,
        "images": [
            "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1000&q=80",
        ],
    },
    {
        "aicte_pid": "1-134567890",
        "institution_name": "PSG College of Technology",
        "region": "Southern",
        "state": "Tamil Nadu",
        "city": "Coimbatore",
        "address": "Avinashi Road, Peelamedu, Coimbatore, Tamil Nadu 641004",
        "inst_type": "Government-Aided Autonomous",
        "approval_status": "Approved (EOA 2026-27)",
        "principal_name": "Dr. K. Prakasan",
        "contact_email": "principal@psgtech.edu",
        "contact_phone": "+91 422 2572177",
        "website": "https://www.psgtech.edu",
        "established_year": 1951,
        "total_faculty": 410,
        "total_students": 7800,
        "images": [
            "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80",
        ],
    },
    {
        "aicte_pid": "1-145678901",
        "institution_name": "RV College of Engineering",
        "region": "Southern",
        "state": "Karnataka",
        "city": "Bengaluru",
        "address": "Mysore Road, RV Vidyaniketan Post, Bengaluru, Karnataka 560059",
        "inst_type": "Private Autonomous Institute",
        "approval_status": "Approved (EOA 2026-27)",
        "principal_name": "Dr. K.N. Subramanya",
        "contact_email": "principal@rvce.edu.in",
        "contact_phone": "+91 80 67178000",
        "website": "https://www.rvce.edu.in",
        "established_year": 1963,
        "total_faculty": 360,
        "total_students": 5600,
        "images": [
            "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80",
        ],
    },
    {
        "aicte_pid": "1-156789012",
        "institution_name": "Delhi Technological University (DTU)",
        "region": "Northern",
        "state": "Delhi",
        "city": "Delhi",
        "address": "Shahbad Daulatpur, Main Bawana Road, Delhi 110042",
        "inst_type": "State University",
        "approval_status": "Approved (EOA 2026-27)",
        "principal_name": "Prof. Prateek Sharma",
        "contact_email": "vc@dtu.ac.in",
        "contact_phone": "+91 11 27871018",
        "website": "https://www.dtu.ac.in",
        "established_year": 1941,
        "total_faculty": 520,
        "total_students": 14000,
        "images": [
            "https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=1000&q=80",
        ],
    },
]

# Canonical complainant seed data for existing 10 cases
CASE_METADATA_UPDATES = {
    "AICTE-2026-PGRC-0112": {
        "institution_code": "1-376234110",
        "institution_name": "Thakur College of Engineering & Technology",
        "complainant_user_id": "usr_amit_deshmukh",
        "complainant_name": "Amit Deshmukh",
        "complainant_email": "amit.deshmukh24@gmail.com",
        "complainant_type": "Student",
        "status": "received",
        "bureau": "PGRC",
        "category": "Capitation Fee",
        "days_ago": 8,  # Exactly 8d ageing as shown in prompt specification!
    },
    "AICTE-2026-RB-0042": {
        "institution_code": "1-109723481",
        "institution_name": "Shri Ram Institute of Technology",
        "complainant_user_id": "usr_ramanathan_kv",
        "complainant_name": "Dr. K.V. Ramanathan",
        "complainant_email": "kv.ramanathan@academic-council.org",
        "complainant_type": "Stakeholder",
        "status": "under_process",
        "bureau": "RB",
        "category": "Faculty Deficiency",
        "days_ago": 12,
    },
    "AICTE-2026-PGRC-0089": {
        "institution_code": "1-109723481",
        "institution_name": "Shri Ram Institute of Technology",
        "complainant_user_id": "usr_sunita_sharma",
        "complainant_name": "Prof. Sunita Sharma",
        "complainant_email": "sunita.sharma.faculty@gmail.com",
        "complainant_type": "Faculty",
        "status": "escalated",
        "bureau": "PGRC",
        "category": "Non-payment of Salary",
        "days_ago": 8,
    },
    "AICTE-2026-RB-0055": {
        "institution_code": "1-376234110",
        "institution_name": "Thakur College of Engineering & Technology",
        "complainant_user_id": "usr_rajesh_patil",
        "complainant_name": "Rajesh V. Patil",
        "complainant_email": "rajesh.patil.pta@gmail.com",
        "complainant_type": "Stakeholder",
        "status": "under_process",
        "bureau": "RB",
        "category": "Fee Regulation Violation",
        "days_ago": 5,
    },
    "AICTE-2026-PGRC-0034": {
        "institution_code": "1-204561892",
        "institution_name": "KL University (Koneru Lakshmaiah)",
        "complainant_user_id": "usr_sai_praneeth",
        "complainant_name": "K. Sai Praneeth",
        "complainant_email": "sai.praneeth.k@gmail.com",
        "complainant_type": "Student",
        "status": "escalated",
        "bureau": "PGRC",
        "category": "Ragging",
        "days_ago": 31,
    },
    "AICTE-2026-RB-0021": {
        "institution_code": "1-445871203",
        "institution_name": "Kalinga Institute of Industrial Technology",
        "complainant_user_id": "usr_subhash_mohanty",
        "complainant_name": "Subhash Chandra Mohanty",
        "complainant_email": "sc.mohanty@odisha-edu-vigil.in",
        "complainant_type": "Public",
        "status": "disposed",
        "bureau": "RB",
        "category": "Infrastructure Deficiency",
        "days_ago": 75,
        "resolved_days_ago": 15,
    },
    "AICTE-2026-PGRC-0078": {
        "institution_code": "1-512398067",
        "institution_name": "SRM Institute of Science and Technology",
        "complainant_user_id": "usr_senthil_kumar",
        "complainant_name": "Dr. M. Senthil Kumar",
        "complainant_email": "m.senthil.chem@gmail.com",
        "complainant_type": "Faculty",
        "status": "under_process",
        "bureau": "PGRC",
        "category": "Service Matters",
        "days_ago": 18,
    },
    "AICTE-2026-RO-0016": {
        "institution_code": "1-631047285",
        "institution_name": "GLA University",
        "complainant_user_id": "usr_virendra_rawat",
        "complainant_name": "Virendra Singh Rawat",
        "complainant_email": "virendra.rawat.up@gmail.com",
        "complainant_type": "Stakeholder",
        "status": "transferred",
        "bureau": "RO",
        "category": "Admissions Irregularity",
        "days_ago": 22,
    },
    "AICTE-2026-PGRC-0145": {
        "institution_code": "1-788234501",
        "institution_name": "Amity University Rajasthan",
        "complainant_user_id": "usr_harsh_rathore",
        "complainant_name": "Harshwardhan Rathore",
        "complainant_email": "h.rathore2026@gmail.com",
        "complainant_type": "Student",
        "status": "received",
        "bureau": "PGRC",
        "category": "Academic Issues",
        "days_ago": 3,
    },
    "AICTE-2026-RB-0071": {
        "institution_code": "1-923456789",
        "institution_name": "Chandigarh University",
        "complainant_user_id": "usr_gurpreet_gill",
        "complainant_name": "Gurpreet Singh Gill",
        "complainant_email": "gurpreet.gill.punjab@gmail.com",
        "complainant_type": "Stakeholder",
        "status": "under_process",
        "bureau": "RB",
        "category": "Faculty Deficiency",
        "days_ago": 14,
    },
}

def run_migration():
    """Run idempotent migration for institutional portfolios and complaint management."""
    conn = get_conn()
    now_dt = datetime.datetime.now()
    now = now_dt.isoformat()

    try:
        cur = conn.cursor()

        # 1. Track migration version
        cur.execute('''
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL,
                details TEXT
            )
        ''')
        cur.execute("SELECT version FROM schema_migrations WHERE version = ?", (MIGRATION_VERSION,))
        if cur.fetchone():
            conn.close()
            return {"status": "skipped", "message": f"Migration {MIGRATION_VERSION} already applied."}

        print(f"[*] Applying migration: {MIGRATION_VERSION}...")

        # 2. Add columns to aicte_institutions
        institution_cols = [
            ("city", "TEXT DEFAULT ''"),
            ("approval_status", "TEXT DEFAULT 'AICTE Approved (EOA 2026-27)'"),
            ("principal_name", "TEXT DEFAULT ''"),
            ("contact_email", "TEXT DEFAULT ''"),
            ("contact_phone", "TEXT DEFAULT ''"),
            ("website", "TEXT DEFAULT ''"),
            ("established_year", "INTEGER DEFAULT 2000"),
            ("total_faculty", "INTEGER DEFAULT 50"),
            ("total_students", "INTEGER DEFAULT 1000"),
            ("images_json", "TEXT DEFAULT '[]'"),
            ("updated_at", "TEXT DEFAULT ''"),
        ]
        for col_name, col_def in institution_cols:
            try:
                cur.execute(f"ALTER TABLE aicte_institutions ADD COLUMN {col_name} {col_def}")
            except Exception:
                pass  # column already exists

        # 3. Add columns to aicte_cases
        case_cols = [
            ("institution_code", "TEXT DEFAULT ''"),
            ("complainant_user_id", "TEXT DEFAULT ''"),
            ("complainant_name", "TEXT DEFAULT ''"),
            ("complainant_email", "TEXT DEFAULT ''"),
            ("received_at", "TEXT DEFAULT ''"),
            ("resolved_at", "TEXT DEFAULT ''"),
        ]
        for col_name, col_def in case_cols:
            try:
                cur.execute(f"ALTER TABLE aicte_cases ADD COLUMN {col_name} {col_def}")
            except Exception:
                pass  # column already exists

        # 4. Create Sequence Table for safe concurrent Case ID generation
        cur.execute('''
            CREATE TABLE IF NOT EXISTS aicte_case_sequences (
                bureau TEXT NOT NULL,
                year INTEGER NOT NULL,
                last_seq INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (bureau, year)
            )
        ''')

        # 5. Populate/update authoritative Institutional Portfolios
        for inst in DEFAULT_PORTFOLIOS:
            pid = inst["aicte_pid"]
            images_json = json.dumps(inst.get("images", []))
            
            # Check if exists
            cur.execute("SELECT aicte_pid FROM aicte_institutions WHERE aicte_pid = ?", (pid,))
            if cur.fetchone():
                cur.execute('''
                    UPDATE aicte_institutions SET
                        institution_name = ?,
                        region = ?,
                        state = ?,
                        city = ?,
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
                ''', (
                    inst["institution_name"],
                    inst["region"],
                    inst["state"],
                    inst.get("city", ""),
                    inst.get("address", ""),
                    inst.get("inst_type", "Engineering College"),
                    inst.get("approval_status", "AICTE Approved (EOA 2026-27)"),
                    inst.get("principal_name", ""),
                    inst.get("contact_email", ""),
                    inst.get("contact_phone", ""),
                    inst.get("website", ""),
                    inst.get("established_year", 2000),
                    inst.get("total_faculty", 50),
                    inst.get("total_students", 1000),
                    images_json,
                    now,
                    pid
                ))
            else:
                cur.execute('''
                    INSERT INTO aicte_institutions (
                        aicte_pid, institution_name, region, state, city, address,
                        inst_type, approval_status, principal_name, contact_email,
                        contact_phone, website, established_year, total_faculty,
                        total_students, images_json, created_at, updated_at
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ''', (
                    pid,
                    inst["institution_name"],
                    inst["region"],
                    inst["state"],
                    inst.get("city", ""),
                    inst.get("address", ""),
                    inst.get("inst_type", "Engineering College"),
                    inst.get("approval_status", "AICTE Approved (EOA 2026-27)"),
                    inst.get("principal_name", ""),
                    inst.get("contact_email", ""),
                    inst.get("contact_phone", ""),
                    inst.get("website", ""),
                    inst.get("established_year", 2000),
                    inst.get("total_faculty", 50),
                    inst.get("total_students", 1000),
                    images_json,
                    now,
                    now
                ))

        # 6. Populate/update authoritative Cases data
        for case_id, meta in CASE_METADATA_UPDATES.items():
            days_ago = meta.get("days_ago", 5)
            recv_time = (now_dt - datetime.timedelta(days=days_ago)).isoformat()
            resolved_time = ""
            if meta.get("status") == "disposed" and "resolved_days_ago" in meta:
                resolved_time = (now_dt - datetime.timedelta(days=meta["resolved_days_ago"])).isoformat()

            cur.execute('''
                UPDATE aicte_cases SET
                    institution_code = ?,
                    institution_name = ?,
                    complainant_user_id = ?,
                    complainant_name = ?,
                    complainant_email = ?,
                    complainant_type = ?,
                    status = ?,
                    bureau = ?,
                    category = ?,
                    received_at = ?,
                    created_at = ?,
                    resolved_at = CASE WHEN ? != '' THEN ? ELSE resolved_at END,
                    disposed_at = CASE WHEN ? != '' THEN ? ELSE disposed_at END,
                    updated_at = ?
                WHERE case_id = ?
            ''', (
                meta["institution_code"],
                meta["institution_name"],
                meta["complainant_user_id"],
                meta["complainant_name"],
                meta["complainant_email"],
                meta["complainant_type"],
                meta["status"],
                meta["bureau"],
                meta["category"],
                recv_time,
                recv_time,
                resolved_time,
                resolved_time,
                resolved_time,
                resolved_time,
                now,
                case_id
            ))

        # 7. Ensure any other existing cases have default metadata
        cur.execute('''
            UPDATE aicte_cases
            SET institution_code = aicte_pid
            WHERE institution_code IS NULL OR institution_code = ''
        ''')
        cur.execute('''
            UPDATE aicte_cases
            SET received_at = created_at
            WHERE received_at IS NULL OR received_at = ''
        ''')
        cur.execute('''
            UPDATE aicte_cases
            SET complainant_name = complainant_type
            WHERE complainant_name IS NULL OR complainant_name = ''
        ''')

        # 8. Initialize sequences from existing cases
        cur.execute("SELECT case_id, bureau FROM aicte_cases")
        rows = cur.fetchall()
        seq_map = {}
        curr_year = now_dt.year
        for r in rows:
            cid = r["case_id"] if hasattr(r, "__getitem__") else r[0]
            bur = r["bureau"] if hasattr(r, "__getitem__") else r[1]
            bur = (bur or "").upper()
            try:
                # Format: AICTE-{year}-{bureau}-{seq}
                parts = cid.split("-")
                if len(parts) >= 4:
                    yr = int(parts[1])
                    seq = int(parts[3])
                    key = (bur, yr)
                    if key not in seq_map or seq > seq_map[key]:
                        seq_map[key] = seq
            except Exception:
                pass

        for (bur, yr), max_seq in seq_map.items():
            cur.execute('''
                INSERT INTO aicte_case_sequences (bureau, year, last_seq)
                VALUES (?, ?, ?)
                ON CONFLICT(bureau, year) DO UPDATE SET last_seq = MAX(last_seq, excluded.last_seq)
            ''', (bur, yr, max_seq))

        # Default fallbacks if none existed
        for bur in ("PGRC", "RB", "RO"):
            cur.execute('''
                INSERT OR IGNORE INTO aicte_case_sequences (bureau, year, last_seq)
                VALUES (?, ?, 100)
            ''', (bur, curr_year))

        # 9. Record migration completion
        cur.execute('''
            INSERT INTO schema_migrations (version, applied_at, details)
            VALUES (?, ?, ?)
        ''', (
            MIGRATION_VERSION,
            now,
            json.dumps({
                "institutions_updated": len(DEFAULT_PORTFOLIOS),
                "cases_annotated": len(CASE_METADATA_UPDATES),
                "sequences_initialized": len(seq_map),
            })
        ))

        conn.commit()
        print(f"[OK] Migration {MIGRATION_VERSION} successfully applied.")
        return {"status": "success", "version": MIGRATION_VERSION}

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Error applying migration {MIGRATION_VERSION}: {e}")
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
