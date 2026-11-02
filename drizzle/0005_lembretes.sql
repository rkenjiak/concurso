CREATE TABLE `notificacao_estado` (
	`chave` text PRIMARY KEY NOT NULL,
	`concurso_id` integer NOT NULL,
	`evento_id` integer,
	`antecedencia` integer NOT NULL,
	`lida_em` integer,
	`dispensada_em` integer,
	FOREIGN KEY (`concurso_id`) REFERENCES `concurso`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evento_id`) REFERENCES `evento`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notificacao_estado_concurso_idx` ON `notificacao_estado` (`concurso_id`);--> statement-breakpoint
CREATE INDEX `notificacao_estado_evento_idx` ON `notificacao_estado` (`evento_id`);--> statement-breakpoint
CREATE TABLE `regra_notificacao` (
	`usuario_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`ativo` integer NOT NULL,
	`antecedencias` text NOT NULL,
	PRIMARY KEY(`usuario_id`, `tipo`),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `concurso` ADD `notificacoes_silenciadas` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `usuario` ADD `ics_token_hash` text;--> statement-breakpoint
ALTER TABLE `usuario` ADD `ics_incluir_concluidos` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `usuario` ADD `ics_incluir_encerrados` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `usuario_ics_token_hash_unique` ON `usuario` (`ics_token_hash`);