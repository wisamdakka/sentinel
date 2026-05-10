const API_BASE =
  process.env.NEXT_PUBLIC_SENTINEL_API ?? "http://localhost:3000";

const TOKEN_KEY = "sentinel_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = init;
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  if (auth) {
    const token = getToken();
    if (token) h.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers: h });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `${res.status} ${res.statusText}`);
  }
  return body as T;
}

export interface SentinelUser {
  id: number;
  email: string;
  name: string;
  role: "admin" | "developer" | "viewer";
}

export interface SentinelSession {
  session_id: string;
  user_id?: number;
  workspace: string | null;
  business_type: string | null;
  business_confidence: number;
  started_at: string;
  updated_at: string;
}

export interface SentinelFinding {
  id: number;
  session_id: string;
  business_type: string | null;
  probe_title: string | null;
  probe_question: string | null;
  response: string | null;
  score: number | null;
  grade: string | null;
  severity: string | null;
  assessment: string | null;
  signals_json?: string;
  timestamp: string;
}

export interface SentinelActivity {
  id: string;
  type: "probe_exchange";
  timestamp: string;
  data: {
    probeTitle: string | null;
    question: string | null;
    response: string | null;
    score: number | null;
    grade: string | null;
    assessment: string | null;
    severity: string | null;
    signals: unknown[];
    businessType: string | null;
  };
}

export const api = {
  setupStatus: () =>
    request<{ setupRequired: boolean }>("/api/setup/status", { auth: false }),

  setupInit: (email: string, password: string, name?: string) =>
    request<{ ok: true; token: string; message: string }>("/api/setup/init", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
      auth: false,
    }),

  login: (email: string, password: string) =>
    request<{ ok: true; token: string; user: SentinelUser }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
        auth: false,
      }
    ),

  listSessions: () =>
    request<{ sessions: SentinelSession[]; count: number }>("/api/sessions"),

  getSession: (id: string) =>
    request<{ session: SentinelSession; findings: SentinelFinding[] }>(
      `/api/sessions/${encodeURIComponent(id)}`
    ),

  getSessionActivity: (id: string) =>
    request<{ activities: SentinelActivity[] }>(
      `/api/sessions/${encodeURIComponent(id)}/activity`
    ),

  launchRaid: (input: {
    business_type: string;
    probe_count?: number;
    target?:
      | {
          type: "openai_compatible";
          endpoint: string;
          api_key: string;
          model?: string;
          system_prompt?: string | null;
        }
      | null;
  }) =>
    request<{
      ok: true;
      session_id: string;
      workspace: string;
      business_type: string;
      probes: {
        id: number;
        title: string;
        question: string;
        risk: string;
        severity: string;
      }[];
    }>("/api/raids", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  postFinding: (finding: {
    session_id: string;
    workspace?: string | null;
    business_type?: string | null;
    probe_title: string;
    probe_question: string;
    response: string;
    score: number;
    grade: string;
    severity: string;
    assessment: string;
    timestamp?: string;
  }) =>
    request<{ ok: true; id: string }>("/api/findings", {
      method: "POST",
      body: JSON.stringify(finding),
    }),

  stats: () =>
    request<{
      totalFindings: number;
      averageScore: number;
      gradeDistribution: Record<string, number>;
      businessTypeDistribution: Record<string, number>;
      activeSessions: number;
    }>("/api/stats"),
};
