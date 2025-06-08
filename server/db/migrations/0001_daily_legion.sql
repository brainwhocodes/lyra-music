CREATE TABLE `lyrics` (
	`lyrics_id` text PRIMARY KEY NOT NULL,
	`track_id` text NOT NULL,
	`lyrics_json` text,
	`source` text,
	`llm_model_used` text,
	`raw_llm_output` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`track_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lyrics_track_idx` ON `lyrics` (`track_id`);