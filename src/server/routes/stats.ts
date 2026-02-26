import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { getStats } from "../../db/queries.js";

export function registerStatsRoutes(app: FastifyInstance, db: Database.Database): void {
  app.get("/api/stats", async (req) => {
    const q = req.query as Record<string, string>;
    return getStats(db, {
      after: q.after,
      before: q.before,
      model: q.model,
    });
  });
}
