import { formatTokens } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface TokenSplitProps {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const SEGMENTS: { key: keyof TokenSplitProps; label: string; color: string; textColor: string }[] =
  [
    { key: "input", label: "Input", color: "bg-blue-500", textColor: "text-blue-700" },
    { key: "output", label: "Output", color: "bg-purple-500", textColor: "text-purple-700" },
    { key: "cacheRead", label: "Cache read", color: "bg-cyan-500", textColor: "text-cyan-700" },
    { key: "cacheWrite", label: "Cache write", color: "bg-amber-400", textColor: "text-amber-700" },
  ];

export function TokenSplit({ input, output, cacheRead, cacheWrite }: TokenSplitProps) {
  const values: TokenSplitProps = { input, output, cacheRead, cacheWrite };
  const total = input + output + cacheRead + cacheWrite;
  if (total === 0) return null;

  return (
    <Card className="gap-0 py-4">
      <CardHeader>
        <CardTitle className="text-sm">Token Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stacked bar */}
        <div className="flex h-3 rounded-full overflow-hidden">
          {SEGMENTS.map((s) => {
            const pct = (values[s.key] / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={s.key}
                className={`${s.color} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${s.label}: ${formatTokens(values[s.key])} (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SEGMENTS.map((s) => {
            const val = values[s.key];
            const rawPct = total > 0 ? (val / total) * 100 : 0;
            const pctLabel =
              rawPct === 0 ? "0%" : rawPct < 0.1 ? "<0.1%" : `${Math.round(rawPct)}%`;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-sm shrink-0 ${s.color}`} />
                <div>
                  <div className={`text-sm font-mono font-medium ${s.textColor}`}>
                    {formatTokens(val)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.label} · {pctLabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
