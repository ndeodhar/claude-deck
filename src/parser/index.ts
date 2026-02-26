import { readdirSync, statSync, existsSync } from "fs";
import { join, basename } from "path";
import type Database from "better-sqlite3";
import { parseSessionJsonl } from "./session-parser.js";
import { parseSubagentJsonl } from "./subagent-parser.js";
import { upsertSession } from "../db/queries.js";
import { getSessionMtime } from "../db/queries.js";

interface SyncResult {
  parsed: number;
  skipped: number;
  errors: number;
  totalSessions: number;
}

function decodeProjectPath(dirName: string): string {
  // ~/.claude/projects/ directory names are the project path with / replaced by -
  // e.g., "-Users-nehadeodhar-work-gypsum-org-code-polos" → "/Users/nehadeodhar/work/gypsum-org/code/polos"
  // We return the last 2 segments for display
  const parts = dirName.split("-").filter(Boolean);
  const fullPath = "/" + parts.join("/");
  const segments = fullPath.split("/").filter(Boolean);
  return segments.length >= 2 ? segments.slice(-2).join("/") : segments.join("/") || dirName;
}

export async function syncAll(db: Database.Database, claudeDir: string): Promise<SyncResult> {
  const projectsDir = join(claudeDir, "projects");
  if (!existsSync(projectsDir)) {
    return { parsed: 0, skipped: 0, errors: 0, totalSessions: 0 };
  }

  let parsed = 0;
  let skipped = 0;
  let errors = 0;

  const projectDirs = readdirSync(projectsDir, { withFileTypes: true }).filter((d) =>
    d.isDirectory(),
  );

  for (const projectDir of projectDirs) {
    const projectPath = join(projectsDir, projectDir.name);
    const project = decodeProjectPath(projectDir.name);
    const projectHash = projectDir.name;

    // Find JSONL files at depth 1
    let entries;
    try {
      entries = readdirSync(projectPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.name.endsWith(".jsonl")) continue;
      if (!entry.isFile()) continue;

      const jsonlPath = join(projectPath, entry.name);
      const sessionId = basename(entry.name, ".jsonl");

      try {
        const stat = statSync(jsonlPath);
        const mtime = stat.mtime.toISOString();

        // Skip if not modified since last sync
        const existingMtime = getSessionMtime(db, sessionId);
        if (existingMtime === mtime) {
          skipped++;
          continue;
        }

        // Parse session
        const session = await parseSessionJsonl(jsonlPath, sessionId, project, projectHash, mtime);

        // Parse subagents
        const subagentDir = join(projectPath, sessionId, "subagents");
        if (existsSync(subagentDir)) {
          try {
            const subFiles = readdirSync(subagentDir).filter((f) => f.endsWith(".jsonl"));
            for (const subFile of subFiles) {
              const agentId = basename(subFile, ".jsonl");
              try {
                const { subagent, toolCalls: subToolCalls } = await parseSubagentJsonl(
                  join(subagentDir, subFile),
                  agentId,
                  sessionId,
                );
                session.subagents.push(subagent);
                session.toolCalls.push(...subToolCalls);
              } catch {
                // Skip malformed subagent files
              }
            }
          } catch {
            // Skip if can't read subagent dir
          }
        }

        session.subagentCount = session.subagents.length;

        // Store in DB
        upsertSession(db, session);
        parsed++;
      } catch (err) {
        errors++;
        console.error(`Error parsing ${jsonlPath}:`, err);
      }
    }
  }

  const totalRow = db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number };
  return { parsed, skipped, errors, totalSessions: totalRow.count };
}
