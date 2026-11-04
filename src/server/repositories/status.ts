/**
 * Mudanças de status (RF03, ARQUITETURA.md §4.1). Cada operação lê o histórico, aplica as regras
 * de `domain/status` e grava `status_historico` + `concurso.status/status_desde` na mesma transação.
 */
import { eq } from "drizzle-orm";
import type { Status } from "@/domain/enums";
import { ErroDominio } from "@/domain/erros";
import { contextoDoHistorico, exigirTransicao, statusAoDesfazer } from "@/domain/status";
import type { Db } from "../db/client";
import { concurso, statusHistorico } from "../db/schema";
import { listarHistorico } from "../queries/historico";
import { doUsuario } from "./concursos";
import type { Executor, Transacao } from "./tipos";

/** Status atual do concurso do usuário; lança {@link ErroDominio} se não houver. */
async function statusAtual(tx: Transacao, usuarioId: number, id: number): Promise<Status> {
  const [linha] = await tx
    .select({ status: concurso.status })
    .from(concurso)
    .where(doUsuario(usuarioId, id));
  if (!linha) throw new ErroDominio("Concurso não encontrado.");
  return linha.status;
}

/** Altera o status validando a transição. Lança {@link ErroDominio} se não permitida. */
export async function alterarStatus(
  db: Executor,
  usuarioId: number,
  id: number,
  para: Status,
  observacao: string | null = null,
  agora: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const de = await statusAtual(tx, usuarioId, id);
    const historico = await listarHistorico(tx, id);
    exigirTransicao(de, para, contextoDoHistorico(historico));
    await tx
      .insert(statusHistorico)
      .values({ concursoId: id, de, para, alteradoEm: agora, observacao });
    await tx.update(concurso).set({ status: para, statusDesde: agora }).where(eq(concurso.id, id));
  });
}

/**
 * Desfaz a última mudança: remove o último registro do histórico e restaura o `de`.
 * `status_desde` volta a ser a data do registro que passa a ser o último. Retorna o status restaurado.
 */
export async function desfazerUltimoStatus(db: Db, usuarioId: number, id: number): Promise<Status> {
  return db.transaction(async (tx) => {
    await statusAtual(tx, usuarioId, id);
    const historico = await listarHistorico(tx, id);
    const ultimo = historico.at(-1);
    const restaurado = statusAoDesfazer(ultimo);
    if (!ultimo) throw new ErroDominio("Não há mudança de status para desfazer.");
    const anterior = historico.at(-2);
    await tx.delete(statusHistorico).where(eq(statusHistorico.id, ultimo.id));
    await tx
      .update(concurso)
      .set({ status: restaurado, statusDesde: anterior?.alteradoEm ?? ultimo.alteradoEm })
      .where(eq(concurso.id, id));
    return restaurado;
  });
}
