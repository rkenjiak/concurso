-- Multiusuário (#49). Escrita à mão: o drizzle-kit geraria um ADD COLUMN NOT NULL sem default,
-- inválido no SQLite, e recriar `concurso` com as chaves estrangeiras ativas apagaria as tabelas
-- filhas em cascata. Por isso a coluna entra anulável, recebe o usuário inicial e triggers
-- impedem `usuario_id` nulo (o schema do Drizzle a declara NOT NULL).
CREATE TABLE `usuario` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text,
	`google_sub` text,
	`nome` text,
	`avatar_url` text,
	`papel` text DEFAULT 'USUARIO' NOT NULL,
	`mcp_token_hash` text,
	`ultimo_acesso_em` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuario_email_unique` ON `usuario` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `usuario_google_sub_unique` ON `usuario` (`google_sub`);--> statement-breakpoint
CREATE UNIQUE INDEX `usuario_mcp_token_hash_unique` ON `usuario` (`mcp_token_hash`);--> statement-breakpoint
-- Usuário inicial (admin): dono dos dados existentes, assumido pelo primeiro login de ADMIN_EMAILS.
INSERT INTO `usuario` (`id`, `papel`) VALUES (1, 'ADMIN');--> statement-breakpoint
ALTER TABLE `concurso` ADD `usuario_id` integer REFERENCES usuario(id) ON DELETE CASCADE;--> statement-breakpoint
UPDATE `concurso` SET `usuario_id` = 1;--> statement-breakpoint
CREATE INDEX `concurso_usuario_idx` ON `concurso` (`usuario_id`,`status`);--> statement-breakpoint
CREATE TRIGGER `concurso_usuario_obrigatorio_insert` BEFORE INSERT ON `concurso`
WHEN NEW.`usuario_id` IS NULL
BEGIN
	SELECT RAISE(ABORT, 'NOT NULL constraint failed: concurso.usuario_id');
END;--> statement-breakpoint
CREATE TRIGGER `concurso_usuario_obrigatorio_update` BEFORE UPDATE OF `usuario_id` ON `concurso`
WHEN NEW.`usuario_id` IS NULL
BEGIN
	SELECT RAISE(ABORT, 'NOT NULL constraint failed: concurso.usuario_id');
END;
