import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCost } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface BreakdownChartProps {
  title: string;
  data: { name: string; value: number }[];
  color?: string;
  valuePrefix?: string;
  formatValue?: (v: number) => string;
}

export function BreakdownChart({
  title,
  data,
  color = "#3b82f6",
  valuePrefix = "$",
  formatValue,
}: BreakdownChartProps) {
  if (data.length === 0) {
    return null;
  }

  return (
    <Card className="gap-0 py-4">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(120, data.length * 32)}>
          <BarChart data={data} layout="vertical" margin={{ left: 0 }}>
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "oklch(0.556 0 0)" }}
              tickFormatter={(v: number) =>
                formatValue ? formatValue(v) : valuePrefix === "$" ? `$${v.toFixed(0)}` : v.toString()
              }
            />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fontSize: 11, fill: "oklch(0.145 0 0)" }}
            />
            <Tooltip
              formatter={(value: number) => [
                formatValue ? formatValue(value) : valuePrefix === "$" ? formatCost(value) : value.toLocaleString(),
                title,
              ]}
              contentStyle={{
                backgroundColor: "oklch(1 0 0)",
                border: "1px solid oklch(0.922 0 0)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface RankedListProps {
  title: string;
  items: { label: string; value: string | number }[];
}

export function RankedList({ title, items }: RankedListProps) {
  if (items.length === 0) return null;

  return (
    <Card className="gap-0 py-4">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-foreground">{item.label}</span>
            <span className="font-mono text-muted-foreground">{item.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
