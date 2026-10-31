/** Escritas de resultados por fase (RF05). Toda operação é restrita ao concurso informado. */
import { and, eq, max } from "drizzle-orm";
import { ErroDominio } from "@/domain/erros";
import type { ResultadoFaseDados } from "@/lib/schemas/resultado-fase";
import type { Db } from "../db/client";
import { concurso, resultadoFase } from "../db/schema";

const NAO_ENCONTRADO = "Resultado não encontrado.";

const doConcurso = (concursoId: number, resultadoId: number) =>
  and(eq(resultadoFase.id, resultadoId), eq(resultadoFase.concursoId, concursoId));

/** Cria o resultado ao fim da lista de fases. Retorna o ID. */
export async function criarResultadoFase(
  db: Db,
  concursoId: number,
  dados: ResultadoFaseDados,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [existe] = await tx
      .select({ id: concurso.id })
      .from(concurso)
      .where(eq(concurso.id, concursoId));
    if (!existe) throw new ErroDominio("Concurso não encontrado.");
    const [ultimo] = await tx
      .select({ ordem: max(resultadoFase.ordem) })
      .from(resultadoFase)
      .where(eq(resultadoFase.concursoId, concursoId));
    const [novo] = await tx
      .insert(resultadoFase)
      .values({ ...dados, concursoId, ordem: (ultimo?.ordem ?? -1) + 1 })
      .returning({ id: resultadoFase.id });
    if (!novo) throw new Error("Falha ao inserir o resultado.");
    return novo.id;
  });
}

export async function atualizarResultadoFase(
  db: Db,
  concursoId: number,
  resultadoId: number,
  dados: ResultadoFaseDados,
): Promise<void> {
  const linhas = await db
    .update(resultadoFase)
    .set(dados)
    .where(doConcurso(concursoId, resultadoId))
    .returning({ id: resultadoFase.id });
  if (linhas.length === 0) throw new ErroDominio(NAO_ENCONTRADO);
}

export async function excluirResultadoFase(
  db: Db,
  concursoId: number,
  resultadoId: number,
): Promise<void> {
  const linhas = await db
    .delete(resultadoFase)
    .where(doConcurso(concursoId, resultadoId))
    .returning({ id: resultadoFase.id });
  if (linhas.length === 0) throw new ErroDominio(NAO_ENCONTRADO);
}
