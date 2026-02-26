import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { syncAll } from "../../parser/index.js";
import { getSyncStatus } from "../../db/queries.js";

export function registerSyncRoutes(
  app: FastifyInstance,
  db: Database.Database,
  claudeDir: string,
): void {
  app.post("/api/sync", async () => {
    const result = await syncAll(db, claudeDir);
    return result;
  });

  app.get("/api/sync/status", async () => {
    return getSyncStatus(db);
  });
}
