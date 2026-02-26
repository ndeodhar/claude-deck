import { useState, useMemo } from "react";
import type { SubagentRow, TimelineEntry } from "@/lib/api";
import { formatCost, formatDuration, formatTokens, shortModel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SubagentBlockProps {
  subagents: SubagentRow[];
  timeline: TimelineEntry[];
}

export function SubagentBlock({ subagents, timeline }: SubagentBlockProps) {
  if (subagents.length === 0) {
    return <div className="text-muted-foreground text-sm py-4 text-center">No subagents.</div>;
  }

  // Build per-subagent tool breakdown from timeline
  const toolBreakdowns = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const entry of timeline) {
      if (entry._type === "tool_call" && entry.subagent_id && entry.tool_name) {
        const tools = map.get(entry.subagent_id) ?? new Map<string, number>();
        tools.set(entry.tool_name, (tools.get(entry.tool_name) ?? 0) + 1);
        map.set(entry.subagent_id, tools);
      }
    }
    return map;
  }, [timeline]);

  return (
    <div className="space-y-2">
      {subagents.map((sub) => (
        <SubagentRow key={sub.id} subagent={sub} toolBreakdown={toolBreakdowns.get(sub.id)} />
      ))}
    </div>
  );
}

function SubagentRow({
  subagent: sub,
  toolBreakdown,
}: {
  subagent: SubagentRow;
  toolBreakdown?: Map<string, number>;
}) {
  const [expanded, setExpanded] = useState(false);

  const toolList = useMemo(() => {
    if (!toolBreakdown) return [];
    return [...toolBreakdown.entries()].sort((a, b) => b[1] - a[1]);
  }, [toolBreakdown]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Collapsed summary row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Badge className="bg-purple-100 text-purple-700 border-transparent shrink-0">
            {sub.agent_type ?? "agent"}
          </Badge>
          {sub.model && (
            <Badge variant="secondary" className="font-mono shrink-0">
              {shortModel(sub.model)}
            </Badge>
          )}
          <span className="text-sm text-foreground truncate min-w-0 flex-1">
            {sub.prompt?.slice(0, 100) || "(no prompt)"}
          </span>
          <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
            <span className="font-mono text-blue-600">{formatCost(sub.estimated_cost_usd)}</span>
            <span>{sub.tool_call_count} tools</span>
            {sub.duration_ms != null && <span>{formatDuration(sub.duration_ms)}</span>}
            <span className="text-muted-foreground">{expanded ? "\u25BC" : "\u25B6"}</span>
          </div>
        </div>

        {/* Tool pills */}
        {toolList.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {toolList.map(([tool, count]) => (
              <span
                key={tool}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
              >
                {tool} {count}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/30">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MiniStat
              label="API value"
              value={formatCost(sub.estimated_cost_usd)}
              color="text-blue-600"
            />
            <MiniStat
              label="model"
              value={shortModel(sub.model)}
              color="text-foreground"
            />
            <MiniStat
              label="tokens"
              value={formatTokens(
                sub.input_tokens +
                  sub.output_tokens +
                  sub.cache_read_tokens +
                  sub.cache_create_tokens,
              )}
              color="text-purple-600"
            />
            <MiniStat label="tools" value={sub.tool_call_count.toString()} color="text-cyan-600" />
            <MiniStat
              label="duration"
              value={sub.duration_ms != null ? formatDuration(sub.duration_ms) : "—"}
              color="text-amber-600"
            />
          </div>

          {/* Prompt */}
          {sub.prompt && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Task</div>
              <div className="text-sm text-foreground whitespace-pre-wrap break-words">
                {sub.prompt}
              </div>
            </div>
          )}

          {/* Result */}
          {sub.result_summary && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Result</div>
              <div className="text-sm text-foreground whitespace-pre-wrap break-words bg-muted p-3 rounded">
                {sub.result_summary}
              </div>
            </div>
          )}

          {/* Token split */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Token breakdown</div>
            <div className="flex gap-4 text-xs font-mono text-muted-foreground">
              <span>input: {formatTokens(sub.input_tokens)}</span>
              <span>output: {formatTokens(sub.output_tokens)}</span>
              <span>cache read: {formatTokens(sub.cache_read_tokens)}</span>
              <span>cache write: {formatTokens(sub.cache_create_tokens)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-background rounded px-3 py-2 border border-border">
      <div className={cn("text-sm font-semibold font-mono", color)}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
