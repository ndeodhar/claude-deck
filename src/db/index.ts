import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { SCHEMA } from "./schema.js";

let db: Database.Database | null = null;

export function getDb(dbPath: string): Database.Database {
  if (db) return db;

  mkdirSync(dirname(dbPath), { recursive: true });
  db = new Database(dbPath);

  // Execute schema — each statement separately
  for (const stmt of SCHEMA.split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    db.exec(stmt);
  }

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
