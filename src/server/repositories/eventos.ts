/**
 * Escritas de eventos (RF04). Toda operação é restrita ao concurso informado, que precisa ser do
 * usuário (#49).
 */
import { and, eq } from "drizzle-orm";
import { ErroDominio } from "@/domain/erros";
import type { EventoDados } from "@/lib/schemas/evento";
import type { Db } from "../db/client";
import { concurso, evento } from "../db/schema";
import type { Executor, Transacao } from "./tipos";

const NAO_ENCONTRADO = "Evento não encontrado.";

const doConcurso = (concursoId: number, eventoId: number) =>
  and(eq(evento.id, eventoId), eq(evento.concursoId, concursoId));

/** Item de um lote: `id` nulo cria; com `id`, atualiza o evento existente do concurso. */
export interface ItemEvento {
  id: number | null;
  dados: EventoDados;
}

/** Lança {@link ErroDominio} se o concurso não existe ou é de outro usuário. */
export async function exigirConcurso(
  tx: Executor,
  usuarioId: number,
  concursoId: number,
): Promise<void> {
  const [existe] = await tx
    .select({ id: concurso.id })
    .from(concurso)
    .where(and(eq(concurso.id, concursoId), eq(concurso.usuarioId, usuarioId)));
  if (!existe) throw new ErroDominio("Concurso não encontrado.");
}

/** Insere o evento numa transação aberta (o concurso deve existir). Retorna o ID. */
export async function inserirEvento(
  tx: Transacao,
  concursoId: number,
  dados: EventoDados,
  agora: Date,
): Promise<number> {
  const [novo] = await tx
    .insert(evento)
    .values({ ...dados, concursoId, concluidoEm: dados.concluido ? agora : null })
    .returning({ id: evento.id });
  if (!novo) throw new Error("Falha ao inserir o evento.");
  return novo.id;
}

/** Atualiza o evento numa transação aberta; `concluido_em` só muda quando a conclusão muda. */
async function atualizarEventoTx(
  tx: Transacao,
  concursoId: number,
  eventoId: number,
  dados: EventoDados,
  agora: Date,
): Promise<void> {
  const [atual] = await tx
    .select({ concluido: evento.concluido, concluidoEm: evento.concluidoEm })
    .from(evento)
    .where(doConcurso(concursoId, eventoId));
  if (!atual) throw new ErroDominio(NAO_ENCONTRADO);
  const concluidoEm =
    dados.concluido === atual.concluido ? atual.concluidoEm : dados.concluido ? agora : null;
  await tx
    .update(evento)
    .set({ ...dados, concluidoEm })
    .where(doConcurso(concursoId, eventoId));
}

/** Cria o evento. Retorna o ID. */
export async function criarEvento(
  db: Db,
  usuarioId: number,
  concursoId: number,
  dados: EventoDados,
  agora: Date = new Date(),
): Promise<number> {
  return db.transaction(async (tx) => {
    await exigirConcurso(tx, usuarioId, concursoId);
    return inserirEvento(tx, concursoId, dados, agora);
  });
}

/** Atualiza o evento; `concluido_em` só muda quando o estado de conclusão muda. */
export async function atualizarEvento(
  db: Db,
  usuarioId: number,
  concursoId: number,
  eventoId: number,
  dados: EventoDados,
  agora: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await exigirConcurso(tx, usuarioId, concursoId);
    await atualizarEventoTx(tx, concursoId, eventoId, dados, agora);
  });
}

/**
 * Cria e atualiza vários eventos do concurso numa única transação (tudo ou nada) — usado para
 * aplicar um cronograma ou uma retificação. Nunca exclui. Retorna os IDs na ordem dos itens.
 */
export async function salvarEventos(
  db: Db,
  usuarioId: number,
  concursoId: number,
  itens: readonly ItemEvento[],
  agora: Date = new Date(),
): Promise<number[]> {
  return db.transaction(async (tx) => {
    await exigirConcurso(tx, usuarioId, concursoId);
    const ids: number[] = [];
    for (const { id, dados } of itens) {
      if (id === null) {
        ids.push(await inserirEvento(tx, concursoId, dados, agora));
      } else {
        await atualizarEventoTx(tx, concursoId, id, dados, agora);
        ids.push(id);
      }
    }
    return ids;
  });
}

/** Marca ou desmarca o evento como concluído. */
export async function definirConcluido(
  db: Db,
  usuarioId: number,
  concursoId: number,
  eventoId: number,
  concluido: boolean,
  agora: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await exigirConcurso(tx, usuarioId, concursoId);
    const linhas = await tx
      .update(evento)
      .set({ concluido, concluidoEm: concluido ? agora : null })
      .where(doConcurso(concursoId, eventoId))
      .returning({ id: evento.id });
    if (linhas.length === 0) throw new ErroDominio(NAO_ENCONTRADO);
  });
}

export async function excluirEvento(
  db: Db,
  usuarioId: number,
  concursoId: number,
  eventoId: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    await exigirConcurso(tx, usuarioId, concursoId);
    const linhas = await tx
      .delete(evento)
      .where(doConcurso(concursoId, eventoId))
      .returning({ id: evento.id });
    if (linhas.length === 0) throw new ErroDominio(NAO_ENCONTRADO);
  });
}
