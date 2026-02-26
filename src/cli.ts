#!/usr/bin/env node

import { Command } from "commander";
import { homedir } from "os";
import { join } from "path";
import { getDb, closeDb } from "./db/index.js";
import { syncAll } from "./parser/index.js";
import { startServer } from "./server/index.js";
import { getStats, getSyncStatus } from "./db/queries.js";
import { shortModelName } from "./parser/cost.js";

const DEFAULT_CLAUDE_DIR = join(homedir(), ".claude");
const DEFAULT_DB_PATH = join(homedir(), ".claude-deck", "data.db");

const program = new Command();

program
  .name("claude-deck")
  .description("Observability dashboard for Claude Code")
  .version("0.1.0")
  .option("--claude-dir <path>", "Override ~/.claude directory", DEFAULT_CLAUDE_DIR)
  .option("--db <path>", "Override database path", DEFAULT_DB_PATH)
  .option("--port <number>", "Server port", "7722")
  .option("--no-open", "Don't open browser")
  .action(async (opts) => {
    const db = getDb(opts.db);
    const claudeDir = opts.claudeDir;
    const port = parseInt(opts.port);

    // Sync
    console.log("Syncing Claude Code sessions...");
    const result = await syncAll(db, claudeDir);
    const status = getSyncStatus(db);
    const stats = getStats(db);

    console.log(
      `Synced: ${result.parsed} new, ${result.skipped} unchanged, ${result.errors} errors`,
    );

    // Start server
    const address = await startServer(db, claudeDir, port);
    const url = `http://localhost:${port}`;

    console.log(
      `\nClaude Deck ready at ${url} — ${status.sessionCount} sessions synced ($${stats.totalCost.toFixed(2)} API value)`,
    );

    // Open browser
    if (opts.open !== false) {
      try {
        const open = await import("open");
        await open.default(url);
      } catch {
        console.log(`Open ${url} in your browser.`);
      }
    }

    // Keep process running
    process.on("SIGINT", () => {
      closeDb();
      process.exit(0);
    });
  });

program
  .command("sync")
  .description("Sync JSONL files without starting server")
  .action(async () => {
    const opts = program.opts();
    const db = getDb(opts.db);

    console.log("Syncing Claude Code sessions...");
    const result = await syncAll(db, opts.claudeDir);
    console.log(
      `Done: ${result.parsed} parsed, ${result.skipped} skipped, ${result.errors} errors. Total: ${result.totalSessions} sessions.`,
    );

    closeDb();
  });

program
  .command("stats")
  .description("Print aggregate stats")
  .option("--days <number>", "Last N days", "30")
  .option("--project <name>", "Filter by project name")
  .action(async (cmdOpts) => {
    const opts = program.opts();
    const db = getDb(opts.db);

    // Sync first
    await syncAll(db, opts.claudeDir);

    const days = parseInt(cmdOpts.days);
    const after = new Date(Date.now() - days * 86400000).toISOString();
    const stats = getStats(db, { after });

    console.log(`\nClaude Deck Stats (last ${days} days)`);
    console.log("─".repeat(40));
    console.log(`Sessions:   ${stats.totalSessions}`);
    console.log(`API value:  $${stats.totalCost.toFixed(2)}`);
    console.log(`Avg/session: $${stats.avgCostPerSession.toFixed(2)} (API equivalent)`);
    console.log(`Total tokens: ${(stats.totalTokens / 1_000_000).toFixed(1)}M`);

    if (stats.byModel.length) {
      console.log(`\nBy Model:`);
      for (const m of stats.byModel) {
        console.log(
          `  ${shortModelName(m.model ?? "unknown")}: ${m.sessions} sessions, $${m.cost.toFixed(2)}`,
        );
      }
    }

    if (stats.byProject.length) {
      console.log(`\nBy Project:`);
      for (const p of stats.byProject.slice(0, 10)) {
        console.log(`  ${p.project}: ${p.sessions} sessions, $${p.cost.toFixed(2)}`);
      }
    }

    if (stats.topTools.length) {
      console.log(`\nTop Tools:`);
      for (const t of stats.topTools.slice(0, 10)) {
        console.log(`  ${t.tool}: ${t.count}`);
      }
    }

    closeDb();
  });

program.parse();
