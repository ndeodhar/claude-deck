// ─── JSONL record types (what we read from files) ───

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
  service_tier?: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content?: unknown;
}

export type ContentBlock = ToolUseBlock | TextBlock | ToolResultBlock;

export interface AssistantMessage {
  id?: string;
  role: "assistant";
  content: ContentBlock[];
  model: string;
  usage: Usage;
}

export interface ToolUseResult {
  type?: string;
  // Bash
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  // Read/Edit
  file?: string;
  filePath?: string;
  content?: string;
  structuredPatch?: unknown;
  originalFile?: string;
  // Glob/Grep
  matches?: unknown[];
  // Task (subagent)
  status?: string;
  agentId?: string;
  totalDurationMs?: number;
  totalTokens?: number;
  totalToolUseCount?: number;
  usage?: Usage;
}

export interface UserMessage {
  role: "user";
  content: ContentBlock[] | string;
}

export interface AssistantRecord {
  type: "assistant";
  message: AssistantMessage;
  timestamp: string;
}

export interface UserRecord {
  type: "user";
  message: UserMessage;
  userType?: "external" | "internal";
  toolUseResult?: ToolUseResult;
  toolUseID?: string;
  timestamp: string;
}

export interface SystemRecord {
  type: "system";
  subtype?: string;
  compactMetadata?: unknown;
  timestamp: string;
}

export type JsonlRecord =
  | AssistantRecord
  | UserRecord
  | SystemRecord
  | { type: string; timestamp?: string };

export interface CompactBoundaryRecord {
  type: "system";
  subtype: "compact_boundary";
  timestamp: string;
  compactMetadata: {
    trigger: string;
    preTokens: number;
  };
}

// ─── Parsed data (what we store in SQLite) ───

export interface ParsedSession {
  id: string;
  project: string;
  projectHash: string;
  firstPrompt: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  estimatedCostUsd: number;
  messageCount: number;
  toolCallCount: number;
  subagentCount: number;
  turnCount: number;
  peakContextTokens: number;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  jsonlPath: string;
  jsonlMtime: string;
  toolCalls: ParsedToolCall[];
  messages: ParsedMessage[];
  subagents: ParsedSubagent[];
  compactions: ParsedCompaction[];
}

export interface ParsedToolCall {
  toolUseId: string | null;
  toolName: string;
  toolInput: string;
  toolResponse: string | null;
  status: string;
  timestamp: string;
  subagentId: string | null;
}

export interface ParsedMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  model: string | null;
  costUsd: number | null;
}

export interface ParsedCompaction {
  timestamp: string;
  trigger: string;
  preTokens: number;
}

export interface ParsedSubagent {
  id: string;
  agentType: string | null;
  model: string | null;
  prompt: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  estimatedCostUsd: number;
  toolCallCount: number;
  durationMs: number | null;
  resultSummary: string | null;
}

// ─── API response types ───

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
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  peak_context_tokens: number;
  compaction_count: number;
  peak_context_pct: number;
  synced_at: string;
  jsonl_path: string;
  jsonl_mtime: string;
}

export interface ToolCallRow {
  id: number;
  session_id: string;
  subagent_id: string | null;
  tool_use_id: string | null;
  tool_name: string;
  tool_input: string | null;
  tool_response: string | null;
  status: string;
  timestamp: string;
}

export interface MessageRow {
  id: number;
  session_id: string;
  role: string;
  content: string;
  timestamp: string;
  model: string | null;
  cost_usd: number | null;
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

export interface CompactionRow {
  id: number;
  session_id: string;
  trigger: string;
  pre_tokens: number;
  timestamp: string;
}

// ─── Session insights ───

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

export interface WebFetchStats {
  total: number;
  errors: number;
  successRate: number;
  details: WebFetchDetail[];
}

export interface CompactionInfo {
  count: number;
  compactions: { timestamp: string; trigger: string; preTokens: number }[];
}

export interface SessionInsights {
  fileReads: FileReadPattern[];
  phases: SessionPhase[];
  webFetches: WebFetchStats;
  toolDistribution: { tool: string; count: number }[];
  totalToolCalls: number;
  sessionDurationMs: number;
  compaction: CompactionInfo;
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
