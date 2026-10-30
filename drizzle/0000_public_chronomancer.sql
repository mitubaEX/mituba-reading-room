CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`feed` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`summary` text NOT NULL,
	`published` text,
	`added` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`saved` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feeds` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`checked` text,
	`success` text,
	`error` text
);
