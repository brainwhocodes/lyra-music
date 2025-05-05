// server/db/index.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { useRuntimeConfig } from '#imports'; // Use Nuxt's runtime config

// Get the database path from runtime configuration (e.g., defined in nuxt.config.ts or .env)
const config = useRuntimeConfig();
// Ensure DATABASE_URL is defined in your .env or nuxt.config.ts runtimeConfig
// You might need to adjust 'databaseUrl' if you named it differently in your runtime config
let sqlitePath = config.public?.databaseUrl || config.databaseUrl || process.env.DATABASE_URL;

if (!sqlitePath) {
  // Provide a default path or throw a more specific error
  console.warn('DATABASE_URL not found in runtime config or environment variables. Defaulting to ./db.sqlite');
  // Defaulting might be okay for dev, but consider throwing an error for production
  // throw new Error("DATABASE_URL is not configured in runtimeConfig or environment variables.");
  sqlitePath = './db.sqlite'; // Example default path
}

// Log the path being used for debugging
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
