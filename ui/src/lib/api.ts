const BASE = "/api";

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin);
  url.pathname = BASE + path;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { method: "POST" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Types mirroring server ───

export interface SessionRow {
  id: string;
  project: string;
  project_hash: string;
  first_prompt: string | null;
  model: string | null;
  status: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_create_tokens: number;
  estimated_cost_usd: number;
  message_count: number;
  tool_call_count: number;
  subagent_count: number;
  turn_count: number;
  compaction_count: number;
  peak_context_pct: number;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
}

export interface TimelineEntry {
  _type: "tool_call" | "message";
  id: number;
  session_id: string;
  timestamp: string;
  // tool_call fields
  subagent_id?: string | null;
  tool_use_id?: string | null;
  tool_name?: string;
  tool_input?: string | null;
  tool_response?: string | null;
  status?: string;
  // message fields
  role?: string;
  content?: string;
  model?: string | null;
  cost_usd?: number | null;
}

export interface SubagentRow {
  id: string;
  session_id: string;
  agent_type: string | null;
  model: string | null;
  prompt: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_create_tokens: number;
  estimated_cost_usd: number;
  tool_call_count: number;
  duration_ms: number | null;
  result_summary: string | null;
}

export interface StatsResponse {
  totalSessions: number;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  avgCostPerSession: number;
  byModel: { model: string; sessions: number; cost: number; tokens: number }[];
  byProject: { project: string; sessions: number; cost: number; tokens: number }[];
  byDay: { date: string; sessions: number; cost: number; tokens: number }[];
  topTools: { tool: string; count: number }[];
}

export interface SyncStatus {
  lastSyncedAt: string | null;
  sessionCount: number;
}

export interface SyncResult {
  parsed: number;
  skipped: number;
  errors: number;
  totalSessions: number;
}

export interface FileReadPattern {
  file: string;
  count: number;
}

export interface SessionPhase {
  name: string;
  category: "explore" | "research" | "write" | "execute" | "other";
  toolCount: number;
  durationMs: number;
}

export interface WebFetchDetail {
  tool: string;
  url: string;
  timestamp: string;
  isError: boolean;
  errorDetail: string;
}

export interface CompactionInfo {
  count: number;
  compactions: { timestamp: string; trigger: string; preTokens: number }[];
}

export interface SessionInsights {
  fileReads: FileReadPattern[];
  phases: SessionPhase[];
  webFetches: {
    total: number;
    errors: number;
    successRate: number;
    details: WebFetchDetail[];
  };
  toolDistribution: { tool: string; count: number }[];
  totalToolCalls: number;
  sessionDurationMs: number;
  compaction: CompactionInfo;
}

// ─── API functions ───

export function fetchSessions(params?: Record<string, string>) {
  return get<{ sessions: SessionRow[]; total: number }>("/sessions", params);
}

export function fetchSession(id: string) {
  return get<SessionRow>(`/sessions/${id}`);
}

export function fetchTimeline(id: string) {
  return get<TimelineEntry[]>(`/sessions/${id}/timeline`);
}

export function fetchSubagents(id: string) {
  return get<SubagentRow[]>(`/sessions/${id}/subagents`);
}

export function fetchStats(params?: Record<string, string>) {
  return get<StatsResponse>("/stats", params);
}

export function fetchSyncStatus() {
  return get<SyncStatus>("/sync/status");
}

export function fetchInsights(id: string) {
  return get<SessionInsights>(`/sessions/${id}/insights`);
}

export function triggerSync() {
  return post<SyncResult>("/sync");
}
