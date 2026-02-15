CREATE TABLE `job_queue` (
	`job_id` text PRIMARY KEY NOT NULL,
	`job_type` text NOT NULL,
	`payload` text NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`run_after` integer DEFAULT (unixepoch()) NOT NULL,
	`leased_until` integer,
	`lease_owner` text,
	`cancel_requested` integer DEFAULT false NOT NULL,
	`progress` text,
	`result` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `job_queue_type_state_run_after_idx` ON `job_queue` (`job_type`,`state`,`run_after`);--> statement-breakpoint
CREATE INDEX `job_queue_state_run_after_idx` ON `job_queue` (`state`,`run_after`);--> statement-breakpoint
CREATE INDEX `job_queue_lease_owner_idx` ON `job_queue` (`lease_owner`);--> statement-breakpoint
CREATE TABLE `scan_files` (
	`scan_file_id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`path` text NOT NULL,
	`size_bytes` integer,
	`mtime_ms` integer,
	`extension` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scan_id`) REFERENCES `scan_runs`(`scan_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scan_files_scan_id_path_unique` ON `scan_files` (`scan_id`,`path`);--> statement-breakpoint
CREATE INDEX `scan_files_scan_id_idx` ON `scan_files` (`scan_id`);--> statement-breakpoint
CREATE TABLE `scan_runs` (
	`scan_id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`user_id` text NOT NULL,
	`root_path` text NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`files_discovered` integer DEFAULT 0 NOT NULL,
	`files_persisted` integer DEFAULT 0 NOT NULL,
	`batches_flushed` integer DEFAULT 0 NOT NULL,
	`errors` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`started_at` text,
	`finished_at` text,
	`cancelled_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job_queue`(`job_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scan_runs_user_state_idx` ON `scan_runs` (`user_id`,`state`);