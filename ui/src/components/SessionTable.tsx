import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { useState } from "react";
import type { SessionRow } from "@/lib/api";
import { formatCost, formatDuration, formatRelativeTime, shortModel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface SessionTableProps {
  sessions: SessionRow[];
}

export function SessionTable({ sessions }: SessionTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "started_at", desc: true }]);

  const columns = useMemo<ColumnDef<SessionRow>[]>(
    () => [
      {
        accessorKey: "first_prompt",
        header: "Session",
        cell: ({ row }) => {
          const s = row.original;
          return (
            <Link to={`/sessions/${s.id}`} className="block hover:bg-muted -m-2 p-2 rounded">
              <div className="text-sm font-medium text-foreground truncate max-w-md">
                {s.first_prompt || "(no prompt)"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {s.project}
                {s.duration_ms ? ` · ${formatDuration(s.duration_ms)}` : ""}
                {s.subagent_count > 0
                  ? ` · ${s.subagent_count} subagent${s.subagent_count > 1 ? "s" : ""}`
                  : ""}
              </div>
            </Link>
          );
        },
      },
      {
        accessorKey: "estimated_cost_usd",
        header: "API Value",
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div>
              <div className="text-sm font-mono text-blue-600">
                {formatCost(s.estimated_cost_usd)}
              </div>
              <div className="text-xs font-mono text-muted-foreground mt-0.5">
                {shortModel(s.model)}
              </div>
            </div>
          );
        },
        size: 100,
      },
      {
        accessorKey: "tool_call_count",
        header: "Tools",
        cell: ({ getValue }) => (
          <span className="text-sm font-mono text-muted-foreground">{getValue() as number}</span>
        ),
        size: 60,
      },
      {
        accessorKey: "peak_context_pct",
        header: "Context",
        cell: ({ row }) => {
          const s = row.original;
          const pct = s.peak_context_pct;
          if (pct === 0 && s.compaction_count === 0) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          return (
            <div>
              <span
                className={cn(
                  "text-sm font-mono",
                  pct >= 90 ? "text-red-600" : pct >= 80 ? "text-amber-600" : "text-emerald-600",
                )}
              >
                {pct > 0 ? `${pct}%` : "—"}
              </span>
              {s.compaction_count > 0 && (
                <div className="text-xs text-amber-600 mt-0.5">
                  {s.compaction_count} compact{s.compaction_count !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          );
        },
        size: 80,
      },
      {
        accessorKey: "started_at",
        header: "When",
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">
            {formatRelativeTime(getValue() as string | null)}
          </span>
        ),
        size: 120,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: sessions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/50">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="px-4 py-3 text-xs uppercase tracking-wider cursor-pointer select-none hover:bg-muted"
                  onClick={header.column.getToggleSortingHandler()}
                  style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                >
                  <div className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: " \u2191",
                      desc: " \u2193",
                    }[header.column.getIsSorted() as string] ?? ""}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="px-4 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {sessions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No sessions found. Click "Sync Now" to parse your Claude Code data.
        </div>
      )}
    </Card>
  );
}
