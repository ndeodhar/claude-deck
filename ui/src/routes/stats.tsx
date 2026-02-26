import { useEffect, useState } from "react";
import { fetchStats, type StatsResponse } from "@/lib/api";
import { SummaryCards } from "@/components/SummaryCards";
import { TokenSplit } from "@/components/TokenSplit";
import { TokenChart } from "@/components/CostChart";
import { BreakdownChart, RankedList } from "@/components/BreakdownChart";
import { shortModel, formatTokens } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type Period = "7d" | "30d" | "all";

function getAfterDate(period: Period): string | undefined {
  if (period === "all") return undefined;
  const days = period === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 86400000).toISOString();
}

export function StatsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [allStats, setAllStats] = useState<StatsResponse | null>(null);
  const [period, setPeriod] = useState<Period>("30d");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch unfiltered stats once to get model list
  useEffect(() => {
    fetchStats({}).then(setAllStats).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    const after = getAfterDate(period);
    if (after) params.after = after;
    if (model) params.model = model;

    fetchStats(params)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period, model]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading stats...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
        <div className="flex items-center gap-3">
          <Select value={model} onValueChange={(v) => setModel(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Models" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Models</SelectItem>
              {(allStats?.byModel ?? []).map((m) => (
                <SelectItem key={m.model} value={m.model}>
                  {shortModel(m.model)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Summary cards */}
      <SummaryCards
        totalCost={stats.totalCost}
        totalTokens={stats.totalTokens}
        sessionCount={stats.totalSessions}
        avgCostPerSession={stats.avgCostPerSession}
      />

      {/* Token split */}
      <TokenSplit
        input={stats.inputTokens}
        output={stats.outputTokens}
        cacheRead={stats.cacheReadTokens}
        cacheWrite={stats.cacheCreateTokens}
      />

      {/* Tokens over time */}
      <TokenChart
        data={stats.byDay.map((d) => ({
          date: d.date,
          tokens: d.tokens,
          sessions: d.sessions,
        }))}
      />

      {/* Breakdowns */}
      <div className="grid md:grid-cols-2 gap-4">
        <BreakdownChart
          title="Tokens by Model"
          data={stats.byModel.map((m) => ({
            name: shortModel(m.model),
            value: m.tokens,
          }))}
          color="#8b5cf6"
          valuePrefix=""
          formatValue={formatTokens}
        />
        <BreakdownChart
          title="Tokens by Project"
          data={stats.byProject.slice(0, 8).map((p) => ({
            name: p.project,
            value: p.tokens,
          }))}
          color="#06b6d4"
          valuePrefix=""
          formatValue={formatTokens}
        />
      </div>

      {/* Top tools */}
      <div className="grid md:grid-cols-2 gap-4">
        <RankedList
          title="Top Tools"
          items={stats.topTools.map((t) => ({
            label: t.tool,
            value: t.count.toLocaleString(),
          }))}
        />
      </div>
    </div>
  );
}
