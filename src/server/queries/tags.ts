/** Leituras de tags (RF01). */
import { asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { concursoTag, tag } from "../db/schema";

/** Todas as tags existentes, em ordem alfabética (sugestões no formulário). */
export async function listarTags(db: Db): Promise<string[]> {
  const linhas = await db.select({ nome: tag.nome }).from(tag).orderBy(asc(tag.nome));
  return linhas.map((l) => l.nome);
}

/** Tags agrupadas por concurso, em ordem alfabética. */
export async function tagsPorConcurso(
  db: Db,
  concursoIds: readonly number[],
): Promise<Map<number, string[]>> {
  const mapa = new Map<number, string[]>();
  if (concursoIds.length === 0) return mapa;
  const linhas = await db
    .select({ concursoId: concursoTag.concursoId, nome: tag.nome })
    .from(concursoTag)
    .innerJoin(tag, eq(tag.id, concursoTag.tagId))
    .where(inArray(concursoTag.concursoId, [...concursoIds]))
    .orderBy(asc(tag.nome));
  for (const { concursoId, nome } of linhas) {
    const lista = mapa.get(concursoId) ?? [];
    lista.push(nome);
    mapa.set(concursoId, lista);
  }
  return mapa;
}
