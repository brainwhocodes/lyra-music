CREATE TABLE `albums` (
	`albumId` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`artist_id` text,
	`year` integer,
	`cover_path` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`artistId`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `artists` (
	`artistId` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_folders` (
	`media_folders_id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`path` text NOT NULL,
	`label` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`userId`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_folders_path_unique` ON `media_folders` (`path`);--> statement-breakpoint
CREATE TABLE `playlist_tracks` (
	`playlist_tracks_id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`track_id` text NOT NULL,
	`order` integer,
	`added_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`playlist_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`trackId`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `playlists` (
	`playlist_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`userId`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`trackId` text PRIMARY KEY NOT NULL,
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
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`artistId`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`albumId`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_file_path_unique` ON `tracks` (`file_path`);--> statement-breakpoint
CREATE TABLE `users` (
	`userId` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);