import { useState } from "react";
import type { TimelineEntry } from "@/lib/api";
import { formatTime, formatCost, shortModel } from "@/lib/format";
import { ToolCallRow } from "./ToolCallRow";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TimelineProps {
  entries: TimelineEntry[];
}

export function Timeline({ entries }: TimelineProps) {
  if (entries.length === 0) {
    return <div className="text-muted-foreground text-sm py-8 text-center">No timeline data.</div>;
  }

  return (
    <div className="relative">
      {/* Vertical timeline rail */}
      <div className="absolute left-[72px] top-0 bottom-0 w-px bg-border" />

      <div className="space-y-1">
        {entries.map((entry) => (
          <TimelineItem key={`${entry._type}-${entry.id}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function TimelineItem({ entry }: { entry: TimelineEntry }) {
  if (entry._type === "message") {
    return <MessageItem entry={entry} />;
  }
  return <ToolCallItem entry={entry} />;
}

function MessageItem({ entry }: { entry: TimelineEntry }) {
  const isUser = entry.role === "user";
  return (
    <div className="flex items-start gap-3 py-2 pl-2">
      <span className="text-xs font-mono text-muted-foreground w-[60px] text-right shrink-0 pt-0.5">
        {formatTime(entry.timestamp)}
      </span>
      <div className="relative z-10 mt-1">
        <div
          className={cn("w-2 h-2 rounded-full", isUser ? "bg-green-500" : "bg-muted-foreground")}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={cn(
              "text-xs font-medium",
              isUser ? "text-green-700" : "text-muted-foreground",
            )}
          >
            {isUser ? "User" : "Assistant"}
          </span>
          {!isUser && entry.model && (
            <Badge variant="secondary" className="text-[10px] font-mono px-1 py-0">
              {shortModel(entry.model)}
            </Badge>
          )}
          {!isUser && entry.cost_usd != null && entry.cost_usd > 0 && (
            <span className="text-[10px] font-mono text-blue-600">
              {formatCost(entry.cost_usd)}
            </span>
          )}
        </div>
        <div className="text-sm text-foreground whitespace-pre-wrap break-words max-w-2xl">
          {(entry.content ?? "").slice(0, 500)}
          {(entry.content ?? "").length > 500 && (
            <span className="text-muted-foreground"> ...</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolCallItem({ entry }: { entry: TimelineEntry }) {
  const [expanded, setExpanded] = useState(false);
  const isSubagent = entry.tool_name === "Task";

  return (
    <div className="flex items-start gap-3 py-1 pl-2">
      <span className="text-xs font-mono text-muted-foreground w-[60px] text-right shrink-0 pt-0.5">
        {formatTime(entry.timestamp)}
      </span>
      <div className="relative z-10 mt-1.5">
        <div
          className={cn("w-1.5 h-1.5 rounded-full", isSubagent ? "bg-purple-500" : "bg-blue-500")}
        />
      </div>
      <div className="flex-1 min-w-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm hover:bg-muted -ml-1 px-1 py-0.5 rounded w-full text-left"
        >
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              entry.subagent_id ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700",
            )}
          >
            {entry.tool_name}
          </Badge>
          <ToolCallSummary entry={entry} />
          <span className="text-muted-foreground text-xs ml-auto">
            {expanded ? "\u25BC" : "\u25B6"}
          </span>
        </button>
        {expanded && <ToolCallRow entry={entry} />}
      </div>
    </div>
  );
}

function ToolCallSummary({ entry }: { entry: TimelineEntry }) {
  if (!entry.tool_input) return null;

  try {
    const input = JSON.parse(entry.tool_input);

    // Read/Write: show file path
    if (input.file_path) {
      return <span className="text-xs text-muted-foreground truncate">{input.file_path}</span>;
    }
    // Bash: show command
    if (input.command) {
      return (
        <span className="text-xs text-muted-foreground font-mono truncate max-w-xs">
          {input.command.slice(0, 80)}
        </span>
      );
    }
    // Edit: show file
    if (input.filePath) {
      return <span className="text-xs text-muted-foreground truncate">{input.filePath}</span>;
    }
    // Glob/Grep: show pattern
    if (input.pattern) {
      return (
        <span className="text-xs text-muted-foreground font-mono truncate">{input.pattern}</span>
      );
    }
    // Task: show description or subagent_type
    if (input.description) {
      return <span className="text-xs text-muted-foreground truncate">{input.description}</span>;
    }
  } catch {
    // ignore
  }

  return null;
}
