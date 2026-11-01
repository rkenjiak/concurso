CREATE TABLE `auditoria_admin` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin_id` integer,
	`admin` text NOT NULL,
	`acao` text NOT NULL,
	`alvo_usuario_id` integer,
	`alvo` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`alvo_usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `auditoria_admin_created_idx` ON `auditoria_admin` (`created_at`);--> statement-breakpoint
CREATE TABLE `email_permitido` (
	`email` text PRIMARY KEY NOT NULL,
	`adicionado_por` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`adicionado_por`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `usuario` ADD `bloqueado_em` integer;