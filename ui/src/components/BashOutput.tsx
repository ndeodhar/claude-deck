import { cn } from "@/lib/utils";

interface BashOutputProps {
  stdout: string;
  stderr: string;
  exitCode?: number;
}

export function BashOutput({ stdout, stderr, exitCode }: BashOutputProps) {
  const success = exitCode === 0 || exitCode === undefined;

  return (
    <div className="rounded border border-border overflow-hidden">
      {/* Exit code badge */}
      {exitCode !== undefined && (
        <div
          className={cn(
            "text-xs px-2 py-1",
            success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700",
          )}
        >
          exit {exitCode} {success ? "\u2713" : "\u2717"}
        </div>
      )}
      {/* stdout */}
      {stdout && (
        <pre className="text-xs font-mono bg-gray-900 text-gray-100 p-2 overflow-x-auto max-h-48 overflow-y-auto">
          {stdout.slice(0, 2000)}
        </pre>
      )}
      {/* stderr */}
      {stderr && (
        <pre className="text-xs font-mono bg-gray-900 text-red-300 p-2 overflow-x-auto max-h-32 overflow-y-auto border-t border-gray-700">
          {stderr.slice(0, 1000)}
        </pre>
      )}
    </div>
  );
}
