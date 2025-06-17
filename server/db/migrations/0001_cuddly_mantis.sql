CREATE TABLE `user_track_plays` (
	`user_track_play_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`track_id` text NOT NULL,
	`played_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`play_duration_ms` integer,
	`source` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`track_id`) ON UPDATE no action ON DELETE cascade
);
