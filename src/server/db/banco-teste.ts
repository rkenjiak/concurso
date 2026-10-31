import type { Client } from "@libsql/client";
import { criarDb, type Db } from "./client";
import { aplicarMigracoes } from "./migrate";

/** Banco libSQL em memória com todas as migrações aplicadas (testes de integração). */
export async function criarBancoTeste(): Promise<{ db: Db; client: Client }> {
  const banco = criarDb({ url: ":memory:" });
  await aplicarMigracoes(banco.db);
  return banco;
}
