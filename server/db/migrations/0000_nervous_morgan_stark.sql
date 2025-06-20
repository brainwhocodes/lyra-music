CREATE TABLE `users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`password_hash` text NOT NULL,
	`login_attempts` integer DEFAULT 0 NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `artists` (
	`artist_id` text PRIMARY KEY NOT NULL,
	`artist_image` text,
	`name` text NOT NULL,
	`musicbrainz_artist_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `artist_users` (
	`artist_user_id` text PRIMARY KEY NOT NULL,
	`artist_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`artist_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `albums` (
	`album_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`user_id` text NOT NULL,
	`year` integer,
	`cover_path` text,
	`processed_status` integer DEFAULT -1 NOT NULL,
	`folder_path` text,
	`musicbrainz_release_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `album_artists` (
	`album_artist_id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL,
	`artist_id` text NOT NULL,
	`is_primary_artist` integer DEFAULT 0,
	`role` text DEFAULT 'performer',
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`album_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`artist_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `radio_channels` (
	`channel_id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`description` text,
	`seed_artist_id` text,
	`seed_genre_id` text,
	`dynamic` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`seed_artist_id`) REFERENCES `artists`(`artist_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`seed_genre_id`) REFERENCES `genres`(`genre_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `radio_channel_tracks` (
	`radio_track_id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`track_id` text NOT NULL,
	`added_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `radio_channels`(`channel_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`track_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`track_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`album_id` text,
	`genre` text,
	`year` integer,
	`track_number` integer,
	`disk_number` integer,
	`duration` integer,
	`explicit` integer DEFAULT false NOT NULL,
	`file_path` text NOT NULL,
	`musicbrainz_track_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`album_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_file_path_unique` ON `tracks` (`file_path`);--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_musicbrainz_track_id_unique` ON `tracks` (`musicbrainz_track_id`);--> statement-breakpoint
CREATE TABLE `artists_tracks` (
	`artists_tracks_id` text PRIMARY KEY NOT NULL,
	`artist_id` text NOT NULL,
	`track_id` text NOT NULL,
	`role` text,
	`is_primary_artist` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`artist_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`track_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `playlists` (
	`playlist_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `playlist_tracks` (
	`playlist_tracks_id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`track_id` text NOT NULL,
	`order` integer,
	`added_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`playlist_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`track_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `media_folders` (
	`media_folders_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`path` text NOT NULL,
	`label` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `genres` (
	`genre_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `genres_name_unique` ON `genres` (`name`);--> statement-breakpoint
CREATE TABLE `album_genres` (
	`album_genre_id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL,
	`genre_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`album_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genre_id`) REFERENCES `genres`(`genre_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `lyrics_track_idx` ON `lyrics` (`track_id`);--> statement-breakpoint
CREATE TABLE `discovery_playlists` (
	`discovery_playlist_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`seed_artist_id` text,
	`generation_params` text,
	`last_generated_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`seed_artist_id`) REFERENCES `artists`(`artist_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dp_user_type_title_idx` ON `discovery_playlists` (`user_id`,`type`,`title`);--> statement-breakpoint
CREATE UNIQUE INDEX `dp_user_type_seed_artist_idx` ON `discovery_playlists` (`user_id`,`type`,`seed_artist_id`);--> statement-breakpoint
CREATE TABLE `discovery_playlist_tracks` (
	`discovery_playlist_track_id` text PRIMARY KEY NOT NULL,
	`discovery_playlist_id` text NOT NULL,
	`track_id` text NOT NULL,
	`order` integer NOT NULL,
	`added_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reason` text,
	`relevance_score` integer,
	FOREIGN KEY (`discovery_playlist_id`) REFERENCES `discovery_playlists`(`discovery_playlist_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`track_id`) ON UPDATE no action ON DELETE cascade
);
