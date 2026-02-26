import { useEffect, useState, useMemo } from "react";
import {
  fetchSessions,
  triggerSync,
  fetchSyncStatus,
  type SessionRow,
  type SyncStatus,
} from "@/lib/api";
import { SummaryCards } from "@/components/SummaryCards";
import { SessionTable } from "@/components/SessionTable";
import { formatRelativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export function SessionsPage() {
  const [allSessions, setAllSessions] = useState<SessionRow[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [project, setProject] = useState("");
  const [model, setModel] = useState("");

  const load = async () => {
    try {
      const [sessionsRes, statusRes] = await Promise.all([
        fetchSessions({ limit: "500", sort: "date" }),
        fetchSyncStatus(),
      ]);
      setAllSessions(sessionsRes.sessions);
      setSyncStatus(statusRes);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sessions = useMemo(() => {
    return allSessions.filter((s) => {
      if (project && s.project !== project) return false;
      if (model && s.model !== model) return false;
      return true;
    });
  }, [allSessions, project, model]);

  const summaryStats = useMemo(() => {
    const totalCost = sessions.reduce((sum, s) => sum + s.estimated_cost_usd, 0);
    const totalTokens = sessions.reduce(
      (sum, s) =>
        sum + s.input_tokens + s.output_tokens + s.cache_read_tokens + s.cache_create_tokens,
      0,
    );
    const sessionCount = sessions.length;
    const avgCostPerSession = sessionCount > 0 ? totalCost / sessionCount : 0;
    return { totalCost, totalTokens, sessionCount, avgCostPerSession };
  }, [sessions]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      await load();
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Get unique projects and models for filters (from all sessions, not filtered)
  const projects = useMemo(
    () => [...new Set(allSessions.map((s) => s.project))].sort(),
    [allSessions],
  );
  const models = useMemo(
    () => [...new Set(allSessions.map((s) => s.model).filter(Boolean))].sort(),
    [allSessions],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading sessions...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <SummaryCards
        totalCost={summaryStats.totalCost}
        totalTokens={summaryStats.totalTokens}
        sessionCount={summaryStats.sessionCount}
        avgCostPerSession={summaryStats.avgCostPerSession}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={project} onValueChange={(v) => setProject(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={model} onValueChange={(v) => setModel(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Models" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Models</SelectItem>
            {models.map((m) => (
              <SelectItem key={m} value={m!}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {syncStatus?.lastSyncedAt
              ? `Last synced ${formatRelativeTime(syncStatus.lastSyncedAt)}`
              : "Not synced yet"}
          </span>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </div>

      {/* Sessions table */}
      <SessionTable sessions={sessions} />
    </div>
  );
}
