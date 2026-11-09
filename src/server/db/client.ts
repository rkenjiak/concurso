import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type Client, createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { ESPERA_LOCK_MS, ehArquivoLocal, protegerClienteLocal } from "./local";
import * as schema from "./schema";
import { tokenDoBanco, urlDoBanco } from "./url";

export { DATABASE_URL_PADRAO, tokenDoBanco, urlDoBanco } from "./url";

export type Db = LibSQLDatabase<typeof schema>;

export interface OpcoesDb {
  /** `file:./caminho.db`, `:memory:` ou `libsql://…` (Turso). */
  url?: string;
  authToken?: string;
}

/** Cria o diretório de um banco em arquivo local (ex.: `data/`), se necessário. */
function garantirDiretorio(url: string): void {
  if (!url.startsWith("file:")) return;
  const caminho = url.slice("file:".length).split("?")[0] ?? "";
  if (caminho === "" || caminho === ":memory:") return;
  mkdirSync(dirname(caminho), { recursive: true });
}

/**
 * Cria um client libSQL + Drizzle. Usado diretamente pelos testes (`:memory:`) e scripts;
 * o app usa o singleton de {@link getDb}.
 */
export function criarDb(opcoes: OpcoesDb = {}): { db: Db; client: Client } {
  const url = opcoes.url ?? urlDoBanco();
  const authToken = opcoes.authToken ?? tokenDoBanco();
  garantirDiretorio(url);
  // Arquivo local: WAL, uma escrita por vez no processo e busy timeout contra outros processos
  // (#112, veja `local.ts`). `:memory:` tem uma conexão só, e o remoto (Turso) cuida disso.
  const client = ehArquivoLocal(url)
    ? protegerClienteLocal(createClient({ url, authToken, timeout: ESPERA_LOCK_MS }))
    : createClient({ url, authToken });
  const db = drizzle(client, { schema });
  return { db, client };
}

// Mantém uma única conexão entre recargas do servidor de desenvolvimento (HMR).
const globalDb = globalThis as typeof globalThis & { __concursoDb?: Db };

/**
 * Instância compartilhada do banco configurada por `DATABASE_URL`/`DATABASE_AUTH_TOKEN` (ou
 * `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`; veja {@link urlDoBanco}).
 */
export function getDb(): Db {
  globalDb.__concursoDb ??= criarDb().db;
  return globalDb.__concursoDb;
}
