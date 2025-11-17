// server/db/index.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'node:path'; // Added import

let sqlitePath = process.env.DATABASE_URL;

if (!sqlitePath) {
  // Provide a default path or throw a more specific error
  console.warn('DATABASE_URL not found in runtime config or environment variables. Defaulting to ./db.sqlite');
  // Defaulting might be okay for dev, but consider throwing an error for production
  // throw new Error("DATABASE_URL is not configured in runtimeConfig or environment variables.");
  sqlitePath = './db.sqlite'; // Example default path
}

// --- Added: Test Environment Check ---
if (process.env.NODE_ENV === 'test') {
  // Construct path relative to project root (where process.cwd() usually points)
  sqlitePath = path.join(process.cwd(), 'server', 'tests', 'integration', 'scanner', 'test-db.sqlite');
  console.log(`NODE_ENV is 'test', using test database at: ${sqlitePath}`);
}
// --- End Added Check ---

// Log the path being used for debugging (will show test path when NODE_ENV=test)
console.log(`Connecting to SQLite database at: ${sqlitePath}`);

const sqlite = new Database(sqlitePath);

// Optional: Enable WAL mode for better concurrency
try {
  sqlite.pragma('journal_mode = WAL');
  console.log('SQLite WAL mode enabled.');
} catch (error) {
  console.error('Failed to enable WAL mode:', error);
}

export const db = drizzle(sqlite, { schema, logger: process.env.NODE_ENV === 'development' }); // Enable logger in dev

export { schema }; // Also export the schema if needed elsewhere
