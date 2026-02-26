import { formatCost, formatTokens } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  totalCost: number;
  totalTokens: number;
  sessionCount: number;
  avgCostPerSession: number;
}

function MetricCard({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  color?: string;
  tooltip?: string;
}) {
  return (
    <Card className="gap-0 py-4" title={tooltip}>
      <CardContent>
        <div className={cn("text-2xl font-semibold font-mono", color ?? "text-foreground")}>
          {value}
        </div>
        <div className="text-sm text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({
  totalCost,
  totalTokens,
  sessionCount,
  avgCostPerSession,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard
        label="API value"
        value={formatCost(totalCost)}
        color="text-blue-600"
        tooltip="Equivalent cost at API per-token rates"
      />
      <MetricCard label="tokens" value={formatTokens(totalTokens)} color="text-purple-600" />
      <MetricCard label="sessions" value={sessionCount.toString()} color="text-cyan-600" />
      <MetricCard
        label="avg / session"
        value={formatCost(avgCostPerSession)}
        color="text-emerald-600"
        tooltip="API-equivalent cost per session"
      />
    </div>
  );
}
