/** Escritas de eventos (RF04). Toda operação é restrita ao concurso informado. */
import { and, eq } from "drizzle-orm";
import { ErroDominio } from "@/domain/erros";
import type { EventoDados } from "@/lib/schemas/evento";
import type { Db } from "../db/client";
import { concurso, evento } from "../db/schema";

const NAO_ENCONTRADO = "Evento não encontrado.";

const doConcurso = (concursoId: number, eventoId: number) =>
  and(eq(evento.id, eventoId), eq(evento.concursoId, concursoId));

/** Cria o evento. Retorna o ID. */
export async function criarEvento(
  db: Db,
  concursoId: number,
  dados: EventoDados,
  agora: Date = new Date(),
): Promise<number> {
  return db.transaction(async (tx) => {
    const [existe] = await tx
      .select({ id: concurso.id })
      .from(concurso)
      .where(eq(concurso.id, concursoId));
    if (!existe) throw new ErroDominio("Concurso não encontrado.");
    const [novo] = await tx
      .insert(evento)
      .values({ ...dados, concursoId, concluidoEm: dados.concluido ? agora : null })
      .returning({ id: evento.id });
    if (!novo) throw new Error("Falha ao inserir o evento.");
    return novo.id;
  });
}

/** Atualiza o evento; `concluido_em` só muda quando o estado de conclusão muda. */
export async function atualizarEvento(
  db: Db,
  concursoId: number,
  eventoId: number,
  dados: EventoDados,
  agora: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
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
  });
}

/** Marca ou desmarca o evento como concluído. */
export async function definirConcluido(
  db: Db,
  concursoId: number,
  eventoId: number,
  concluido: boolean,
  agora: Date = new Date(),
): Promise<void> {
  const linhas = await db
    .update(evento)
    .set({ concluido, concluidoEm: concluido ? agora : null })
    .where(doConcurso(concursoId, eventoId))
    .returning({ id: evento.id });
  if (linhas.length === 0) throw new ErroDominio(NAO_ENCONTRADO);
}

export async function excluirEvento(db: Db, concursoId: number, eventoId: number): Promise<void> {
  const linhas = await db
    .delete(evento)
    .where(doConcurso(concursoId, eventoId))
    .returning({ id: evento.id });
  if (linhas.length === 0) throw new ErroDominio(NAO_ENCONTRADO);
}
