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
  const url = `${API_BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
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
  } catch (err: any) {
    if (err.name === "TypeError" && (err.message === "Failed to fetch" || String(err).includes("Failed to fetch"))) {
      // Attempt fallback via relative proxy if direct URL failed
      if (API_BASE_URL) {
        try {
          const proxyRes = await fetch(path, {
            ...init,
            headers: {
              "Content-Type": "application/json",
              ...authHeaders(),
              ...(init.headers || {}),
            },
          });
          if (proxyRes.ok) {
            const ct = proxyRes.headers.get("content-type") || "";
            if (ct.includes("application/json")) return (await proxyRes.json()) as T;
            return (await proxyRes.text()) as unknown as T;
          }
        } catch {/**/}
      }
      throw new Error(
        "Backend server is offline or unreachable on http://localhost:8000. Please start the backend with 'python api_server.py' or '1run_all_local.bat'."
      );
    }
    throw err;
  }
}

// ===== Auth =====
export const api = {
  health: () => request<{ status: string }>("/api/health"),

  login: (email: string, password: string) =>
    request<{ token?: string; user?: ApiUser; requires_2fa?: boolean; email?: string; message?: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login2FA: (email: string, otp: string) =>
    request<{ token: string; user: ApiUser }>("/api/auth/login/2fa", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    }),

  resend2FA: (email: string) =>
    request<{ ok: boolean; message: string }>("/api/auth/login/2fa/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  toggle2FA: (enabled: boolean) =>
    request<{ ok: boolean; enabled: boolean; message: string }>("/api/auth/2fa/toggle", {
      method: "POST",
      body: JSON.stringify({ enabled }),
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

  // ===== OTP & Password Reset =====
  sendOtp: (email: string, purpose?: string) =>
    request<{ ok: boolean; message: string; email: string }>("/api/auth/otp/send", {
      method: "POST",
      body: JSON.stringify({ email, purpose }),
    }),

  verifyOtpAndResetPassword: (email: string, otp: string, new_password: string) =>
    request<{ ok: boolean; message: string }>("/api/auth/otp/verify-reset", {
      method: "POST",
      body: JSON.stringify({ email, otp, new_password }),
    }),

  settingsSendOtp: () =>
    request<{ ok: boolean; message: string }>("/api/auth/settings/send-otp", {
      method: "POST",
    }),

  settingsResetPassword: (otp: string, new_password: string) =>
    request<{ ok: boolean; message: string }>("/api/auth/settings/reset-password", {
      method: "POST",
      body: JSON.stringify({ otp, new_password }),
    }),

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

  // ===== Live Chat =====
  getLiveChatMessages: () => request<LiveChatMessage[]>("/api/live-chat/messages"),
  sendLiveChatMessage: (text: string, sender_name?: string, sender_role?: string) =>
    request<LiveChatMessage>("/api/live-chat/messages", {
      method: "POST",
      body: JSON.stringify({ text, sender_name, sender_role }),
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

  getMe: () => request<ApiUser>("/api/auth/me"),

  adminGetMetadata: () =>
    request<{
      bureaus: Array<{ id: string; code: string; name: string; description: string }>;
      regions: Array<{ id: string; code: string; name: string }>;
    }>("/api/admin/metadata"),

  adminGetUsers: () =>
    request<Array<ApiUser & { created_at?: string; updated_at?: string }>>(
      "/api/admin/users"
    ),

  adminCreateUser: (data: {
    name: string;
    email: string;
    role: string;
    bureau?: string;
    region?: string;
    password?: string;
  }) =>
    request<{ status: string; user: ApiUser }>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  adminUpdateAssignment: (
    userId: string,
    data: { role: string; bureau?: string; region?: string }
  ) =>
    request<{ status: string; user: ApiUser }>(`/api/admin/users/${userId}/assignment`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  adminToggleStatus: (userId: string, status: string) =>
    request<{ status: string; user: ApiUser }>(`/api/admin/users/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  adminDeleteUser: (userId: string) =>
    request<{ ok: true }>(`/api/admin/users/${userId}`, {
      method: "DELETE",
    }),

  adminUpdateUserRole: (email: string, role: string) =>
    request<{ status: string; email: string; role: string }>("/api/admin/users/role", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
};

// ===== Types =====
export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: "citizen" | "nodal_officer" | "approval_officer" | "bureau_head" | "super_admin";
  role_label?: string;
  bureau_code?: string;
  bureau?: string;
  region_code?: string;
  region?: string;
  status?: string;
  two_factor_enabled?: boolean;
  permissions?: string[];
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

export interface LiveChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role?: string;
  text: string;
  created_at: string;
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
