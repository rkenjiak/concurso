/** Banco local padrão (ARQUITETURA.md §9.1). */
export const DATABASE_URL_PADRAO = "file:./data/concurso.db";

type Env = Record<string, string | undefined>;

/**
 * URL do banco: `DATABASE_URL`, senão `TURSO_DATABASE_URL` (injetada pela integração do Turso no
 * Marketplace da Vercel), senão o SQLite local. String vazia conta como "não definida".
 */
export function urlDoBanco(env: Env = process.env): string {
  return env.DATABASE_URL || env.TURSO_DATABASE_URL || DATABASE_URL_PADRAO;
}

/** Token do banco: `DATABASE_AUTH_TOKEN`, senão `TURSO_AUTH_TOKEN`; vazio vira `undefined`. */
export function tokenDoBanco(env: Env = process.env): string | undefined {
  return env.DATABASE_AUTH_TOKEN || env.TURSO_AUTH_TOKEN || undefined;
}
