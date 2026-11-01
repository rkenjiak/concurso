import type { Client } from "@libsql/client";
import { criarDb, type Db } from "./client";
import { aplicarMigracoes } from "./migrate";
import { usuario } from "./schema";

/** Banco libSQL em memória com todas as migrações aplicadas (testes de integração). */
export async function criarBancoTeste(): Promise<{ db: Db; client: Client }> {
  const banco = criarDb({ url: ":memory:" });
  await aplicarMigracoes(banco.db);
  return banco;
}

/** Cadastra outro usuário (testes de isolamento entre usuários, #49). Retorna o ID. */
export async function criarUsuarioTeste(db: Db, email = "outra@exemplo.com"): Promise<number> {
  const [linha] = await db.insert(usuario).values({ email }).returning({ id: usuario.id });
  if (!linha) throw new Error("Falha ao criar o usuário de teste.");
  return linha.id;
}
