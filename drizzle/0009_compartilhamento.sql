CREATE TABLE `compartilhamento_concurso` (
	`concurso_id` integer PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`concurso_id`) REFERENCES `concurso`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `compartilhamento_concurso_token_unique` ON `compartilhamento_concurso` (`token`);