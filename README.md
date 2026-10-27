# VigilOS — AICTE Complaint & Cross-Bureau Intelligence Platform

> AICTE-aligned platform for institutional complaint monitoring, cross-bureau overlap detection, decentralized regional governance, and database-driven RBAC — powered by SQLite and an autonomous agent loop.

---

## Database-Driven Role Management & SQLite RBAC Architecture

VigilOS enforces enterprise-grade, authoritative **Role-Based Access Control (RBAC)** completely driven by **SQLite** (`campusflow.db`) with `PRAGMA foreign_keys = ON` enforced on every database connection. Hardcoded user arrays and mock role mappings have been completely replaced with a normalized, transactional schema and centralized backend authorization.

### Database Schema (Version: `20261025_02_rbac_schema`)

The database architecture is implemented via transactional migrations in [`campus/rbac_migration.py`](campus/rbac_migration.py):

| Entity | Schema Fields | Constraints & Relationships |
|--------|---------------|-----------------------------|
| **`users`** | `id`, `name`, `normalized_email`, `password_hash`, `status`, `created_at`, `updated_at` | Unique on `normalized_email`. Stores canonical user identities and PBKDF2-SHA256 password hashes. |
| **`auth_accounts`** | `id`, `user_id`, `provider`, `provider_subject`, `created_at` | Unique composite `(provider, provider_subject)`. Foreign key to `users(id)` `ON DELETE CASCADE`. Supports linking multiple authentication providers (e.g. Google OAuth, email/password, NIC SSO) to one canonical user. |
| **`roles`** | `id`, `key`, `display_name`, `description` | Unique on `key`. Canonical roles: `super_admin`, `bureau_head`, `approval_officer`, `nodal_officer`, `citizen`. |
| **`permissions`** | `id`, `key`, `description` | Unique on `key`. Granular workflow privileges: `users:manage`, `cases:view`, `cases:assign`, `cases:process`, `cases:approve`, `reports:view`, `org:manage`, `audit:view`, `chat:use`. |
| **`role_permissions`** | `role_id`, `permission_id` | Composite primary key `(role_id, permission_id)`. Foreign keys to `roles(id)` and `permissions(id)` `ON DELETE CASCADE`. |
| **`bureaus`** | `id`, `code`, `name`, `description`, `created_at` | Unique on `code`. Canonical units: `HQ`, `RB` (Regulation Bureau), `PGRC` (Public Grievance Redressal Cell), `RO` (Regional Office Cell), `LIAISON` (State Liaison). |
| **`regions`** | `id`, `code`, `name`, `created_at` | Unique on `code`. Canonical jurisdictions: `HQ`, `NORTHERN`, `SOUTHERN`, `WESTERN`, `EASTERN`, `CENTRAL`. |
| **`user_assignments`** | `id`, `user_id`, `role_id`, `bureau_id`, `region_id`, `status`, `created_at`, `updated_at` | Foreign keys to `users`, `roles`, `bureaus`, `regions`. Exactly one active role assignment per user enforced by transactional constraints. |
| **`assignment_audit`** | `id`, `user_id`, `changed_by`, `new_role_key`, `new_bureau_code`, `new_region_code`, `action`, `created_at` | Immutable log of all administrative actions, role reassignments, account creations, and status toggles. |

---

## Canonical Roles & Permission Matrix

Backend authorization is authoritative and centralized in [`campus/role_service.py`](campus/role_service.py). Frontend conditions serve strictly for UI usability; backend access paths enforce privileges and bureau/region scopes.

| Canonical Role | Display Label | Assigned Permissions | Jurisdiction Scope |
|----------------|---------------|----------------------|--------------------|
| **`super_admin`** | Super Admin | `users:manage`, `cases:view`, `cases:assign`, `cases:process`, `cases:approve`, `reports:view`, `org:manage`, `audit:view`, `chat:use` | **Unrestricted National Scope** (all bureaus and regions) |
| **`bureau_head`** | Bureau Head | `cases:view`, `cases:assign`, `cases:process`, `cases:approve`, `reports:view`, `audit:view`, `chat:use` | **Bureau-Scoped** (restricted to assigned bureau: `RB`, `PGRC`, or `RO`) |
| **`approval_officer`**| Approval Officer | `cases:view`, `cases:process`, `reports:view`, `chat:use` | **Bureau-Scoped** (processes complaints within assigned department) |
| **`nodal_officer`** | Regional Nodal Officer | `cases:view`, `cases:process`, `reports:view`, `chat:use` | **Region-Scoped** (restricted to assigned region: Southern, Northern, etc.) |
| **`citizen`** | Citizen / Complainant | `cases:view` (own grievances only), `chat:use` | **Complainant-Scoped** (self-service public grievances) |

---

## Canonical Personnel Seeded in SQLite

All canonical accounts are in normalized SQLite records:

1. **System Administrator** (`admin@aicte-india.org`) — Super Admin (Vigilance Operations, HQ)
2. **Bureau Head (Demo)** (`admin@aicte.gov.in`) — Bureau Head (Regulation Bureau, RB)
3. **Approval Officer (Demo)** (`officer@aicte.gov.in`) — Approval Officer (Public Grievance Redressal Cell, PGRC)


## Unified Authentication & Identity Resolution

Both **Google OAuth** and **Email/Password** authentication resolve to single canonical SQLite user records:

```
[Google OAuth ID Token] ──► Backend Verification ──┐
                                                    ├──► auth_accounts ──► users ──► user_assignments ──► Session JWT
[Email & Password]       ──► PBKDF2 Verification ──┘
```

1. **Google Identity Tokens**: Verified on the backend against Google OAuth endpoints. The token subject (`sub`) is matched in `auth_accounts`. If not yet linked, identity matches the verified normalized email and registers the subject in `auth_accounts`.
2. **Password Verification**: Secure PBKDF2-SHA256 password hashing. Passwords are never stored in plaintext.
3. **Multi-Account Linking**: A user can link multiple login mechanisms (`credentials`, `google`, `nic_sso`) to their single canonical `user_id`.
4. **Session Hydration**: On every API request, `_get_current_user` in [`api_server.py`](api_server.py) verifies the JWT and loads fresh active assignment and permission data directly from SQLite. Deactivated accounts immediately receive a `403 Forbidden`.

---

## Administrative Governance UI (`/admin`)

Authorized Super Administrators have direct administrative controls over the SQLite RBAC system:
- **Personnel Directory**: Live table showing Officer Name, Official Email, Assigned Role, Bureau, Region, and Status.
- **Dynamic Role Reassignment**: Clickable role selector executing `PATCH /api/admin/users/{user_id}/assignment`.
- **Bureau & Region Reassignment**: Interactive select menus tied to SQLite `bureaus` and `regions` tables.
- **Status Toggle**: One-click Active/Inactive account toggle with instant database update.
- **Personnel Account Creation**: Modal for registering new officers directly into SQLite with designated bureau and region.
- **Safe Account Deletion**: Modal with confirmation protecting active session accounts and the master super admin.

---

## Database Migration & Backup Instructions

### Automated Migration
The migration runs automatically on application startup via `campus/db.py` `init_db()`. To run the migration standalone:

```bash
python -m campus.rbac_migration
```

### Database Backup
Before executing schema changes or production upgrades, back up the SQLite database:

```bash
# Windows PowerShell
Copy-Item campusflow.db campusflow.db.bak

# Linux / macOS
cp campusflow.db campusflow.db.bak
```

### Idempotency
`campus/rbac_migration.py` records migration versions in `schema_migrations`. Re-running the migration is completely safe and will not duplicate users or overwrite existing assignments.

---

## Automated RBAC Test Suite

The test suite in [`test_rbac_governance.py`](test_rbac_governance.py) validates all 12 core security requirements:

```bash
python test_rbac_governance.py
```

| Test # | Requirement Verified | Status |
|--------|----------------------|--------|
| **Test 01** | Google login resolves to correct SQLite user | [PASS] Passed |
| **Test 02** | Email/password login resolves to correct SQLite user | [PASS] Passed |
| **Test 03** | Multiple linked login methods resolve to the same user | [PASS] Passed |
| **Test 04** | Invalid credentials & unauthorized citizen access rejected (401/403) | [PASS] Passed |
| **Test 05** | Self-demotion / deletion of own admin account prevented | [PASS] Passed |
| **Test 06** | Bureau heads cannot access unauthorized bureaus (RB vs PGRC) | [PASS] Passed |
| **Test 07** | Regional officers cannot access unauthorized regions (Southern scope) | [PASS] Passed |
| **Test 08** | Case assignment and approval permissions enforced by backend | [PASS] Passed |
| **Test 09** | Deactivated users immediately lose API and login access | [PASS] Passed |
| **Test 10** | Existing complaints (`aicte_cases`) and audit history remain intact | [PASS] Passed |
| **Test 11** | SQLite foreign keys (`PRAGMA foreign_keys = ON`) and unique constraints work | [PASS] Passed |
| **Test 12** | Production startup is idempotent (no duplicate accounts or reset roles) | [PASS] Passed |

---

## Backend API Endpoints

### Authentication & Self
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Email/password authentication |
| `POST` | `/api/auth/google` | Google OAuth token verification |
| `POST` | `/api/auth/register` | Public citizen registration |
| `POST` | `/api/auth/logout` | Invalidate active session |
| `GET` | `/api/auth/me` | Fetch authenticated profile with active permissions |

### RBAC Governance (Super Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/metadata` | Reference list of all bureaus and regions |
| `GET` | `/api/admin/users` | List all users and active organizational assignments |
| `POST` | `/api/admin/users` | Create new personnel account with credentials and assignment |
| `PATCH` | `/api/admin/users/{id}/assignment` | Update user role, bureau, and region assignment |
| `PATCH` | `/api/admin/users/{id}/status` | Toggle account status (`active` / `inactive`) |
| `DELETE` | `/api/admin/users/{id}` | Permanently delete account and cascade assignments |

### Cases & Intelligence
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/aicte/cases` | Authoritative bureau & region scoped case list with calculated ageing and complainant identity |
| `POST` | `/api/aicte/cases` | Create new authenticated complaint with atomic case ID generation (`AICTE-YYYY-BUREAU-XXXX`) |
| `POST` | `/api/aicte/cases/submit` | Institution-facing portal submission endpoint with backend validation |
| `GET` | `/api/aicte/cases/{id}` | Case detail with jurisdiction check and institution metadata |
| `PATCH` | `/api/aicte/cases/{id}` | Update case status, assignment, and links |
| `GET` | `/api/aicte/cases/overlaps` | Cross-bureau duplicate & overlap alerts |
| `GET` | `/api/aicte/cases/sla-breached` | SLA escalation monitoring |

### Institutional Portfolios
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/aicte/institutions` | List all registered institutions from authoritative database |
| `GET` | `/api/aicte/institutions/{pid}` | Get detailed portfolio for an institution |
| `POST` | `/api/aicte/institutions` | Register new institutional portfolio (Super Admin) |
| `PUT` | `/api/aicte/institutions/{pid}` | Update institutional portfolio with authoritative cross-account persistence |
| `DELETE` | `/api/aicte/institutions/{pid}` | Delete institutional record (Super Admin) |

---

## Institutional Portfolio & Complaint Persistence Architecture

### Schema Migration (`campus/portfolio_and_cases_migration.py`)
Version: `20261026_02_portfolio_and_cases`
- **`aicte_institutions`**: Persistent storage for all 15 canonical AICTE institutions including approval status (`AICTE Approved (EOA 2026-27)`, `Not Approved`, or custom statement), principal name, contact email, contact phone, website, faculty and student counts, and campus images.
- **`aicte_cases`**: Persistent storage for complaints with full relational links:
  - `institution_code` (foreign link to AICTE PID e.g. `1-376234110`)
  - Authoritative Complainant Attribution: `complainant_user_id`, `complainant_name`, `complainant_email`
  - Lifecycle Timestamps: `received_at`, `resolved_at`, and dynamic server-calculated `ageing_days`
- **`aicte_case_sequences`**: Atomic, concurrency-safe sequential case counter table for transaction-safe unique ID generation (`AICTE-YYYY-BUREAU-XXXX`).

### Required 9-Column Complaint Dashboard Order
The VigilOS complaints view displays all cases in the strict required 9-column order:
`Case ID | Institution | Institution Code | Bureau | Category | Status | Ageing | Region | Submitted By`
*(e.g., `AICTE-2026-PGRC-0112 | Thakur College of Engineering & Technology | 1-376234110 | PGRC | Capitation Fee | Received | 8d | Western | Amit Deshmukh`)*

### Institution-Facing HTML Submission Portal
The standalone portal at [`public/institution-complaint-submission.html`](public/institution-complaint-submission.html) allows colleges and institutions to submit grievances directly to the authoritative VigilOS backend via `POST /api/aicte/cases/submit`.

---

## Production Deployment & Vercel Persistence

### The Ephemeral Filesystem Problem
Vercel and AWS Lambda serverless execution environments run on an **ephemeral filesystem**. Any changes written to local SQLite files (`campusflow.db`) inside a serverless container are lost when the container is recycled or redeployed.

### The Production Solution
For persistent, durable production deployments:
1. Provision a managed PostgreSQL instance (e.g. [Neon Serverless Postgres](https://neon.tech), [Supabase](https://supabase.com), or [Render PostgreSQL](https://render.com)).
2. Set environment variables in your Vercel / production settings:
   ```env
   USE_POSTGRES=true
   DATABASE_URL=postgresql://user:password@ep-host.neon.tech/dbname?sslmode=require
   ```
3. `campus/db.py` automatically detects `USE_POSTGRES` or `DATABASE_URL` and routes all transactions through PostgreSQL connection wrappers with transparent schema creation, atomic migrations, and WAL durability.
4. For local development, leaving `DATABASE_URL` empty automatically defaults to the durable local SQLite database (`campusflow.db`).

---

## Running Locally

```bash
# 1. Install frontend dependencies
npm install

# 2. Build frontend production bundle
npm run build

# 3. Run development server
npm run dev

# 4. Run FastAPI backend
python api_server.py
```

---

## License

MIT — AICTE VigilOS Complaint & Cross-Bureau Intelligence Platform.
