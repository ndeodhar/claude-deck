import type { Usage } from "../types.js";

// Prices per million tokens — from https://platform.claude.com/docs/en/about-claude/pricing
// Cache read = 0.1x input, cache write 5min = 1.25x input, cache write 1hr = 2x input
const PRICING: Record<
  string,
  { input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number }
> = {
  // Current models
  "claude-opus-4-6": { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
  "claude-opus-4-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
  "claude-sonnet-4-6": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite5m: 3.75,
    cacheWrite1h: 6,
  },
  "claude-sonnet-4-5": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite5m: 3.75,
    cacheWrite1h: 6,
  },
  "claude-sonnet-4": { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite5m: 1.25, cacheWrite1h: 2 },
  // Older models
  "claude-opus-4-1": {
    input: 15,
    output: 75,
    cacheRead: 1.5,
    cacheWrite5m: 18.75,
    cacheWrite1h: 30,
  },
  "claude-opus-4": { input: 15, output: 75, cacheRead: 1.5, cacheWrite5m: 18.75, cacheWrite1h: 30 },
  "claude-sonnet-4-5-20250514": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite5m: 3.75,
    cacheWrite1h: 6,
  },
  "claude-3-5-sonnet-20241022": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite5m: 3.75,
    cacheWrite1h: 6,
  },
  "claude-3-5-haiku-20241022": {
    input: 0.8,
    output: 4,
    cacheRead: 0.08,
    cacheWrite5m: 1,
    cacheWrite1h: 1.6,
  },
  "claude-haiku-3": {
    input: 0.25,
    output: 1.25,
    cacheRead: 0.03,
    cacheWrite5m: 0.3,
    cacheWrite1h: 0.5,
  },
};

/** Strip date suffix like "-20251001" from model IDs */
function stripDateSuffix(model: string): string {
  return model.replace(/-\d{8,}$/, "");
}

export function estimateCost(model: string, usage: Usage): number {
  // 1. Exact match  2. Strip date suffix  3. Fallback to sonnet
  const p = PRICING[model] ?? PRICING[stripDateSuffix(model)] ?? PRICING["claude-sonnet-4-6"];

  // Use granular cache write tiers when available, otherwise default to 5-min pricing
  const cache5m = usage.cache_creation?.ephemeral_5m_input_tokens ?? 0;
  const cache1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const cacheWriteCost =
    cache5m + cache1h > 0
      ? cache5m * p.cacheWrite5m + cache1h * p.cacheWrite1h
      : (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite5m;

  return (
    (usage.input_tokens * p.input +
      usage.output_tokens * p.output +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
      cacheWriteCost) /
    1_000_000
  );
}

export function shortModelName(model: string): string {
  if (model.includes("opus")) return "opus";
  if (model.includes("sonnet")) return "sonnet";
  if (model.includes("haiku")) return "haiku";
  return model;
}
