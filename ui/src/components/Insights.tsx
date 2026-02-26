import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { SessionInsights, TimelineEntry, CompactionInfo } from "@/lib/api";
import { formatCost, formatTime, formatTokens } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface InsightsProps {
  insights: SessionInsights;
  timeline: TimelineEntry[];
}

const CATEGORY_COLORS: Record<string, string> = {
  explore: "#3b82f6", // blue
  research: "#f59e0b", // amber
  write: "#10b981", // emerald
  execute: "#8b5cf6", // purple
  other: "#06b6d4", // cyan
};

const CATEGORY_LABELS: Record<string, string> = {
  explore: "Exploration",
  research: "Research",
  write: "Writing",
  execute: "Execution",
  other: "Other",
};

const CATEGORY_BADGE: Record<string, string> = {
  explore: "bg-blue-100 text-blue-800",
  research: "bg-amber-100 text-amber-800",
  write: "bg-emerald-100 text-emerald-800",
  execute: "bg-purple-100 text-purple-800",
  other: "bg-cyan-100 text-cyan-800",
};

const TOOL_TO_CATEGORY: Record<string, string> = {
  Read: "explore",
  Glob: "explore",
  Grep: "explore",
  WebFetch: "research",
  WebSearch: "research",
  Write: "write",
  Edit: "write",
  NotebookEdit: "write",
  Bash: "execute",
};

function getToolCategory(toolName: string): string {
  return TOOL_TO_CATEGORY[toolName] ?? "other";
}

/** Walk the timeline and attribute each assistant message's cost to the tool
 *  call categories that follow it (proportional by count within the turn). */
function computeCostByCategory(timeline: TimelineEntry[]): Map<string, number> {
  const costByCategory = new Map<string, number>();

  let turnCost = 0;
  let turnTools: string[] = []; // category per tool call in the current turn

  const flush = () => {
    if (turnCost > 0 && turnTools.length > 0) {
      const share = turnCost / turnTools.length;
      for (const cat of turnTools) {
        costByCategory.set(cat, (costByCategory.get(cat) ?? 0) + share);
      }
    }
    turnCost = 0;
    turnTools = [];
  };

  for (const entry of timeline) {
    if (entry._type === "message" && entry.role === "assistant") {
      // New assistant turn — flush the previous one
      flush();
      turnCost = entry.cost_usd ?? 0;
    } else if (entry._type === "tool_call" && entry.tool_name) {
      turnTools.push(getToolCategory(entry.tool_name));
    }
  }
  flush(); // last turn

  return costByCategory;
}

function shortenPath(path: string, maxLen = 60): string {
  if (path.length <= maxLen) return path;
  const parts = path.split("/");
  let result = parts[parts.length - 1];
  for (let i = parts.length - 2; i >= 0; i--) {
    const candidate = parts[i] + "/" + result;
    if (candidate.length + 4 > maxLen) {
      return ".../" + result;
    }
    result = candidate;
  }
  return result;
}

export function Insights({ insights, timeline }: InsightsProps) {
  return (
    <div className="space-y-6">
      <PhaseBreakdown
        phases={insights.phases}
        totalTools={insights.totalToolCalls}
        timeline={timeline}
      />
      {insights.compaction.count > 0 && <CompactionDetails compaction={insights.compaction} />}
      <FileReadPatterns fileReads={insights.fileReads} />
      {insights.webFetches.total > 0 && <WebFetchDetails stats={insights.webFetches} />}
      <ToolDistribution tools={insights.toolDistribution} />
    </div>
  );
}

// --- Activity Breakdown with Pie Chart + Expandable Details ---

function PhaseBreakdown({
  phases,
  totalTools,
  timeline,
}: {
  phases: SessionInsights["phases"];
  totalTools: number;
  timeline: TimelineEntry[];
}) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const costByCategory = computeCostByCategory(timeline);

  const activePhasesData = phases
    .filter((p) => p.toolCount > 0)
    .map((p) => ({
      name: p.name,
      category: p.category,
      value: p.toolCount,
      durationMs: p.durationMs,
      cost: costByCategory.get(p.category) ?? 0,
    }))
    .sort((a, b) => b.value - a.value);

  if (activePhasesData.length === 0) return null;

  const toolCallsByCategory = new Map<string, TimelineEntry[]>();
  for (const entry of timeline) {
    if (entry._type !== "tool_call" || !entry.tool_name) continue;
    const cat = getToolCategory(entry.tool_name);
    const arr = toolCallsByCategory.get(cat) ?? [];
    arr.push(entry);
    toolCallsByCategory.set(cat, arr);
  }

  return (
    <Card className="gap-0 py-4">
      <CardHeader>
        <CardTitle className="text-sm">Activity Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          {/* Pie chart */}
          <div className="w-48 h-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activePhasesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={72}
                  dataKey="value"
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {activePhasesData.map((entry) => (
                    <Cell
                      key={entry.category}
                      fill={CATEGORY_COLORS[entry.category]}
                      cursor="pointer"
                      onClick={() =>
                        setExpandedCategory(
                          expandedCategory === entry.category ? null : entry.category,
                        )
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(
                    value: number,
                    name: string,
                    props: { payload?: { cost?: number } },
                  ) => {
                    const cost = props.payload?.cost;
                    const label = `${value} tools (${Math.round((value / totalTools) * 100)}%)${cost && cost > 0 ? ` · ${formatCost(cost)}` : ""}`;
                    return [label, name];
                  }}
                  contentStyle={{
                    backgroundColor: "oklch(1 0 0)",
                    border: "1px solid oklch(0.922 0 0)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend — clickable */}
          <div className="flex-1 space-y-2">
            {activePhasesData.map((p) => {
              const isExpanded = expandedCategory === p.category;
              const pct = Math.round((p.value / totalTools) * 100);
              return (
                <button
                  key={p.category}
                  onClick={() => setExpandedCategory(isExpanded ? null : p.category)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md transition-colors",
                    isExpanded ? "bg-muted ring-1 ring-border" : "hover:bg-muted",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[p.category] }}
                    />
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto font-mono">
                      {p.value} tools · {pct}%{p.cost > 0 ? ` · ${formatCost(p.cost)}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {isExpanded ? "\u25BC" : "\u25B6"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground ml-5 mt-0.5">
                    {getCategoryToolNames(p.category)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Expanded category detail */}
        {expandedCategory && (
          <CategoryDetail
            category={expandedCategory}
            toolCalls={toolCallsByCategory.get(expandedCategory) ?? []}
          />
        )}
      </CardContent>
    </Card>
  );
}

function getCategoryToolNames(category: string): string {
  const tools: Record<string, string[]> = {
    explore: ["Read", "Glob", "Grep"],
    research: ["WebFetch", "WebSearch"],
    write: ["Edit", "Write", "NotebookEdit"],
    execute: ["Bash"],
    other: ["Task", "TaskCreate", "TaskUpdate", "AskUserQuestion", "..."],
  };
  return (tools[category] ?? []).join(", ");
}

function CategoryDetail({ category, toolCalls }: { category: string; toolCalls: TimelineEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  const display = showAll ? toolCalls : toolCalls.slice(0, 15);

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        {CATEGORY_LABELS[category]} — {toolCalls.length} tool calls
      </div>
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {display.map((tc, i) => (
          <CategoryToolRow key={`${tc.id}-${i}`} entry={tc} />
        ))}
      </div>
      {toolCalls.length > 15 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-primary mt-2 hover:underline"
        >
          Show all {toolCalls.length} calls
        </button>
      )}
    </div>
  );
}

function CategoryToolRow({ entry }: { entry: TimelineEntry }) {
  let summary = "";
  try {
    if (entry.tool_input) {
      const input = JSON.parse(entry.tool_input);
      if (input.file_path) summary = input.file_path;
      else if (input.command) summary = input.command.slice(0, 100);
      else if (input.pattern) summary = input.pattern;
      else if (input.url) summary = input.url;
      else if (input.query) summary = input.query;
      else if (input.description) summary = input.description;
    }
  } catch {
    /* skip */
  }

  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      <span className="font-mono text-muted-foreground w-[72px] shrink-0 text-right">
        {formatTime(entry.timestamp)}
      </span>
      <span className="font-medium text-foreground w-16 shrink-0">{entry.tool_name}</span>
      <span className="text-muted-foreground font-mono truncate">{summary}</span>
    </div>
  );
}

// --- Context Compactions ---

const CONTEXT_WINDOW = 200_000;

function CompactionDetails({ compaction }: { compaction: CompactionInfo }) {
  const avgPreTokens =
    compaction.compactions.reduce((sum, c) => sum + c.preTokens, 0) / compaction.count;
  const avgPct = Math.round((avgPreTokens / CONTEXT_WINDOW) * 100);

  return (
    <Card className="gap-0 py-4">
      <CardHeader>
        <CardTitle className="text-sm">Context Compactions</CardTitle>
        <CardDescription>
          Compacted {compaction.count} time{compaction.count !== 1 ? "s" : ""} · avg{" "}
          {formatTokens(Math.round(avgPreTokens))} tokens ({avgPct}% of 200K context) before each
          compaction
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {compaction.compactions.map((c, i) => {
          const pct = Math.round((c.preTokens / CONTEXT_WINDOW) * 100);
          return (
            <div key={i} className="py-1.5 px-2 rounded bg-muted">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-mono text-muted-foreground w-[72px] shrink-0 text-right">
                  {formatTime(c.timestamp)}
                </span>
                <span
                  className={cn(
                    "font-medium font-mono",
                    pct >= 90 ? "text-red-600" : pct >= 85 ? "text-amber-600" : "text-foreground",
                  )}
                >
                  {formatTokens(c.preTokens)} tokens
                </span>
                <span className="text-muted-foreground font-mono">{pct}% full</span>
                <span className="text-muted-foreground">{c.trigger}</span>
              </div>
              {/* Context usage bar */}
              <div className="ml-[84px] mt-1 bg-muted rounded-full h-1.5 overflow-hidden border border-border">
                <div
                  className={cn(
                    "h-full rounded-full",
                    pct >= 90 ? "bg-red-400" : pct >= 85 ? "bg-amber-400" : "bg-blue-400",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// --- File Read Patterns ---

function FileReadPatterns({ fileReads }: { fileReads: SessionInsights["fileReads"] }) {
  const [showAll, setShowAll] = useState(false);

  if (fileReads.length === 0) {
    return (
      <Card className="gap-0 py-4">
        <CardHeader>
          <CardTitle className="text-sm">File Read Patterns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">No repeated file reads detected.</div>
        </CardContent>
      </Card>
    );
  }

  const display = showAll ? fileReads : fileReads.slice(0, 5);

  return (
    <Card className="gap-0 py-4">
      <CardHeader>
        <CardTitle className="text-sm">Repeated File Reads</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {display.map((f) => (
          <div key={f.file} className="flex items-center justify-between text-sm">
            <span className="font-mono text-xs text-foreground max-w-md truncate" title={f.file}>
              {shortenPath(f.file)}
            </span>
            <Badge
              variant="secondary"
              className={cn(
                "font-mono",
                f.count >= 4
                  ? "bg-red-100 text-red-700"
                  : f.count >= 3
                    ? "bg-amber-100 text-amber-700"
                    : "",
              )}
            >
              {f.count}x
            </Badge>
          </div>
        ))}
        {fileReads.length > 5 && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-primary hover:underline mt-1"
          >
            See all {fileReads.length} files
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// --- Web Fetch Details ---

function WebFetchDetails({ stats }: { stats: SessionInsights["webFetches"] }) {
  return (
    <Card className="gap-0 py-4">
      <CardHeader>
        <CardTitle className="text-sm">Web Fetches</CardTitle>
        <CardDescription>
          {stats.total} requests · {stats.errors} failed · {Math.round(stats.successRate * 100)}%
          success
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {stats.details.map((d, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-2 text-xs py-1.5 px-2 rounded",
              d.isError ? "bg-red-50" : "bg-muted",
            )}
          >
            <span className="font-mono text-muted-foreground w-[72px] shrink-0 text-right pt-0.5">
              {formatTime(d.timestamp)}
            </span>
            <span
              className={cn(
                "w-12 shrink-0 font-medium",
                d.isError ? "text-red-600" : "text-green-600",
              )}
            >
              {d.isError ? "FAIL" : "OK"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-foreground truncate">{d.url}</div>
              {d.isError && d.errorDetail && (
                <div className="text-red-600 mt-0.5">{d.errorDetail}</div>
              )}
            </div>
            <span className="text-muted-foreground shrink-0">{d.tool}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// --- Tool Distribution ---

function ToolDistribution({ tools }: { tools: SessionInsights["toolDistribution"] }) {
  if (tools.length === 0) return null;

  const max = tools[0]?.count ?? 1;

  return (
    <Card className="gap-0 py-4">
      <CardHeader>
        <CardTitle className="text-sm">Tool Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {tools.map((t) => {
          const cat = getToolCategory(t.tool);
          return (
            <div key={t.tool} className="flex items-center gap-2">
              <span className="text-xs text-foreground w-24 shrink-0">{t.tool}</span>
              <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(t.count / max) * 100}%`,
                    backgroundColor: CATEGORY_COLORS[cat],
                  }}
                />
              </div>
              <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                {t.count}
              </span>
              <Badge
                variant="secondary"
                className={cn("text-[10px] shrink-0", CATEGORY_BADGE[cat])}
              >
                {CATEGORY_LABELS[cat]}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
