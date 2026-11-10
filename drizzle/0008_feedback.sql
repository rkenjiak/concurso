CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer,
	`usuario` text NOT NULL,
	`tipo` text NOT NULL,
	`mensagem` text NOT NULL,
	`pagina` text,
	`versao_app` text NOT NULL,
	`commit_app` text NOT NULL,
	`user_agent` text,
	`status` text DEFAULT 'NOVO' NOT NULL,
	`tratado_por` integer,
	`tratado_em` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`tratado_por`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `feedback_status_created_idx` ON `feedback` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `feedback_usuario_created_idx` ON `feedback` (`usuario_id`,`created_at`);