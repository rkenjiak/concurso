/**
 * Mudanças de status (RF03, ARQUITETURA.md §4.1). Cada operação lê o histórico, aplica as regras
 * de `domain/status` e grava `status_historico` + `concurso.status/status_desde` na mesma transação.
 */
import { eq } from "drizzle-orm";
import type { Status } from "@/domain/enums";
import { ErroDominio } from "@/domain/erros";
import {
  contextoDoHistorico,
  type DesfazerEsperado,
  exigirTransicao,
  statusAoDesfazer,
} from "@/domain/status";
import { concurso, statusHistorico } from "../db/schema";
import { listarHistorico } from "../queries/historico";
import { doUsuario } from "./concursos";
import { definirConcluido } from "./eventos";
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

/**
 * Altera o status validando a transição. Lança {@link ErroDominio} se não permitida. Retorna o id
 * do registro do histórico criado (o "Desfazer" do aviso confere que ainda é o último, #100).
 */
export async function alterarStatus(
  db: Executor,
  usuarioId: number,
  id: number,
  para: Status,
  observacao: string | null = null,
  agora: Date = new Date(),
): Promise<number> {
  return db.transaction(async (tx) => {
    const de = await statusAtual(tx, usuarioId, id);
    const historico = await listarHistorico(tx, id);
    exigirTransicao(de, para, contextoDoHistorico(historico));
    const [registro] = await tx
      .insert(statusHistorico)
      .values({ concursoId: id, de, para, alteradoEm: agora, observacao })
      .returning({ id: statusHistorico.id });
    await tx.update(concurso).set({ status: para, statusDesde: agora }).where(eq(concurso.id, id));
    if (!registro) throw new Error("Registro de status não gravado.");
    return registro.id;
  });
}

/**
 * Desfaz a última mudança: remove o último registro do histórico e restaura o `de`.
 * `status_desde` volta a ser a data do registro que passa a ser o último. Retorna o status restaurado.
 * Com `esperado`, só desfaz se a última mudança ainda for essa; senão lança {@link ErroDominio} e
 * nada muda (#100).
 */
export async function desfazerUltimoStatus(
  db: Executor,
  usuarioId: number,
  id: number,
  esperado: DesfazerEsperado = {},
): Promise<Status> {
  return db.transaction(async (tx) => {
    await statusAtual(tx, usuarioId, id);
    const historico = await listarHistorico(tx, id);
    const ultimo = historico.at(-1);
    const restaurado = statusAoDesfazer(ultimo, esperado);
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

/** O que desfazer de uma resposta a pendência de status (#100). */
export interface RespostaADesfazer {
  /** Registro do histórico criado pela resposta; `null` = a resposta não mudou o status. */
  registroStatus: number | null;
  /** Evento que a resposta concluiu; `null` = nenhum. */
  eventoConcluido: number | null;
}

/**
 * Desfaz a resposta a uma pendência numa única transação: volta o status (só se a última mudança
 * ainda for a da resposta) e reabre o evento que ela concluiu. Se qualquer parte falhar, nada muda.
 * Retorna o status resultante.
 */
export async function desfazerResposta(
  db: Executor,
  usuarioId: number,
  id: number,
  { registroStatus, eventoConcluido }: RespostaADesfazer,
): Promise<Status> {
  return db.transaction(async (tx) => {
    const status =
      registroStatus === null
        ? await statusAtual(tx, usuarioId, id)
        : await desfazerUltimoStatus(tx, usuarioId, id, { registroId: registroStatus });
    if (eventoConcluido !== null) {
      await definirConcluido(tx, usuarioId, id, eventoConcluido, false);
    }
    return status;
  });
}
