/**
 * Leituras de tags (RF01). A tabela `tag` é um vocabulário compartilhado (só nomes); cada usuário
 * enxerga apenas as tags usadas nos próprios concursos (#49).
 */
import { asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { concurso, concursoTag, tag } from "../db/schema";

/** Tags usadas nos concursos do usuário, em ordem alfabética (sugestões no formulário). */
export async function listarTags(db: Db, usuarioId: number): Promise<string[]> {
  const linhas = await db
    .selectDistinct({ nome: tag.nome })
    .from(tag)
    .innerJoin(concursoTag, eq(concursoTag.tagId, tag.id))
    .innerJoin(concurso, eq(concurso.id, concursoTag.concursoId))
    .where(eq(concurso.usuarioId, usuarioId))
    .orderBy(asc(tag.nome));
  return linhas.map((l) => l.nome);
}

/** Tags agrupadas por concurso, em ordem alfabética (IDs já restritos ao usuário). */
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
