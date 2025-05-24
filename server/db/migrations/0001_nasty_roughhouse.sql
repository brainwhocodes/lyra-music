PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_media_folders` (
	`media_folders_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`path` text NOT NULL,
	`label` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_media_folders`("media_folders_id", "user_id", "path", "label", "created_at", "updated_at") SELECT "media_folders_id", "user_id", "path", "label", "created_at", "updated_at" FROM `media_folders`;--> statement-breakpoint
DROP TABLE `media_folders`;--> statement-breakpoint
ALTER TABLE `__new_media_folders` RENAME TO `media_folders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;