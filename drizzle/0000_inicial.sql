CREATE TABLE `anexo` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`concurso_id` integer NOT NULL,
	`nome_arquivo` text NOT NULL,
	`mime` text NOT NULL,
	`tamanho_bytes` integer NOT NULL,
	`chave_storage` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`concurso_id`) REFERENCES `concurso`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anexo_chave_storage_unique` ON `anexo` (`chave_storage`);--> statement-breakpoint
CREATE INDEX `anexo_concurso_idx` ON `anexo` (`concurso_id`);--> statement-breakpoint
CREATE TABLE `concurso` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`orgao` text NOT NULL,
	`cargo` text NOT NULL,
	`banca` text,
	`esfera` text,
	`uf` text(2),
	`cidade` text,
	`escolaridade` text,
	`remuneracao_centavos` integer,
	`taxa_inscricao_centavos` integer,
	`vagas_ampla` integer,
	`vagas_cadastro_reserva` integer,
	`possui_cadastro_reserva` integer DEFAULT false NOT NULL,
	`vagas_cotas` integer,
	`status` text NOT NULL,
	`status_desde` integer NOT NULL,
	`observacoes` text,
	`homologacao_data` text,
	`validade_meses` integer,
	`validade_prorrogada` integer DEFAULT false NOT NULL,
	`validade_fim_manual` text,
	`busca_normalizada` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `concurso_status_idx` ON `concurso` (`status`);--> statement-breakpoint
CREATE TABLE `concurso_tag` (
	`concurso_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`concurso_id`, `tag_id`),
	FOREIGN KEY (`concurso_id`) REFERENCES `concurso`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `concurso_tag_tag_idx` ON `concurso_tag` (`tag_id`);--> statement-breakpoint
CREATE TABLE `evento` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`concurso_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`titulo` text,
	`data` text NOT NULL,
	`hora` text,
	`local` text,
	`observacao` text,
	`concluido` integer DEFAULT false NOT NULL,
	`concluido_em` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`concurso_id`) REFERENCES `concurso`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `evento_data_concluido_idx` ON `evento` (`data`,`concluido`);--> statement-breakpoint
CREATE INDEX `evento_concurso_idx` ON `evento` (`concurso_id`);--> statement-breakpoint
CREATE TABLE `link` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`concurso_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`rotulo` text,
	`url` text NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`concurso_id`) REFERENCES `concurso`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `link_concurso_idx` ON `link` (`concurso_id`,`ordem`);--> statement-breakpoint
CREATE TABLE `resultado_fase` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`concurso_id` integer NOT NULL,
	`fase` text NOT NULL,
	`descricao` text,
	`ordem` integer DEFAULT 0 NOT NULL,
	`nota` real,
	`nota_maxima` real,
	`nota_corte` real,
	`classificacao_geral` integer,
	`classificacao_cotas` integer,
	`lista_cotas` text,
	`situacao` text DEFAULT 'PENDENTE' NOT NULL,
	`observacao` text,
	FOREIGN KEY (`concurso_id`) REFERENCES `concurso`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `resultado_fase_concurso_idx` ON `resultado_fase` (`concurso_id`,`ordem`);--> statement-breakpoint
CREATE TABLE `status_historico` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`concurso_id` integer NOT NULL,
	`de` text,
	`para` text NOT NULL,
	`alterado_em` integer NOT NULL,
	`observacao` text,
	FOREIGN KEY (`concurso_id`) REFERENCES `concurso`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `status_historico_concurso_idx` ON `status_historico` (`concurso_id`,`alterado_em`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_nome_unique` ON `tag` (`nome`);