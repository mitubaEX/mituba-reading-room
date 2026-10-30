CREATE TABLE `presets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`entries` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `feeds` ADD `folder` text;