import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatTokens } from "@/lib/format";

interface TokenChartProps {
  data: { date: string; tokens: number; sessions: number }[];
}

export function TokenChart({ data }: TokenChartProps) {
  if (data.length === 0) {
    return <div className="text-muted-foreground text-sm py-8 text-center">No data.</div>;
  }

  return (
    <Card className="gap-0 py-4">
      <CardHeader>
        <CardTitle className="text-sm">Tokens over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.922 0 0)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "oklch(0.556 0 0)" }}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "oklch(0.556 0 0)" }}
              tickFormatter={(v: number) => formatTokens(v)}
            />
            <Tooltip
              formatter={(value: number) => [formatTokens(value), "Tokens"]}
              labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
              contentStyle={{
                backgroundColor: "oklch(1 0 0)",
                border: "1px solid oklch(0.922 0 0)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="tokens" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
