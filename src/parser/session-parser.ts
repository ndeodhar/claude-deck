import { createReadStream } from "fs";
import { createInterface } from "readline";
import { estimateCost } from "./cost.js";
import type {
  JsonlRecord,
  AssistantRecord,
  UserRecord,
  CompactBoundaryRecord,
  ParsedSession,
  ParsedToolCall,
  ParsedMessage,
  ParsedCompaction,
  ContentBlock,
  ToolUseBlock,
} from "../types.js";

const MAX_TOOL_INPUT_LENGTH = 2000;
const MAX_TOOL_RESPONSE_LENGTH = 2000;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}

function extractText(content: ContentBlock[] | string): string {
  if (typeof content === "string") return content;
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/** Strip XML system tags that get injected into user messages */
function cleanPrompt(text: string): string {
  // Remove common system-injected XML blocks
  return text
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, "")
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, "")
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, "")
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "")
    .trim();
}

export async function parseSessionJsonl(
  jsonlPath: string,
  sessionId: string,
  project: string,
  projectHash: string,
  jsonlMtime: string,
): Promise<ParsedSession> {
  const toolCalls: ParsedToolCall[] = [];
  const messages: ParsedMessage[] = [];
  const compactions: ParsedCompaction[] = [];
  const modelCounts = new Map<string, number>();

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreateTokens = 0;
  let totalCost = 0;
  let firstPrompt: string | null = null;
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let turnCount = 0;
  let lastRole: string | null = null;
  let peakContextTokens = 0;

  // Map tool_use_id → index in toolCalls for linking results
  const toolUseIdMap = new Map<string, number>();
  // Track seen message IDs to avoid duplicate content extraction (tool_use blocks, text, turns)
  // but NOT usage — usage is summed from every record to match claude /stats accounting.
  const seenMessageIds = new Set<string>();

  const rl = createInterface({
    input: createReadStream(jsonlPath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    let record: JsonlRecord;
    try {
      record = JSON.parse(line);
    } catch {
      continue; // skip malformed lines
    }

    const ts = record.timestamp ?? "";
    if (ts && !startedAt) startedAt = ts;
    if (ts) endedAt = ts;

    if (record.type === "assistant") {
      const rec = record as AssistantRecord;
      const msg = rec.message;

      const msgId = msg.id;
      const alreadySeen = msgId ? seenMessageIds.has(msgId) : false;
      if (msgId) seenMessageIds.add(msgId);

      // Track model (only once per message)
      if (msg.model && !alreadySeen) {
        modelCounts.set(msg.model, (modelCounts.get(msg.model) ?? 0) + 1);
      }

      // Accumulate usage from every record (matches claude /stats accounting)
      let turnCost = 0;
      if (msg.usage) {
        inputTokens += msg.usage.input_tokens ?? 0;
        outputTokens += msg.usage.output_tokens ?? 0;
        cacheReadTokens += msg.usage.cache_read_input_tokens ?? 0;
        cacheCreateTokens += msg.usage.cache_creation_input_tokens ?? 0;
        turnCost = estimateCost(msg.model ?? "claude-sonnet-4-6", msg.usage);
        totalCost += turnCost;

        // Track peak context fill (total tokens sent in a single API call)
        const turnContext =
          (msg.usage.input_tokens ?? 0) +
          (msg.usage.cache_read_input_tokens ?? 0) +
          (msg.usage.cache_creation_input_tokens ?? 0);
        if (turnContext > peakContextTokens) peakContextTokens = turnContext;
      }

      // Extract tool use blocks (deduplicate by tool_use_id to avoid duplicates)
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "tool_use") {
            const tb = block as ToolUseBlock;
            if (!toolUseIdMap.has(tb.id)) {
              const tc: ParsedToolCall = {
                toolUseId: tb.id,
                toolName: tb.name,
                toolInput: truncate(JSON.stringify(tb.input), MAX_TOOL_INPUT_LENGTH),
                toolResponse: null,
                status: "pending",
                timestamp: ts,
                subagentId: null,
              };
              toolUseIdMap.set(tb.id, toolCalls.length);
              toolCalls.push(tc);
            }
          }
        }

        // Extract text for messages (only once per message)
        if (!alreadySeen) {
          const text = extractText(msg.content);
          if (text.trim()) {
            messages.push({
              role: "assistant",
              content: text,
              timestamp: ts,
              model: msg.model ?? null,
              costUsd: turnCost,
            });
          }
        }
      }

      // Track turns (only once per message ID)
      if (!alreadySeen && lastRole !== "assistant") turnCount++;
      if (!alreadySeen) lastRole = "assistant";
    } else if (record.type === "user") {
      const rec = record as UserRecord;

      // External user message
      if (rec.userType === "external") {
        const rawText =
          typeof rec.message?.content === "string"
            ? rec.message.content
            : extractText(rec.message?.content ?? []);
        const text = cleanPrompt(rawText);
        if (text) {
          messages.push({ role: "user", content: text, timestamp: ts, model: null, costUsd: null });
          if (!firstPrompt) firstPrompt = text;
        }
      }

      // Tool result — match via top-level toolUseID or message.content tool_result blocks
      if (rec.toolUseResult && rec.toolUseID) {
        const idx = toolUseIdMap.get(rec.toolUseID);
        if (idx !== undefined) {
          toolCalls[idx].status = "success";
          toolCalls[idx].toolResponse = truncate(
            JSON.stringify(rec.toolUseResult),
            MAX_TOOL_RESPONSE_LENGTH,
          );
        }
      }
      // Also check message.content for tool_result blocks (primary path for most tools)
      const userContent = rec.message?.content;
      if (Array.isArray(userContent)) {
        for (const block of userContent) {
          if (block.type === "tool_result") {
            const idx = toolUseIdMap.get(block.tool_use_id);
            if (idx !== undefined && !toolCalls[idx].toolResponse) {
              toolCalls[idx].status = "success";
              toolCalls[idx].toolResponse = truncate(
                typeof block.content === "string"
                  ? block.content
                  : JSON.stringify(block.content ?? ""),
                MAX_TOOL_RESPONSE_LENGTH,
              );
            }
          }
        }
      }

      if (rec.userType === "external") {
        lastRole = "user";
      }
    } else if (
      record.type === "system" &&
      (record as { subtype?: string }).subtype === "compact_boundary"
    ) {
      const rec = record as unknown as CompactBoundaryRecord;
      if (rec.compactMetadata) {
        compactions.push({
          timestamp: ts,
          trigger: rec.compactMetadata.trigger ?? "auto",
          preTokens: rec.compactMetadata.preTokens ?? 0,
        });
      }
    }
  }

  // Determine primary model
  let primaryModel: string | null = null;
  let maxCount = 0;
  for (const [model, count] of modelCounts) {
    if (count > maxCount) {
      primaryModel = model;
      maxCount = count;
    }
  }

  // Calculate duration
  let durationMs: number | null = null;
  if (startedAt && endedAt) {
    durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  }

  return {
    id: sessionId,
    project,
    projectHash,
    firstPrompt,
    model: primaryModel,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreateTokens,
    estimatedCostUsd: totalCost,
    messageCount: messages.length,
    toolCallCount: toolCalls.length,
    subagentCount: 0, // filled in by index.ts after subagent parsing
    turnCount,
    peakContextTokens,
    startedAt,
    endedAt,
    durationMs,
    jsonlPath,
    jsonlMtime,
    toolCalls,
    messages,
    subagents: [],
    compactions,
  };
}
