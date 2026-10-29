# VigilOS — AICTE Regulatory Complaint & Cross-Bureau Intelligence Platform

> Enterprise AICTE-aligned platform for institutional complaint monitoring, automated document verification, semantic cross-bureau overlap detection, decentralized regional governance, and comprehensive audit trail tracking.

---

## Key Features & Platform Architecture

### 1. Centralized Regulatory Dashboard (`/cases`)
- **9-Column Authoritative Docket Order**: `Case ID | Institution | Institution Code | Bureau | Category | Status | Ageing | Region | Submitted By`.
- **Dynamic Bureau Workload Analytics**: Live monitoring across Regulation Bureau (`RB`), Public Grievance Redressal Cell (`PGRC`), and Regional Offices (`RO`).
- **Interactive Relationship Graph**: Visualizes links between institutions, grievances, bureaus, and assigned officials.
- **SLA Breach & Escalation Alarms**: Real-time tracking of statutory deadlines with automated overdue alerts.

### 2. Regulatory Overlap & Similarity Intelligence
- **Strict Jurisdiction & Institution Matching**: Overlap alerts are scoped exclusively to the **exact same institution (`aicte_pid`) and regional jurisdiction**, preventing false cross-institution alerts.
- **Automated Evidence Document OCR**: Extracts text from scanned notices, inspection records, and affidavits for regulatory evaluation.
- **Root-Cause Synthesis**: Identifies shared operational deficiencies (e.g. faculty cadre shortfalls, fee anomalies) across parallel bureau proceedings.
- **Joint Proceeding Consolidation**: Allows reviewing officers to link and merge parallel complaints into synchronized hearings.

### 3. Comprehensive Administrative Audit Log (`/admin` Subpage 3)
A persistent, immutable audit repository split into two dedicated views:
- **Institution Filings**:
  - Full history of all grievances and complaints submitted by colleges.
  - Institutional self-registration applications and review status tracking.
  - Institution portfolio modifications and infrastructure profile updates.
- **Officer Operations & Invisible Audit Trail**:
  - Detailed audit records of actions **specifically excluded from notifications** (such as deleted accounts, forced password resets, account status deactivations, and database purges).
  - Clear attribution tracking: who performed the action, which account was affected, reason for action, and ISO timestamps.

### 4. Institution Self-Registration & Onboarding Workflow
- Standalone self-service portal at `public/complaint-portal.html` for colleges to register, upload affidavits, and submit grievances.
- Dedicated reviewing interface for approval officers to verify credentials, inspect attached documents, and approve or reject registrations with feedback notes.
- Private notification routing: Bureau Heads and Admins receive alerts for new registrations, while reviewing officials privately receive assigned case alerts.

### 5. Multi-Bureau Role-Based Access Control (RBAC)
Authoritative permissions enforced at the database level (`users`, `user_assignments`, `roles`, `permissions`):
- **Super Admin**: Unrestricted national vigilance authority, user provisioning, account deletion, and system-wide audit access.
- **Bureau Head**: Departmental authority across assigned bureau (`RB`, `PGRC`, `RO`).
- **Approval Officer**: Case investigation, document verification, and grievance resolution.
- **Regional Nodal Officer**: Regional field oversight and institutional liaison.
- **Complainant / Citizen**: Grievance submission and real-time status tracking.

---

## Canonical Database Schema & Persistence

VigilOS supports both high-performance **PostgreSQL** in production (e.g. Render, Supabase, Neon) and zero-config **SQLite** for local testing.

| Entity | Primary Fields | Description |
|---|---|---|
| **`aicte_cases`** | `case_id`, `aicte_pid`, `institution_name`, `region`, `bureau`, `category`, `title`, `description`, `assigned_officer`, `status`, `sla_days`, `sla_deadline`, `linked_case_ids`, `created_at` | Primary repository of all regulatory complaints and proceedings. |
| **`aicte_institutions`** | `aicte_pid`, `institution_name`, `region`, `state`, `district`, `inst_type`, `approval_status`, `principal_name`, `contact_email`, `total_faculty`, `total_students` | 360° institutional profiles and verified campus portfolios. |
| **`aicte_overlap_alerts`** | `id`, `aicte_pid`, `rb_case_id`, `pgrc_case_id`, `overlap_score`, `overlap_type`, `shared_root_cause`, `recommended_action`, `reason`, `resolved`, `created_at` | AI-evaluated cross-bureau overlap records. |
| **`institution_registrations`**| `id`, `institution_name`, `official_email`, `inst_type`, `city`, `state`, `region`, `status`, `reviewer_id`, `review_notes`, `submitted_at` | Queue of institutional onboarding applications. |
| **`assignment_audit`** | `id`, `user_id`, `changed_by`, `old_role_key`, `new_role_key`, `action`, `created_at` | Immutable log of administrative actions, role reassignments, and user deletions. |
| **`audit`** | `id`, `session_id`, `actor_role`, `action`, `target`, `result`, `created_at` | System-wide operations, complaint filings, linking, and purges. |
| **`deleted_accounts`** | `id`, `user_id`, `email`, `name`, `deleted_at`, `deleted_by`, `reason` | Authoritative tombstone registry of permanently removed personnel accounts. |
| **`officer_notifications`** | `id`, `recipient_user_id`, `type`, `title`, `body`, `action_url`, `reference_id`, `is_read`, `created_at` | Persistent notification dispatch system for officers and administrators. |

---

## API Endpoints Overview

### Authentication & Personnel Governance
- `POST /api/auth/login` — Account sign-in (returns JWT)
- `POST /api/auth/google` — Google OAuth authentication
- `POST /api/auth/logout` — Session termination
- `GET /api/admin/users` — List personnel accounts
- `POST /api/admin/users` — Create officer account
- `PATCH /api/admin/users/{id}/assignment` — Modify assigned role, bureau, or region
- `PATCH /api/admin/users/{id}/status` — Activate/deactivate account
- `DELETE /api/admin/users/{id}` — Permanently delete personnel account

### Cases, Overlaps & Registrations
- `GET /api/aicte/cases` — Retrieve all cases (bureau/region filtered)
- `POST /api/aicte/cases` — Submit new authenticated case
- `POST /api/aicte/cases/submit` — Submit grievance from public complaint portal
- `GET /api/aicte/overlap-alerts` — Get stored AI overlap alerts
- `POST /api/aicte/cases/link` — Link parallel proceedings into unified cluster
- `POST /api/aicte/cases/unlink` — Detach previously linked proceedings
- `GET /api/institution/registrations` — View institution application queue
- `POST /api/institution/registrations/{id}/approve` — Approve college onboarding
- `POST /api/institution/registrations/{id}/reject` — Reject college onboarding

### Comprehensive Audit Trail (Super Admin)
- `GET /api/admin/audit/institutions` — Feed of institutional complaints, applications, and portfolio syncs
- `GET /api/admin/audit/officers` — Feed of officer governance, deleted accounts, role updates, and system operations

---

## Local Development & Setup

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- PostgreSQL (or local SQLite fallback)

### Step 1: Install Dependencies
```bash
# Frontend dependencies
npm install

# Backend dependencies
pip install fastapi uvicorn psycopg2-binary groq pyjwt passlib requests
```

### Step 2: Configure Environment Variables
Create a `.env` file in the project root:
```env
VITE_API_BASE_URL=http://localhost:8000
USE_POSTGRES=true
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/campusflow
GROQ_API_KEY=your_groq_api_key
JWT_SECRET=your_jwt_secret_key_here
```

### Step 3: Run the Application
```bash
# Terminal 1: Run Backend API Server
python api_server.py

# Terminal 2: Run Frontend Development Server
npm run dev
```

### Step 4: Build for Production
```bash
npm run build
```

---

## License

MIT — AICTE VigilOS Regulatory Complaint & Cross-Bureau Intelligence Platform.
