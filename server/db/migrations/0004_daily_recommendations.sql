CREATE TABLE `recommendation_snapshots` (
  `user_id` text PRIMARY KEY NOT NULL REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  `items` text NOT NULL DEFAULT '[]',
  `basis` text NOT NULL DEFAULT 'cold-start',
  `metrics` text,
  `model_key` text,
  `generated_at` text,
  `next_refresh_at` integer,
  `refresh_job_id` text,
  `retry_after` integer
);
--> statement-breakpoint
CREATE INDEX `recommendation_snapshots_due_idx` ON `recommendation_snapshots` (`next_refresh_at`);
--> statement-breakpoint
CREATE INDEX `user_track_plays_user_played_idx` ON `user_track_plays` (`user_id`, `played_at`);
