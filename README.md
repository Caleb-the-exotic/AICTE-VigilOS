# 🎓 VigilOS — AICTE Complaint & Cross-Bureau Intelligence Platform

> AICTE-aligned platform for institutional complaint monitoring, cross-bureau overlap detection, and campus automation — powered by an autonomous agent loop.

---

## 🧠 What Is This?

**VigilOS** is an integrated institutional monitoring and workflow platform with an autonomous AI backend. It is **not a chatbot** — it uses a self-correcting **THINK → PLAN → EXECUTE → REVIEW → UPDATE** loop to eliminate silos between the Regulation Bureau (RB) and Public Grievance Redressal Cell (PGRC), detect duplicate/overlapping actions, and manage campus requests.

```
User Query
    │
    ▼
 THINK  ──── Parse goal + incorporate previous feedback
    │
 PLAN   ──── LLM creates a JSON action plan
    │
 EXECUTE──── Run tools in sequence (classify → policy → notify)
    │
 REVIEW ──── Score output quality (1–10)
    │
 UPDATE ──── If score < 7: inject feedback and retry
    │         If score ≥ 7: deliver result
    ▼
  Reply
```

**The loop never changes. The tools do.**

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TanStack Router, TanStack Query, Tailwind CSS v4, shadcn/ui |
| **Backend** | FastAPI, Python 3.11+, SQLite (WAL mode) |
| **AI / LLM** | Groq (llama-3.3-70b-versatile) |
| **Agent Loop** | Custom THINK→PLAN→EXECUTE→REVIEW→UPDATE (campus/executor.py) |
| **Scheduler** | APScheduler (background jobs) |
| **Web Search** | Tavily API |
| **PDF Export** | ReportLab |
| **Build Tool** | Vite 7 |

---

## 📁 Project Structure

```
AICTEProFlow-main/
│
├── src/                        # React frontend
│   ├── routes/                 # TanStack Router pages
│   │   ├── index.tsx           # Dashboard (home)
│   │   ├── chat.tsx            # AI Chat (autonomous loop)
│   │   ├── requests.new.tsx    # New OD request form
│   │   ├── requests.index.tsx  # My requests list
│   │   ├── requests.$id.tsx    # Request detail
│   │   ├── admin.tsx           # Admin panel
│   │   └── ...                 # Other pages
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx   # Main shell
│   │   │   ├── AppSidebar.tsx  # Navigation sidebar
│   │   │   └── TopNavbar.tsx   # Top header bar
│   │   └── ui/                 # shadcn/ui components
│   └── lib/
│       ├── api.ts              # Backend API client
│       ├── auth.tsx            # Auth context
│       └── ...                 # Stores, utilities
│
├── campus/                     # Core autonomous backend
│   ├── executor.py             # ⭐ Main autonomous loop entry point
│   ├── db.py                   # SQLite persistence layer
│   ├── classifier.py           # Intent classifier (LLM)
│   ├── policy_engine.py        # Rules engine (approve/reject/escalate)
│   ├── notifier.py             # Notification router
│   ├── web_researcher.py       # Tavily web search tool
│   ├── role_system.py          # Role-based access control
│   ├── auth.py                 # User authentication (SQLite)
│   ├── pdf_exporter.py         # Chat PDF export
│   └── ...
│
├── agent/                      # General-purpose agent loop
│   ├── loop.py                 # ⭐ THE CORE: 5-step loop (NEVER change this)
│   ├── planner.py              # LLM → JSON plan
│   ├── executor.py             # Plan → tool execution
│   ├── reviewer.py             # Quality scorer
│   └── tools/                  # Domain-specific tools
│
├── mcp_server/                 # MCP (Model Context Protocol) server
│   └── server.py               # Tool routing via MCP
│
├── scheduler/                  # Background job scheduler
│   └── jobs.py                 # APScheduler cron jobs
│
├── api_server.py               # ⭐ FastAPI bridge (run this!)
├── requirements.txt            # Python dependencies
├── .env.example                # Environment variables template
├── package.json                # Node.js dependencies
└── vite.config.ts              # Vite build config
```

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** (or Bun)
- A **Groq API key** (free at [console.groq.com](https://console.groq.com))

---

### 1. Clone & Set Up Environment

```bash
# Copy the env template
cp .env.example .env

# Edit .env and fill in your Groq API key:
# GROQ_API_KEY=gsk_...
# VITE_API_BASE_URL=http://localhost:8000
```

---

### 2. Start the Python Backend

```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn api_server:app --reload --port 8000
```

The backend will be running at **http://localhost:8000**

API docs available at **http://localhost:8000/docs**

---

### 3. Start the React Frontend

```bash
# Install Node dependencies
npm install --legacy-peer-deps

# Start Vite dev server
npm run dev
```

The frontend will be running at **http://localhost:8080**

---

## 🔑 Default Login

| Username | Password | Role |
|----------|----------|------|
| `admin` | `12345678` | Admin |

Register new users via the UI (student or teacher role).

---

## 🌍 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ Yes | Groq LLM API key |
| `GROQ_MODEL` | No | Model name (default: `llama-3.3-70b-versatile`) |
| `TAVILY_API_KEY` | No | Web search API key |
| `VITE_API_BASE_URL` | ✅ Yes | Backend URL for frontend (e.g. `http://localhost:8000`) |

---

## 🤖 The Autonomous Agent Loop

The heart of AICTEProFlow is `campus/executor.py`, which runs the full autonomous loop:

| Step | What Happens |
|------|-------------|
| **THINK** | Classify the student's request (lab/leave/room/complaint/web) |
| **PLAN** | Extract a structured schema (dates, resources, role) |
| **EXECUTE** | Run the policy engine (APPROVED / REJECTED / ESCALATED) |
| **REVIEW** | Score the quality of classification + policy on 6 metrics (1–10) |
| **UPDATE** | If score < 7: inject feedback and retry (up to 3 attempts) |

This is **different from a chatbot** — the agent self-evaluates and self-corrects without human input.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/register` | Register |
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/sessions` | List chat sessions |
| `POST` | `/api/sessions` | Create session |
| `DELETE` | `/api/sessions/{id}` | Delete session |
| `GET` | `/api/chat/messages/{id}` | Get messages |
| `POST` | `/api/chat/query` | **Send query → runs autonomous loop** |
| `GET` | `/api/workflow/{id}` | Get workflow data |
| `GET` | `/api/workflow/logs/{id}` | Get execution logs |
| `GET` | `/api/kpi/dashboard` | KPI summary |
| `GET` | `/api/export/pdf/{id}` | Export chat as PDF |

---

## 🛠️ Supported Request Types

| Type | Examples |
|------|---------|
| **OD / Hackathon** | "I need OD for Smart India Hackathon this weekend" |
| **Lab Booking** | "Book Lab 204 on Friday 3-5 PM for my team" |
| **Leave Request** | "Apply for 2-day medical leave from March 22-24" |
| **Room Booking** | "Reserve Seminar Hall A on April 10 for 60 students" |
| **Complaint** | "AC in Lab 204 is broken, needs urgent fix" |
| **Web Research** | "What are the latest AI trends in autonomous agents?" |

---

## 🏛️ Roles & Access

| Role | Access |
|------|--------|
| **student** | Submit requests, view own history, AI chat |
| **faculty** | Review student requests, class roster, tracking |
| **hod** | All faculty access + reports + SLA dashboard |
| **admin** | Full access: all requests, users, KPIs, AI command center |

---

## 📦 Building for Production

```bash
# Build frontend
npm run build

# Run backend in production mode
uvicorn api_server:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 📄 License

MIT — Built for AICTE Smart India Hackathon 2025.
