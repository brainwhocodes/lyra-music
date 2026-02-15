import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

export const jobQueue = sqliteTable('job_queue', {
  jobId: text('job_id').primaryKey().$defaultFn(() => uuidv7()),
  jobType: text('job_type').notNull(),
  payload: text('payload').notNull(),
  state: text('state').notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  runAfter: integer('run_after').notNull().default(sql`(unixepoch())`),
  leasedUntil: integer('leased_until'),
  leaseOwner: text('lease_owner'),
  cancelRequested: integer('cancel_requested', { mode: 'boolean' }).notNull().default(false),
  progress: text('progress'),
  result: text('result'),
  lastError: text('last_error'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => ({
  jobTypeStateRunAfterIdx: index('job_queue_type_state_run_after_idx').on(table.jobType, table.state, table.runAfter),
  stateRunAfterIdx: index('job_queue_state_run_after_idx').on(table.state, table.runAfter),
  leaseOwnerIdx: index('job_queue_lease_owner_idx').on(table.leaseOwner),
}));

export const scanRuns = sqliteTable('scan_runs', {
  scanId: text('scan_id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobQueue.jobId, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  rootPath: text('root_path').notNull(),
  state: text('state').notNull().default('queued'),
  filesDiscovered: integer('files_discovered').notNull().default(0),
  filesPersisted: integer('files_persisted').notNull().default(0),
  batchesFlushed: integer('batches_flushed').notNull().default(0),
  errors: integer('errors').notNull().default(0),
  lastError: text('last_error'),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
  cancelledAt: text('cancelled_at'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => ({
  scanRunsUserStateIdx: index('scan_runs_user_state_idx').on(table.userId, table.state),
}));

export const scanFiles = sqliteTable('scan_files', {
  scanFileId: text('scan_file_id').primaryKey().$defaultFn(() => uuidv7()),
  scanId: text('scan_id').notNull().references(() => scanRuns.scanId, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  sizeBytes: integer('size_bytes'),
  mtimeMs: integer('mtime_ms'),
  extension: text('extension'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => ({
  scanPathUnique: uniqueIndex('scan_files_scan_id_path_unique').on(table.scanId, table.path),
  scanIdx: index('scan_files_scan_id_idx').on(table.scanId),
}));

export type JobQueue = InferSelectModel<typeof jobQueue>;
export type NewJobQueue = InferInsertModel<typeof jobQueue>;
export type ScanRun = InferSelectModel<typeof scanRuns>;
export type NewScanRun = InferInsertModel<typeof scanRuns>;
export type ScanFile = InferSelectModel<typeof scanFiles>;
export type NewScanFile = InferInsertModel<typeof scanFiles>;
