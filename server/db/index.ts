import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' }); // Ensure .env is loaded

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

// Ensure the directory for the SQLite file exists if it's a file path
// Note: better-sqlite3 creates the file if it doesn't exist, but not the directory.
// This simple check assumes a file path; adjust if using ':memory:' etc.
if (process.env.DATABASE_URL !== ':memory:') {
  const fs = require('fs');
  const path = require('path');
  const dbPath = path.resolve(process.env.DATABASE_URL);
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created database directory: ${dbDir}`);
  }
}

const sqlite = new Database(process.env.DATABASE_URL);
console.log(`Connected to SQLite database at: ${process.env.DATABASE_URL}`);

// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema, logger: true }); // Enable logger for query debugging

// Export the schema along with the db instance
export * from './schema';
