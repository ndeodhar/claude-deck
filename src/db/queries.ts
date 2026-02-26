import type Database from "better-sqlite3";
import type {
  ParsedSession,
  SessionRow,
  ToolCallRow,
  MessageRow,
  SubagentRow,
  StatsResponse,
} from "../types.js";

// ─── Insert/Update ───

export function upsertSession(db: Database.Database, session: ParsedSession): void {
  const txn = db.transaction(() => {
    // Delete existing data for this session (re-insert on sync)
    db.prepare("DELETE FROM tool_calls WHERE session_id = ?").run(session.id);
    db.prepare("DELETE FROM messages WHERE session_id = ?").run(session.id);
    db.prepare("DELETE FROM subagents WHERE session_id = ?").run(session.id);
    db.prepare("DELETE FROM compactions WHERE session_id = ?").run(session.id);
    db.prepare("DELETE FROM sessions WHERE id = ?").run(session.id);

    // Insert session
    db.prepare(
      `
      INSERT INTO sessions (
        id, project, project_hash, first_prompt, model, status,
        input_tokens, output_tokens, cache_read_tokens, cache_create_tokens, estimated_cost_usd,
        message_count, tool_call_count, subagent_count, turn_count, peak_context_tokens,
        started_at, ended_at, duration_ms, synced_at, jsonl_path, jsonl_mtime
      ) VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      session.id,
      session.project,
      session.projectHash,
      session.firstPrompt,
      session.model,
      session.inputTokens,
      session.outputTokens,
      session.cacheReadTokens,
      session.cacheCreateTokens,
      session.estimatedCostUsd,
      session.messageCount,
      session.toolCallCount,
      session.subagentCount,
      session.turnCount,
      session.peakContextTokens,
      session.startedAt,
      session.endedAt,
      session.durationMs,
      new Date().toISOString(),
      session.jsonlPath,
      session.jsonlMtime,
    );

    // Insert tool calls
    const insertTc = db.prepare(`
      INSERT INTO tool_calls (session_id, subagent_id, tool_use_id, tool_name, tool_input, tool_response, status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const tc of session.toolCalls) {
      insertTc.run(
        session.id,
        tc.subagentId,
        tc.toolUseId,
        tc.toolName,
        tc.toolInput,
        tc.toolResponse,
        tc.status,
        tc.timestamp,
      );
    }

    // Insert messages
    const insertMsg = db.prepare(`
      INSERT INTO messages (session_id, role, content, timestamp, model, cost_usd) VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const msg of session.messages) {
      insertMsg.run(session.id, msg.role, msg.content, msg.timestamp, msg.model, msg.costUsd);
    }

    // Insert subagents
    const insertSub = db.prepare(`
      INSERT INTO subagents (id, session_id, agent_type, model, prompt, input_tokens, output_tokens, cache_read_tokens, cache_create_tokens, estimated_cost_usd, tool_call_count, duration_ms, result_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const sub of session.subagents) {
      insertSub.run(
        sub.id,
        session.id,
        sub.agentType,
        sub.model,
        sub.prompt,
        sub.inputTokens,
        sub.outputTokens,
        sub.cacheReadTokens,
        sub.cacheCreateTokens,
        sub.estimatedCostUsd,
        sub.toolCallCount,
        sub.durationMs,
        sub.resultSummary,
      );
    }

    // Insert compactions
    const insertCompact = db.prepare(`
      INSERT INTO compactions (session_id, trigger, pre_tokens, timestamp) VALUES (?, ?, ?, ?)
    `);
    for (const c of session.compactions) {
      insertCompact.run(session.id, c.trigger, c.preTokens, c.timestamp);
    }
  });

  txn();
}

// ─── Queries ───

export function listSessions(
  db: Database.Database,
  opts: {
    project?: string;
    model?: string;
    after?: string;
    before?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  } = {},
): { sessions: SessionRow[]; total: number } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.project) {
    conditions.push("project LIKE ?");
    params.push(`%${opts.project}%`);
  }
  if (opts.model) {
    conditions.push("model LIKE ?");
    params.push(`%${opts.model}%`);
  }
  if (opts.after) {
    conditions.push("started_at >= ?");
    params.push(opts.after);
  }
  if (opts.before) {
    conditions.push("started_at <= ?");
    params.push(opts.before);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const sortCol: Record<string, string> = {
    cost: "estimated_cost_usd DESC",
    tokens: "(input_tokens + output_tokens + cache_read_tokens + cache_create_tokens) DESC",
    date: "started_at DESC",
    duration: "duration_ms DESC",
  };
  const orderBy = sortCol[opts.sort ?? "date"] ?? sortCol.date;
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const total = db.prepare(`SELECT COUNT(*) as count FROM sessions ${where}`).get(...params) as {
    count: number;
  };
  const sessions = db
    .prepare(
      `SELECT s.*,
        COALESCE((SELECT COUNT(*) FROM compactions c WHERE c.session_id = s.id), 0) as compaction_count,
        ROUND(MAX(s.peak_context_tokens, COALESCE((SELECT MAX(c.pre_tokens) FROM compactions c WHERE c.session_id = s.id), 0)) * 100.0 / 200000, 1) as peak_context_pct
      FROM sessions s ${where ? where.replace(/\b(started_at|project|model)\b/g, "s.$1") : ""} ORDER BY ${orderBy.replace(/\b(started_at|estimated_cost_usd|input_tokens|output_tokens|cache_read_tokens|cache_create_tokens|duration_ms)\b/g, "s.$1")} LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as SessionRow[];

  return { sessions, total: total.count };
}

export function getSession(db: Database.Database, id: string): SessionRow | undefined {
  return db
    .prepare(
      `SELECT s.*,
        COALESCE((SELECT COUNT(*) FROM compactions c WHERE c.session_id = s.id), 0) as compaction_count,
        ROUND(MAX(s.peak_context_tokens, COALESCE((SELECT MAX(c.pre_tokens) FROM compactions c WHERE c.session_id = s.id), 0)) * 100.0 / 200000, 1) as peak_context_pct
      FROM sessions s WHERE s.id = ?`,
    )
    .get(id) as SessionRow | undefined;
}

export function getTimeline(
  db: Database.Database,
  sessionId: string,
): (ToolCallRow | MessageRow)[] {
  const toolCalls = db
    .prepare(
      "SELECT *, 'tool_call' as _type FROM tool_calls WHERE session_id = ? ORDER BY timestamp",
    )
    .all(sessionId) as (ToolCallRow & { _type: string })[];
  const messages = db
    .prepare("SELECT *, 'message' as _type FROM messages WHERE session_id = ? ORDER BY timestamp")
    .all(sessionId) as (MessageRow & { _type: string })[];

  // Merge and sort by timestamp
  const all = [...toolCalls, ...messages].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return all;
}

export function getSubagents(db: Database.Database, sessionId: string): SubagentRow[] {
  return db
    .prepare("SELECT * FROM subagents WHERE session_id = ? ORDER BY id")
    .all(sessionId) as SubagentRow[];
}

export function getStats(
  db: Database.Database,
  opts: { after?: string; before?: string; model?: string } = {},
): StatsResponse {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.after) {
    conditions.push("started_at >= ?");
    params.push(opts.after);
  }
  if (opts.before) {
    conditions.push("started_at <= ?");
    params.push(opts.before);
  }
  if (opts.model) {
    conditions.push("model LIKE ?");
    params.push(`%${opts.model}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const agg = db
    .prepare(
      `
    SELECT
      COUNT(*) as totalSessions,
      COALESCE(SUM(estimated_cost_usd), 0) as totalCost,
      COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens + cache_create_tokens), 0) as totalTokens,
      COALESCE(SUM(input_tokens), 0) as inputTokens,
      COALESCE(SUM(output_tokens), 0) as outputTokens,
      COALESCE(SUM(cache_read_tokens), 0) as cacheReadTokens,
      COALESCE(SUM(cache_create_tokens), 0) as cacheCreateTokens
    FROM sessions ${where}
  `,
    )
    .get(...params) as {
    totalSessions: number;
    totalCost: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreateTokens: number;
  };

  const byModel = db
    .prepare(
      `
    SELECT model, COUNT(*) as sessions, SUM(estimated_cost_usd) as cost,
      SUM(input_tokens + output_tokens + cache_read_tokens + cache_create_tokens) as tokens
    FROM sessions ${where}
    GROUP BY model ORDER BY cost DESC
  `,
    )
    .all(...params) as StatsResponse["byModel"];

  const byProject = db
    .prepare(
      `
    SELECT project, COUNT(*) as sessions, SUM(estimated_cost_usd) as cost,
      SUM(input_tokens + output_tokens + cache_read_tokens + cache_create_tokens) as tokens
    FROM sessions ${where}
    GROUP BY project ORDER BY cost DESC
  `,
    )
    .all(...params) as StatsResponse["byProject"];

  const byDay = db
    .prepare(
      `
    SELECT DATE(started_at) as date, COUNT(*) as sessions, SUM(estimated_cost_usd) as cost,
      SUM(input_tokens + output_tokens + cache_read_tokens + cache_create_tokens) as tokens
    FROM sessions ${where}
    GROUP BY DATE(started_at) ORDER BY date
  `,
    )
    .all(...params) as StatsResponse["byDay"];

  const topTools = db
    .prepare(
      `
    SELECT tool_name as tool, COUNT(*) as count
    FROM tool_calls tc JOIN sessions s ON tc.session_id = s.id ${where ? where.replace("started_at", "s.started_at") : ""}
    GROUP BY tool_name ORDER BY count DESC LIMIT 15
  `,
    )
    .all(...params) as StatsResponse["topTools"];

  return {
    ...agg,
    avgCostPerSession: agg.totalSessions > 0 ? agg.totalCost / agg.totalSessions : 0,
    byModel,
    byProject,
    byDay,
    topTools,
  };
}

export function getSessionMtime(db: Database.Database, id: string): string | undefined {
  const row = db.prepare("SELECT jsonl_mtime FROM sessions WHERE id = ?").get(id) as
    | { jsonl_mtime: string }
    | undefined;
  return row?.jsonl_mtime;
}

// ─── Session Insights ───

const TOOL_CATEGORIES: Record<string, "explore" | "research" | "write" | "execute" | "other"> = {
  Read: "explore",
  Glob: "explore",
  Grep: "explore",
  Explore: "explore",
  WebFetch: "research",
  WebSearch: "research",
  Write: "write",
  Edit: "write",
  NotebookEdit: "write",
  Bash: "execute",
  Task: "other",
  TaskCreate: "other",
  TaskUpdate: "other",
  TaskList: "other",
  TaskGet: "other",
  EnterPlanMode: "other",
  ExitPlanMode: "other",
  AskUserQuestion: "other",
  Skill: "other",
};

function getCategory(toolName: string): "explore" | "research" | "write" | "execute" | "other" {
  return TOOL_CATEGORIES[toolName] ?? "other";
}

export function getSessionInsights(
  db: Database.Database,
  sessionId: string,
): import("../types.js").SessionInsights {
  // File read patterns — files read 2+ times
  const allReads = db
    .prepare(
      `SELECT tool_input FROM tool_calls WHERE session_id = ? AND tool_name = 'Read' AND tool_input IS NOT NULL`,
    )
    .all(sessionId) as { tool_input: string }[];

  const fileCounts = new Map<string, number>();
  for (const row of allReads) {
    try {
      const input = JSON.parse(row.tool_input);
      const file = input.file_path;
      if (file) fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
    } catch {
      /* skip */
    }
  }
  const fileReads = [...fileCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([file, count]) => ({ file, count }));

  // Tool distribution
  const toolDistribution = db
    .prepare(
      `SELECT tool_name as tool, COUNT(*) as count FROM tool_calls WHERE session_id = ? GROUP BY tool_name ORDER BY count DESC`,
    )
    .all(sessionId) as { tool: string; count: number }[];

  const totalToolCalls = toolDistribution.reduce((sum, t) => sum + t.count, 0);

  // All tool calls ordered by time for phase + gap analysis
  const allCalls = db
    .prepare(
      `SELECT tool_name, timestamp FROM tool_calls WHERE session_id = ? AND subagent_id IS NULL ORDER BY timestamp`,
    )
    .all(sessionId) as { tool_name: string; timestamp: string }[];

  // Phase analysis — group consecutive tools of the same category
  const phases: import("../types.js").SessionPhase[] = [];
  const CATEGORY_LABELS: Record<string, string> = {
    explore: "Exploration",
    research: "Research",
    write: "Writing",
    execute: "Execution",
    other: "Other",
  };

  if (allCalls.length > 0) {
    let currentCategory = getCategory(allCalls[0].tool_name);
    let phaseStart = allCalls[0].timestamp;
    let phaseToolCount = 1;

    for (let i = 1; i < allCalls.length; i++) {
      const cat = getCategory(allCalls[i].tool_name);
      if (cat !== currentCategory) {
        // Close current phase
        const endTs = allCalls[i - 1].timestamp;
        phases.push({
          name: CATEGORY_LABELS[currentCategory],
          category: currentCategory,
          toolCount: phaseToolCount,
          durationMs: new Date(endTs).getTime() - new Date(phaseStart).getTime(),
        });
        currentCategory = cat;
        phaseStart = allCalls[i].timestamp;
        phaseToolCount = 1;
      } else {
        phaseToolCount++;
      }
    }
    // Close last phase
    const lastTs = allCalls[allCalls.length - 1].timestamp;
    phases.push({
      name: CATEGORY_LABELS[currentCategory],
      category: currentCategory,
      toolCount: phaseToolCount,
      durationMs: new Date(lastTs).getTime() - new Date(phaseStart).getTime(),
    });
  }

  // Merge tiny phases (< 2 tool calls) into neighbors of the same category
  // and aggregate by category for summary
  const phaseSummary = new Map<string, { toolCount: number; durationMs: number }>();
  for (const p of phases) {
    const existing = phaseSummary.get(p.category);
    if (existing) {
      existing.toolCount += p.toolCount;
      existing.durationMs += p.durationMs;
    } else {
      phaseSummary.set(p.category, { toolCount: p.toolCount, durationMs: p.durationMs });
    }
  }

  // Web fetch details
  const webRows = db
    .prepare(
      `SELECT tool_name, tool_input, tool_response, timestamp FROM tool_calls WHERE session_id = ? AND tool_name IN ('WebFetch', 'WebSearch') ORDER BY timestamp`,
    )
    .all(sessionId) as {
    tool_name: string;
    tool_input: string | null;
    tool_response: string | null;
    timestamp: string;
  }[];

  const webFetchDetails: import("../types.js").WebFetchDetail[] = [];
  let webErrors = 0;
  for (const row of webRows) {
    let url = "";
    let query = "";
    try {
      const input = JSON.parse(row.tool_input ?? "{}");
      url = input.url ?? "";
      query = input.query ?? "";
    } catch {
      /* skip */
    }

    let isError = false;
    let errorDetail = "";
    if (!row.tool_response) {
      isError = true;
      errorDetail = "No response";
    } else {
      // Only flag as error if the response is clearly an error object, not just
      // content that happens to mention error-related words
      try {
        const resp = JSON.parse(row.tool_response);
        if (resp.error || resp.is_error === true) {
          isError = true;
          errorDetail = resp.error ?? resp.message ?? "Failed";
        }
      } catch {
        // Non-JSON response — check for short error-like responses only
        if (row.tool_response.length < 200) {
          const lower = row.tool_response.toLowerCase();
          if (lower.includes("error") || lower.includes("failed") || lower.includes("timeout")) {
            isError = true;
            errorDetail = row.tool_response.slice(0, 100);
          }
        }
      }
    }

    if (isError) webErrors++;
    webFetchDetails.push({
      tool: row.tool_name,
      url: url || query || "(unknown)",
      timestamp: row.timestamp,
      isError,
      errorDetail,
    });
  }

  const session = db.prepare("SELECT duration_ms FROM sessions WHERE id = ?").get(sessionId) as
    | { duration_ms: number | null }
    | undefined;

  // Compaction events
  const compactionRows = db
    .prepare(
      `SELECT trigger, pre_tokens, timestamp FROM compactions WHERE session_id = ? ORDER BY timestamp`,
    )
    .all(sessionId) as { trigger: string; pre_tokens: number; timestamp: string }[];

  return {
    fileReads,
    phases: [...phaseSummary.entries()].map(([cat, data]) => ({
      name: CATEGORY_LABELS[cat],
      category: cat as "explore" | "research" | "write" | "execute" | "other",
      toolCount: data.toolCount,
      durationMs: data.durationMs,
    })),
    webFetches: {
      total: webRows.length,
      errors: webErrors,
      successRate: webRows.length > 0 ? (webRows.length - webErrors) / webRows.length : 1,
      details: webFetchDetails,
    },
    toolDistribution,
    totalToolCalls,
    sessionDurationMs: session?.duration_ms ?? 0,
    compaction: {
      count: compactionRows.length,
      compactions: compactionRows.map((r) => ({
        timestamp: r.timestamp,
        trigger: r.trigger,
        preTokens: r.pre_tokens,
      })),
    },
  };
}

export function getSyncStatus(db: Database.Database): {
  lastSyncedAt: string | null;
  sessionCount: number;
} {
  const row = db
    .prepare("SELECT MAX(synced_at) as lastSyncedAt, COUNT(*) as sessionCount FROM sessions")
    .get() as {
    lastSyncedAt: string | null;
    sessionCount: number;
  };
  return row;
}
