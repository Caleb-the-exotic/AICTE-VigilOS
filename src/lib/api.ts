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
      let errorMessage = `${res.status} ${res.statusText}: ${text}`;
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.detail) {
          errorMessage = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
        }
      } catch {/**/}
      throw new Error(errorMessage);
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
          } else {
            const ptext = await proxyRes.text().catch(() => "");
            let pError = `${proxyRes.status} ${proxyRes.statusText}: ${ptext}`;
            try {
              const pjson = JSON.parse(ptext);
              if (pjson && pjson.detail) {
                pError = typeof pjson.detail === "string" ? pjson.detail : JSON.stringify(pjson.detail);
              }
            } catch {/**/}
            throw new Error(pError);
          }
        } catch (subErr) {
          if (subErr instanceof Error && !subErr.message.includes("Failed to fetch")) {
            throw subErr;
          }
        }
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
  deleteLiveChatMessage: (id: string) =>
    request<{ ok: true; id: string }>(`/api/live-chat/messages/${id}`, {
      method: "DELETE",
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

  adminUpdateUserProfile: (
    userId: string,
    data: { name?: string; email?: string; password?: string }
  ) =>
    request<{ status: string; user: ApiUser }>(`/api/admin/users/${userId}/profile`, {
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

  // ===== Internal Communications (Messages App) =====
  getCommsDirectory: (query?: string, category?: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category && category !== "all") params.set("category", category);
    const qs = params.toString();
    return request<DirectoryResponse>(`/api/comms/directory${qs ? `?${qs}` : ""}`);
  },

  getCommsMessages: (folder = "inbox", query?: string, label?: string) => {
    const params = new URLSearchParams({ folder });
    if (query) params.set("q", query);
    if (label) params.set("label", label);
    return request<CommsMessage[]>(`/api/comms/messages?${params.toString()}`);
  },

  getCommsMessageDetail: (messageId: string) =>
    request<CommsMessage>(`/api/comms/messages/${messageId}`),

  sendCommsMessage: (payload: SendCommsMessagePayload) =>
    request<{
      ok: boolean;
      message_id: string;
      message_ref: string;
      thread_id: string;
      sender: Record<string, unknown>;
      recipients: CommsMessageRecipient[];
      sent_at: string;
      dispatched_email_count: number;
    }>("/api/comms/messages/send", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateCommsMessageStatus: (messageId: string, status: { read?: boolean; starred?: boolean; folder?: string; labels?: string[] }) =>
    request<{ ok: boolean }>(`/api/comms/messages/${messageId}/status`, {
      method: "PATCH",
      body: JSON.stringify(status),
    }),

  deleteCommsMessage: (messageId: string, permanent: boolean = false) =>
    request<{ ok: boolean }>(`/api/comms/messages/${messageId}?permanent=${permanent}`, {
      method: "DELETE",
    }),

  restoreCommsMessage: (messageId: string) =>
    request<{ ok: boolean }>(`/api/comms/messages/${messageId}/restore`, {
      method: "POST",
    }),

  bulkCommsAction: (payload: { message_ids: string[]; action: string; label_name?: string }) =>
    request<{ ok: boolean; affected_count: number }>("/api/comms/messages/bulk-action", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getCommsDrafts: () =>
    request<CommsDraft[]>("/api/comms/drafts"),

  saveCommsDraft: (payload: { draft_id?: string; to?: string[]; subject?: string; body?: string; attachments?: any[] }) =>
    request<{ ok: boolean; draft_id: string; updated_at: string }>("/api/comms/drafts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteCommsDraft: (draftId: string) =>
    request<{ ok: boolean }>(`/api/comms/drafts/${draftId}`, {
      method: "DELETE",
    }),

  getCommsLabels: () =>
    request<CommsLabel[]>("/api/comms/labels"),

  createCommsLabel: (payload: { name: string; color?: string }) =>
    request<CommsLabel>("/api/comms/labels", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteCommsLabel: (labelName: string) =>
    request<{ ok: boolean }>(`/api/comms/labels/${encodeURIComponent(labelName)}`, {
      method: "DELETE",
    }),

  updateCommsLabels: (messageId: string, labels: string[]) =>
    request<{ ok: boolean }>(`/api/comms/messages/${messageId}/labels`, {
      method: "PATCH",
      body: JSON.stringify({ labels }),
    }),

  getCommsUnreadCount: () =>
    request<{ unread_count: number }>("/api/comms/unread-count"),

  // ===== AICTE Institutional Portfolio Database =====
  getInstitutions: () => request<InstitutionProfile[]>("/api/aicte/institutions"),
  getInstitutionByPid: (pid: string) => request<InstitutionProfile & { cases?: any }>(`/api/aicte/institutions/${pid}`),
  createInstitution: (inst: InstitutionProfile) =>
    request<{ ok: boolean; institution: InstitutionProfile }>("/api/aicte/institutions", {
      method: "POST",
      body: JSON.stringify(inst),
    }),
  updateInstitution: (pid: string, inst: Partial<InstitutionProfile>) =>
    request<{ ok: boolean; institution: InstitutionProfile }>(`/api/aicte/institutions/${pid}`, {
      method: "PUT",
      body: JSON.stringify(inst),
    }),
  deleteInstitution: (pid: string) =>
    request<{ ok: boolean }>(`/api/aicte/institutions/${pid}`, {
      method: "DELETE",
    }),

  // ===== AICTE Complaint Management Database =====
  getCases: (params?: { bureau?: string; status?: string; aicte_pid?: string; region?: string; category?: string }) => {
    const query = new URLSearchParams();
    if (params?.bureau && params.bureau !== "ALL") query.set("bureau", params.bureau);
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    if (params?.aicte_pid) query.set("aicte_pid", params.aicte_pid);
    if (params?.region && params.region !== "ALL") query.set("region", params.region);
    if (params?.category) query.set("category", params.category);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<AICTECase[]>(`/api/aicte/cases${qs}`);
  },
  getCaseByRef: (caseId: string) => request<AICTECase>(`/api/aicte/cases/${caseId}`),
  createCase: (payload: CreateCasePayload) =>
    request<{ ok: boolean; case_id: string; case: AICTECase }>("/api/aicte/cases", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  submitInstitutionComplaint: (payload: InstitutionComplaintPayload) =>
    request<{ ok: boolean; case_id: string; message: string; institution_name: string; status: string; received_at: string }>(
      "/api/aicte/cases/submit",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  updateCaseStatus: (caseId: string, status: string, assignedOfficer?: string, linkedCaseIds?: string[]) =>
    request<{ ok: boolean }>(`/api/aicte/cases/${caseId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, assigned_officer: assignedOfficer, linked_case_ids: linkedCaseIds }),
    }),
  updateCase: (caseId: string, data: any) =>
    request<{ ok: boolean; case?: any }>(`/api/aicte/cases/${caseId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCase: (caseId: string) =>
    request<{ ok: boolean; message?: string }>(`/api/aicte/cases/${caseId}`, {
      method: "DELETE",
    }),
};

// ===== Types =====
export interface InstitutionProfile {
  aicte_pid: string;
  institution_name: string;
  region: string;
  state: string;
  city: string;
  address: string;
  inst_type: string;
  approval_status: string;
  principal_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  established_year: number;
  total_faculty: number;
  total_students: number;
  images: string[];
}

export interface CreateCasePayload {
  aicte_pid: string;
  bureau: string;
  category: string;
  title: string;
  description?: string;
  institution_name?: string;
  institution_code?: string;
  region?: string;
  complainant_type?: string;
  assigned_officer?: string;
  sla_days?: number;
}

export interface InstitutionComplaintPayload {
  aicte_pid: string;
  category: string;
  title: string;
  description: string;
  bureau?: string;
  complainant_name?: string;
  complainant_email?: string;
  complainant_type?: string;
}

export interface AICTECase {
  id?: number;
  case_id: string;
  aicte_pid: string;
  institution_code: string;
  institution_name: string;
  region: string;
  bureau: string;
  category: string;
  title: string;
  description: string;
  complainant_user_id?: string;
  complainant_name: string;
  complainant_email?: string;
  complainant_type?: string;
  assigned_officer?: string;
  status: string;
  sla_days?: number;
  sla_deadline?: string;
  received_at?: string;
  resolved_at?: string;
  disposed_at?: string;
  created_at: string;
  updated_at?: string;
  ageing_days?: number;
  sla_breached?: boolean;
}
export interface DirectoryContact {
  id: string;
  name: string;
  email: string;
  role: string;
  role_label: string;
  institution: string;
  department: string;
  bureau: string;
  bureau_code: string;
  region: string;
  region_code: string;
  phone?: string;
  is_registered: boolean;
  is_current_user: boolean;
  contact_type: "registered_user" | "institutional_contact";
  delivery_method?: "internal" | "external_email";
}

export interface DirectoryGroup {
  institution: string;
  contacts: DirectoryContact[];
}

export interface DirectoryResponse {
  registered_users: DirectoryContact[];
  institutional_contacts: DirectoryContact[];
  total_count: number;
  grouped_by_institution: DirectoryGroup[];
  current_user: {
    id: string;
    name: string;
    email: string;
    institution: string;
    bureau: string;
    region: string;
  };
}

export interface CommsMessageRecipient {
  id: string;
  recipient_user_id?: string | null;
  recipient_email: string;
  recipient_name: string;
  recipient_type: string;
  is_registered: boolean | number;
  institution?: string;
  role_label?: string;
  folder?: string;
  read_at?: string | null;
  starred?: boolean | number;
  delivery_status?: string;
}

export interface CommsMessage {
  id: string;
  message_ref: string;
  subject: string;
  body: string;
  created_at: string;
  sent_at?: string;
  sender_user_id: string;
  sender_name: string;
  sender_email: string;
  sender_role: string;
  sender_role_label: string;
  sender_bureau: string;
  sender_region: string;
  sender_institution: string;
  thread_id?: string;
  in_reply_to?: string;
  delivery_type: string;
  attachments_json?: string;
  recipients?: CommsMessageRecipient[];
  to?: string;
  from?: string;
  folder?: string;
  read?: boolean;
  starred?: boolean;
  labels?: string[];
  labels_json?: string;
  ts?: number;
  is_sender?: boolean;
}

export interface SendCommsMessagePayload {
  to: string[];
  subject: string;
  body: string;
  in_reply_to?: string;
  thread_id?: string;
  send_external_email?: boolean;
  attachments?: Array<{ name: string; size: number; type: string }>;
  idempotency_key?: string;
  draft_id?: string;
}

export interface CommsDraft {
  id: string;
  user_id: string;
  to_recipients: string[];
  subject: string;
  body: string;
  attachments_json?: string;
  created_at: string;
  updated_at: string;
}

export interface CommsLabel {
  name: string;
  color: string;
}

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
  institution?: string;
  department?: string;
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
