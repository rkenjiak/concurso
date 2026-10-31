import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type Client, createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Db = LibSQLDatabase<typeof schema>;

/** Banco local padrão (ARQUITETURA.md §9.1). */
export const DATABASE_URL_PADRAO = "file:./data/concurso.db";

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
  const url = opcoes.url ?? process.env.DATABASE_URL ?? DATABASE_URL_PADRAO;
  const authToken = opcoes.authToken ?? (process.env.DATABASE_AUTH_TOKEN || undefined);
  garantirDiretorio(url);
  const client = createClient({ url, authToken });
  const db = drizzle(client, { schema });
  return { db, client };
}

// Mantém uma única conexão entre recargas do servidor de desenvolvimento (HMR).
const globalDb = globalThis as typeof globalThis & { __concursoDb?: Db };

/** Instância compartilhada do banco configurada por `DATABASE_URL`/`DATABASE_AUTH_TOKEN`. */
export function getDb(): Db {
  globalDb.__concursoDb ??= criarDb().db;
  return globalDb.__concursoDb;
}
