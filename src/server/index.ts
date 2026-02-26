import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type Database from "better-sqlite3";
import { registerSessionRoutes } from "./routes/sessions.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerSyncRoutes } from "./routes/sync.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function startServer(
  db: Database.Database,
  claudeDir: string,
  port: number,
): Promise<string> {
  const app = Fastify({ logger: false });

  await app.register(fastifyCors, { origin: true });

  // API routes
  registerSessionRoutes(app, db);
  registerStatsRoutes(app, db);
  registerSyncRoutes(app, db, claudeDir);

  // Serve dashboard static files
  // In dev: dashboard files are in ../dashboard relative to dist/server/
  // When published: dashboard/ is at package root
  const dashboardPaths = [
    join(__dirname, "..", "..", "dashboard"), // from dist/server/
    join(__dirname, "..", "dashboard"), // fallback
  ];

  let dashboardDir: string | null = null;
  for (const p of dashboardPaths) {
    if (existsSync(p)) {
      dashboardDir = p;
      break;
    }
  }

  if (dashboardDir) {
    await app.register(fastifyStatic, {
      root: dashboardDir,
      prefix: "/",
      wildcard: false,
    });

    // SPA fallback — serve index.html for non-API routes
    app.setNotFoundHandler(async (_req, reply) => {
      return reply.sendFile("index.html", dashboardDir!);
    });
  } else {
    app.get("/", async () => {
      return {
        message: "Claude Deck API is running. Dashboard not found — run 'npm run build:ui' first.",
      };
    });
  }

  const address = await app.listen({ port, host: "0.0.0.0" });
  return address;
}
