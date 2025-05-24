ALTER TABLE `artists` RENAME COLUMN "artistId" TO "artist_id";--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_albums` (
	`album_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`artist_id` text,
	`user_id` text NOT NULL,
	`year` integer,
	`cover_path` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`artist_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_albums`("album_id", "title", "artist_id", "user_id", "year", "cover_path", "created_at", "updated_at") SELECT "album_id", "title", "artist_id", "user_id", "year", "cover_path", "created_at", "updated_at" FROM `albums`;--> statement-breakpoint
DROP TABLE `albums`;--> statement-breakpoint
ALTER TABLE `__new_albums` RENAME TO `albums`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_tracks` (
	`track_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`artist_id` text,
	`album_id` text,
	`genre` text,
	`year` integer,
	`track_number` integer,
	`disk_number` integer,
	`duration` integer,
	`file_path` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`artist_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`album_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tracks`("track_id", "title", "artist_id", "album_id", "genre", "year", "track_number", "disk_number", "duration", "file_path", "created_at", "updated_at") SELECT "track_id", "title", "artist_id", "album_id", "genre", "year", "track_number", "disk_number", "duration", "file_path", "created_at", "updated_at" FROM `tracks`;--> statement-breakpoint
DROP TABLE `tracks`;--> statement-breakpoint
ALTER TABLE `__new_tracks` RENAME TO `tracks`;--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_file_path_unique` ON `tracks` (`file_path`);--> statement-breakpoint
CREATE TABLE `__new_user_artists` (
	`user_artist_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`artist_id` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`artist_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_artists`("user_artist_id", "user_id", "artist_id", "created_at") SELECT "user_artist_id", "user_id", "artist_id", "created_at" FROM `user_artists`;--> statement-breakpoint
DROP TABLE `user_artists`;--> statement-breakpoint
ALTER TABLE `__new_user_artists` RENAME TO `user_artists`;