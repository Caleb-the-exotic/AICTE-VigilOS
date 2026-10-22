// API client for the VigilOS Python backend.
// Configure the base URL via VITE_API_BASE_URL (e.g. https://api.yourdomain.com).
// When unset, calls fall back to in-memory mock data so the UI still works.

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "";

export const HAS_BACKEND = Boolean(API_BASE_URL);

type Json = Record<string, unknown> | unknown[] | null;

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("aicte_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!HAS_BACKEND) throw new Error("NO_BACKEND");
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

// ===== Auth =====
export const api = {
  health: () => request<{ status: string }>("/api/health"),

  login: (email: string, password: string) =>
    request<{ token: string; user: ApiUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  loginWithGoogle: (credential: string) =>
    request<{ token: string; user: ApiUser }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),

  register: (data: { name: string; email: string; password: string; role?: string }) =>
    request<{ token: string; user: ApiUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  updateRole: (role: string) => request<{ status: string; role: string }>("/api/auth/role", { method: "POST", body: JSON.stringify({ role }) }),

  // ===== Chat sessions =====
  listSessions: () => request<ChatSession[]>("/api/sessions"),
  createSession: (title: string) =>
    request<ChatSession>("/api/sessions", { method: "POST", body: JSON.stringify({ title }) }),
  deleteSession: (id: string) => request<{ ok: true }>(`/api/sessions/${id}`, { method: "DELETE" }),
  getMessages: (sessionId: string) => request<ChatMessage[]>(`/api/chat/messages/${sessionId}`),
  sendChat: (sessionId: string, query: string) =>
    request<{ reply: string; workflow?: Json }>("/api/chat/query", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, query }),
    }),

  // ===== Workflow =====
  getWorkflow: (sessionId: string) => request<Json>(`/api/workflow/${sessionId}`),
  getWorkflowLogs: (sessionId: string) => request<WorkflowLog[]>(`/api/workflow/logs/${sessionId}`),

  // ===== KPI / Reports =====
  getKpiDashboard: () => request<KpiData>("/api/kpi/dashboard"),

  // ===== Export =====
  exportPdfUrl: (sessionId: string) => `${API_BASE_URL}/api/export/pdf/${sessionId}`,

  // ===== Multi-Agent Kernel (Phase 3/4) =====
  getAgentSteps: (sessionId: string, requestId?: string) =>
    request<AgentStep[]>(
      `/api/agent/steps/${sessionId}${requestId ? `?request_id=${requestId}` : ""}`
    ),

  getActivityFeed: (sessionId?: string, limit = 50) =>
    request<ActivityEvent[]>(
      `/api/activity/feed${sessionId ? `?session_id=${sessionId}&limit=${limit}` : `?limit=${limit}`}`
    ),

  getStudentProfile: (studentId: string) =>
    request<StudentProfile>(`/api/student/${studentId}/profile`),

  getRequestState: (requestId: string) =>
    request<RequestStateHistory>(`/api/requests/${requestId}/state`),

  pollJob: (jobId: string) =>
    request<BackgroundJobResult>(`/api/chat/job/${jobId}`),

  sendChatBackground: (sessionId: string, query: string) =>
    request<{ job_id: string; status: string; message: string }>("/api/chat/query", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, query, background: true }),
    }),

  getEventBusStats: () =>
    request<{ available: boolean; queue_size?: number; worker_alive?: boolean; total_events_logged?: number }>(
      "/api/admin/event-bus"
    ),
};

// ===== Types =====
export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: "student" | "ambassador" | "faculty" | "hod" | "admin";
}
export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}
export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}
export interface WorkflowLog {
  ts: string;
  level: string;
  step: string;
  message: string;
}
export interface KpiData {
  total_requests: number;
  approved: number;
  pending: number;
  rejected: number;
  avg_response_seconds: number;
  active_users: number;
}

// ===== Multi-Agent Kernel Types (Phase 3/4) =====
export interface AgentStep {
  id: string;
  request_id: string;
  session_id: string;
  step_type: "THINK" | "PLAN" | "EXECUTE" | "REVIEW" | "UPDATE";
  agent_name: string;
  input_payload: Record<string, unknown> | string;
  output_payload: Record<string, unknown> | string;
  score: number | null;
  status: "running" | "done" | "failed";
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  session_id: string;
  actor_role: string;
  action: string;
  target: string;
  result: string;
  created_at: string;
  icon: string;
  source?: "audit" | "event_bus";
}

export interface StudentProfile {
  student_id: string;
  attendance_pct: number | null;
  attendance_status: "sufficient" | "insufficient";
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  od_requests_last_10: number;
  recent_history: Array<{ workflow_type: string; status: string; created_at: string }>;
  alerts: string[];
}

export interface RequestStateHistory {
  request: Record<string, unknown>;
  current_state: string;
  state_history: Array<{
    id: string;
    action: string;
    result: string;
    created_at: string;
    actor_role: string;
  }>;
}

export interface BackgroundJobResult {
  status: "queued" | "running" | "done" | "error";
  result: { reply: string; workflow: Record<string, unknown> } | null;
  error: string | null;
  logs?: string[];
}

// Safe wrapper: returns null on backend errors so UI can show mock data.
export async function tryApi<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}
