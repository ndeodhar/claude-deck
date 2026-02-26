import { createReadStream } from "fs";
import { createInterface } from "readline";
import { estimateCost } from "./cost.js";
import type {
  JsonlRecord,
  AssistantRecord,
  UserRecord,
  ParsedSubagent,
  ParsedToolCall,
  ToolUseBlock,
} from "../types.js";

const MAX_TOOL_INPUT_LENGTH = 2000;
const MAX_TOOL_RESPONSE_LENGTH = 2000;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}

export async function parseSubagentJsonl(
  jsonlPath: string,
  agentId: string,
  sessionId: string,
): Promise<{ subagent: ParsedSubagent; toolCalls: ParsedToolCall[] }> {
  const toolCalls: ParsedToolCall[] = [];
  const toolUseIdMap = new Map<string, number>();

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreateTokens = 0;
  let totalCost = 0;
  let agentType: string | null = null;
  let prompt: string | null = null;
  let lastAssistantText: string | null = null;
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  const modelCounts = new Map<string, number>();
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
      continue;
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

      if (msg.model && !alreadySeen) {
        modelCounts.set(msg.model, (modelCounts.get(msg.model) ?? 0) + 1);
      }

      // Accumulate usage from every record (matches claude /stats accounting)
      if (msg.usage) {
        inputTokens += msg.usage.input_tokens ?? 0;
        outputTokens += msg.usage.output_tokens ?? 0;
        cacheReadTokens += msg.usage.cache_read_input_tokens ?? 0;
        cacheCreateTokens += msg.usage.cache_creation_input_tokens ?? 0;
        totalCost += estimateCost(msg.model ?? "claude-sonnet-4-6", msg.usage);
      }

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
                subagentId: agentId,
              };
              toolUseIdMap.set(tb.id, toolCalls.length);
              toolCalls.push(tc);
            }
          } else if (block.type === "text" && "text" in block) {
            lastAssistantText = (block as { type: "text"; text: string }).text;
          }
        }
      }
    } else if (record.type === "user") {
      const rec = record as UserRecord;

      // Try to extract agent type and prompt from the first user message
      if (!prompt && rec.userType === "external") {
        const content =
          typeof rec.message?.content === "string"
            ? rec.message.content
            : Array.isArray(rec.message?.content)
              ? rec.message.content
                  .filter((b): b is { type: "text"; text: string } => b.type === "text")
                  .map((b) => b.text)
                  .join("\n")
              : "";
        if (content) prompt = content.slice(0, 500);
      }

      // Tool result
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
    }
  }

  // Try to infer agent type from the agent ID path or prompt
  if (!agentType && prompt) {
    const lower = prompt.toLowerCase();
    if (lower.includes("explore") || lower.includes("search")) agentType = "Explore";
    else if (lower.includes("plan")) agentType = "Plan";
    else agentType = "general-purpose";
  }

  // Determine primary model
  let model: string | null = null;
  let maxCount = 0;
  for (const [m, count] of modelCounts) {
    if (count > maxCount) {
      model = m;
      maxCount = count;
    }
  }

  let durationMs: number | null = null;
  if (startedAt && endedAt) {
    durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  }

  return {
    subagent: {
      id: agentId,
      agentType,
      model,
      prompt,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreateTokens,
      estimatedCostUsd: totalCost,
      toolCallCount: toolCalls.length,
      durationMs,
      resultSummary: lastAssistantText?.slice(0, 500) ?? null,
    },
    toolCalls,
  };
}
