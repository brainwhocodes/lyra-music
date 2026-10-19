import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type Database from 'better-sqlite3';

export function migrateTestDatabase(connection: Database.Database) {
  for (const name of ['0000_sloppy_mole_man.sql', '0002_colossal_christian_walker.sql', '0003_track_embeddings.sql', '0004_daily_recommendations.sql']) {
    connection.exec(readFileSync(resolve('server/db/migrations', name), 'utf8'));
  }
}
