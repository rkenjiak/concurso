/** Leituras de resultados por fase (RF05). */
import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { type ResultadoFase, resultadoFase } from "../db/schema";
import type { Executor } from "../repositories/tipos";

/**
 * Resultados do concurso na ordem de cadastro das fases (o chamador garante que o concurso é do
 * usuário, via `obterConcurso`).
 */
export async function listarResultadosFase(
  db: Db | Executor,
  concursoId: number,
): Promise<ResultadoFase[]> {
  return db
    .select()
    .from(resultadoFase)
    .where(eq(resultadoFase.concursoId, concursoId))
    .orderBy(asc(resultadoFase.ordem), asc(resultadoFase.id));
}
