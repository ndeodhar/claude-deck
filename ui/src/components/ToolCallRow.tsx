import type { TimelineEntry } from "@/lib/api";
import { BashOutput } from "./BashOutput";
import { DiffView } from "./DiffView";

interface ToolCallRowProps {
  entry: TimelineEntry;
}

export function ToolCallRow({ entry }: ToolCallRowProps) {
  let parsedInput: Record<string, unknown> | null = null;
  let parsedResponse: Record<string, unknown> | null = null;

  try {
    if (entry.tool_input) parsedInput = JSON.parse(entry.tool_input);
  } catch {
    /* ignore */
  }
  try {
    if (entry.tool_response) parsedResponse = JSON.parse(entry.tool_response);
  } catch {
    /* ignore */
  }

  return (
    <div className="mt-2 ml-1 border-l-2 border-border pl-3 pb-2 space-y-2">
      {/* Input */}
      {parsedInput && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Input</div>
          <ToolInput toolName={entry.tool_name ?? ""} input={parsedInput} />
        </div>
      )}

      {/* Response */}
      {parsedResponse && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Output</div>
          <ToolOutput toolName={entry.tool_name ?? ""} response={parsedResponse} />
        </div>
      )}

      {!parsedInput && !parsedResponse && (
        <div className="text-xs text-muted-foreground">No data available</div>
      )}
    </div>
  );
}

function ToolInput({ toolName, input }: { toolName: string; input: Record<string, unknown> }) {
  // Bash: show command
  if (toolName === "Bash" && input.command) {
    return (
      <pre className="text-xs font-mono bg-gray-900 text-gray-100 p-2 rounded overflow-x-auto">
        $ {String(input.command)}
      </pre>
    );
  }

  // Read: show file path
  if (toolName === "Read" && input.file_path) {
    return (
      <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
        {String(input.file_path)}
      </div>
    );
  }

  // Edit: show old/new strings
  if (toolName === "Edit" && input.old_string !== undefined) {
    return (
      <div className="space-y-1">
        <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
          {String(input.file_path ?? "")}
        </div>
        <DiffView oldStr={String(input.old_string ?? "")} newStr={String(input.new_string ?? "")} />
      </div>
    );
  }

  // Generic: show JSON
  return (
    <pre className="text-xs font-mono bg-muted text-foreground p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
      {JSON.stringify(input, null, 2).slice(0, 1000)}
    </pre>
  );
}

function ToolOutput({
  toolName,
  response,
}: {
  toolName: string;
  response: Record<string, unknown>;
}) {
  // Bash: show stdout/stderr
  if (toolName === "Bash" && (response.stdout !== undefined || response.stderr !== undefined)) {
    return (
      <BashOutput
        stdout={String(response.stdout ?? "")}
        stderr={String(response.stderr ?? "")}
        exitCode={response.exitCode as number | undefined}
      />
    );
  }

  // Task (subagent): show summary
  if (toolName === "Task" && response.content) {
    return (
      <div className="text-xs bg-purple-50 text-purple-800 p-2 rounded border border-purple-100">
        <div className="flex gap-3 mb-1 text-purple-600">
          {response.totalDurationMs ? (
            <span>{Math.round(Number(response.totalDurationMs) / 1000)}s</span>
          ) : null}
          {response.totalTokens ? (
            <span>{Number(response.totalTokens).toLocaleString()} tokens</span>
          ) : null}
          {response.totalToolUseCount ? (
            <span>{String(response.totalToolUseCount)} tools</span>
          ) : null}
        </div>
        <div className="whitespace-pre-wrap">{String(response.content).slice(0, 500)}</div>
      </div>
    );
  }

  // Generic
  return (
    <pre className="text-xs font-mono bg-muted text-foreground p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
      {JSON.stringify(response, null, 2).slice(0, 1000)}
    </pre>
  );
}
