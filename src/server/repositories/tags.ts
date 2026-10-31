/** Tags livres (RF01, ARQUITETURA.md §3.6). */
import { eq, inArray, notExists } from "drizzle-orm";
import { normalizarTag } from "@/lib/normalize";
import { concursoTag, tag } from "../db/schema";
import type { Executor } from "./tipos";

/**
 * Substitui as tags do concurso pelas informadas (criando as novas e reaproveitando as
 * existentes) e remove tags órfãs. Retorna os nomes normalizados, sem repetição.
 */
export async function sincronizarTags(
  db: Executor,
  concursoId: number,
  nomes: readonly string[],
): Promise<string[]> {
  const normalizados = [...new Set(nomes.map(normalizarTag).filter((n) => n !== ""))];

  await db.delete(concursoTag).where(eq(concursoTag.concursoId, concursoId));
  if (normalizados.length > 0) {
    await db
      .insert(tag)
      .values(normalizados.map((nome) => ({ nome })))
      .onConflictDoNothing({ target: tag.nome });
    const existentes = await db
      .select({ id: tag.id })
      .from(tag)
      .where(inArray(tag.nome, normalizados));
    await db.insert(concursoTag).values(existentes.map((t) => ({ concursoId, tagId: t.id })));
  }
  await removerTagsOrfas(db);
  return normalizados;
}

/** Remove tags que não estão associadas a nenhum concurso. */
export async function removerTagsOrfas(db: Executor): Promise<void> {
  await db
    .delete(tag)
    .where(
      notExists(
        db.select({ um: concursoTag.tagId }).from(concursoTag).where(eq(concursoTag.tagId, tag.id)),
      ),
    );
}
