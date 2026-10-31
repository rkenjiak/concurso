/**
 * Aplica as migrações pendentes no banco configurado por DATABASE_URL.
 * Executado automaticamente antes de `pnpm dev` e `pnpm build` (ARQUITETURA.md §9).
 */
import { criarDb, DATABASE_URL_PADRAO } from "../src/server/db/client";
import { aplicarMigracoes } from "../src/server/db/migrate";
import { carregarEnv } from "./env";

carregarEnv();

const { db, client } = criarDb();
const url = process.env.DATABASE_URL ?? DATABASE_URL_PADRAO;
const destino = url.startsWith("libsql:") || url.startsWith("https:") ? "banco remoto" : url;

try {
  await aplicarMigracoes(db);
  console.log(`Migrações aplicadas (${destino}).`);
} catch (erro) {
  console.error("Falha ao aplicar migrações:", erro);
  process.exitCode = 1;
} finally {
  client.close();
}
