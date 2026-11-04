CREATE TABLE `pendencia_status_dispensa` (
	`concurso_id` integer NOT NULL,
	`evento_id` integer NOT NULL,
	`regra` text NOT NULL,
	`data_evento` text NOT NULL,
	`ate` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`evento_id`, `regra`),
	FOREIGN KEY (`concurso_id`) REFERENCES `concurso`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evento_id`) REFERENCES `evento`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pendencia_status_dispensa_concurso_idx` ON `pendencia_status_dispensa` (`concurso_id`);