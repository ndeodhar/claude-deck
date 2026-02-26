import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import {
  listSessions,
  getSession,
  getTimeline,
  getSubagents,
  getSessionInsights,
} from "../../db/queries.js";

export function registerSessionRoutes(app: FastifyInstance, db: Database.Database): void {
  app.get("/api/sessions", async (req) => {
    const q = req.query as Record<string, string>;
    return listSessions(db, {
      project: q.project,
      model: q.model,
      after: q.after,
      before: q.before,
      sort: q.sort,
      limit: q.limit ? parseInt(q.limit) : undefined,
      offset: q.offset ? parseInt(q.offset) : undefined,
    });
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id", async (req) => {
    const session = getSession(db, req.params.id);
    if (!session) {
      return { error: "Session not found" };
    }
    return session;
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id/timeline", async (req) => {
    return getTimeline(db, req.params.id);
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id/subagents", async (req) => {
    return getSubagents(db, req.params.id);
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id/insights", async (req) => {
    return getSessionInsights(db, req.params.id);
  });
}
