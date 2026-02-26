import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchSession,
  fetchTimeline,
  fetchSubagents,
  fetchInsights,
  type SessionRow,
  type TimelineEntry,
  type SubagentRow,
  type SessionInsights,
} from "@/lib/api";
import { Timeline } from "@/components/Timeline";
import { SubagentBlock } from "@/components/SubagentBlock";
import { Insights } from "@/components/Insights";
import { TokenSplit } from "@/components/TokenSplit";
import {
  formatCost,
  formatTokens,
  formatDuration,
  formatTimestamp,
  shortModel,
} from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [subagents, setSubagents] = useState<SubagentRow[]>([]);
  const [insights, setInsights] = useState<SessionInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchSession(id), fetchTimeline(id), fetchSubagents(id), fetchInsights(id)])
      .then(([s, t, sub, ins]) => {
        setSession(s);
        setTimeline(t);
        setSubagents(sub);
        setInsights(ins);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading session...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20">
        <div className="text-muted-foreground">Session not found</div>
        <Link to="/sessions" className="text-primary text-sm mt-2 inline-block">
          Back to sessions
        </Link>
      </div>
    );
  }

  const totalTokens =
    session.input_tokens +
    session.output_tokens +
    session.cache_read_tokens +
    session.cache_create_tokens;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/sessions"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        &larr; Sessions
      </Link>

      {/* Title */}
      <div>
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          User prompt
        </div>
        <div className="text-sm text-foreground mt-1 line-clamp-2">
          {session.first_prompt || "(no prompt)"}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {formatTimestamp(session.started_at)}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="API value"
          value={formatCost(session.estimated_cost_usd)}
          color="text-blue-600"
        />
        <MetricCard label="model" value={shortModel(session.model)} />
        <MetricCard label="tokens" value={formatTokens(totalTokens)} color="text-purple-600" />
        <MetricCard
          label="tools"
          value={session.tool_call_count.toString()}
          color="text-cyan-600"
        />
        <MetricCard
          label="duration"
          value={formatDuration(session.duration_ms)}
          color="text-amber-600"
        />
        <MetricCard
          label="context fill"
          value={session.peak_context_pct > 0 ? `${session.peak_context_pct}%` : "—"}
          color={
            session.peak_context_pct >= 90
              ? "text-red-600"
              : session.peak_context_pct >= 80
                ? "text-amber-600"
                : "text-emerald-600"
          }
        />
        <MetricCard
          label="subagents"
          value={session.subagent_count.toString()}
          color="text-rose-600"
        />
        <MetricCard
          label="compactions"
          value={session.compaction_count.toString()}
          color={session.compaction_count > 0 ? "text-amber-600" : "text-muted-foreground"}
        />
      </div>

      {/* Token split */}
      <TokenSplit
        input={session.input_tokens}
        output={session.output_tokens}
        cacheRead={session.cache_read_tokens}
        cacheWrite={session.cache_create_tokens}
      />

      {/* Tabs */}
      <Tabs defaultValue="insights">
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="subagents">Subagents ({session.subagent_count})</TabsTrigger>
        </TabsList>

        <TabsContent value="insights">
          {insights ? <Insights insights={insights} timeline={timeline} /> : null}
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="gap-0 py-4">
            <CardContent>
              <Timeline entries={timeline} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subagents">
          <Card className="gap-0 py-4">
            <CardContent>
              <SubagentBlock subagents={subagents} timeline={timeline} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card className="gap-0 py-3">
      <CardContent>
        <div className={cn("text-xl font-semibold font-mono", color ?? "text-foreground")}>
          {value}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}
