import "dotenv/config";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const databasePath = resolve(process.env.DATABASE_URL || "./db.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });
const sqlite = new Database(databasePath);
try {
  migrate(drizzle(sqlite), {
    migrationsFolder: resolve("server/db/migrations"),
  });
  console.log(`Database migrations applied: ${databasePath}`);
} finally {
  sqlite.close();
}
