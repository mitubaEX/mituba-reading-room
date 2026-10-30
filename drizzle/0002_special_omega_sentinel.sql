CREATE TABLE `image_runs` (
	`owner` text PRIMARY KEY NOT NULL,
	`next_allowed` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `articles` ADD `image_checked` integer;