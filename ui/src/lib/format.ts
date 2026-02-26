import { formatDistanceToNow, format } from "date-fns";

export function formatCost(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  if (usd < 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatDuration(ms: number | null): string {
  if (!ms) return "-";
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins < 60) return remainSecs > 0 ? `${mins}m ${remainSecs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

export function formatRelativeTime(ts: string | null): string {
  if (!ts) return "-";
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return ts;
  }
}

export function formatTimestamp(ts: string | null): string {
  if (!ts) return "-";
  try {
    return format(new Date(ts), "MMM d, yyyy h:mm a");
  } catch {
    return ts;
  }
}

export function formatTime(ts: string): string {
  try {
    return format(new Date(ts), "h:mm:ss a");
  } catch {
    return ts;
  }
}

export function shortModel(model: string | null): string {
  if (!model) return "-";
  // Extract family + version: "claude-opus-4-6" → "opus 4.6", "claude-haiku-4-5-20251001" → "haiku 4.5"
  const stripped = model.replace(/-\d{8,}$/, ""); // remove date suffix
  const match = stripped.match(/claude-(opus|sonnet|haiku)-(\d+)-(\d+)/);
  if (match) return `${match[1]} ${match[2]}.${match[3]}`;
  if (model.includes("opus")) return "opus";
  if (model.includes("sonnet")) return "sonnet";
  if (model.includes("haiku")) return "haiku";
  return model;
}

export function shortProject(project: string): string {
  const parts = project.split("/").filter(Boolean);
  return parts.slice(-2).join("/") || project;
}
