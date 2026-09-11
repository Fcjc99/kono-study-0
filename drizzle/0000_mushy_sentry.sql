CREATE TABLE `plan_history` (
	`owner` text NOT NULL,
	`revision` integer NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `revision`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`owner` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`data` text,
	`operation` text NOT NULL,
	`updated_at` text NOT NULL
);
