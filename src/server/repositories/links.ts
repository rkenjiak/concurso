/** Escritas de links (RF02). Toda operação é restrita ao concurso informado. */
import { and, eq, max } from "drizzle-orm";
import { ErroDominio } from "@/domain/erros";
import type { LinkDados } from "@/lib/schemas/link";
import type { Db } from "../db/client";
import { concurso, link } from "../db/schema";
import { listarLinks } from "../queries/links";

const NAO_ENCONTRADO = "Link não encontrado.";

/** Cria o link no fim da lista. Retorna o ID. */
export async function criarLink(db: Db, concursoId: number, dados: LinkDados): Promise<number> {
  return db.transaction(async (tx) => {
    const [existe] = await tx
      .select({ id: concurso.id })
      .from(concurso)
      .where(eq(concurso.id, concursoId));
    if (!existe) throw new ErroDominio("Concurso não encontrado.");
    const [ultimo] = await tx
      .select({ ordem: max(link.ordem) })
      .from(link)
      .where(eq(link.concursoId, concursoId));
    const [novo] = await tx
      .insert(link)
      .values({ ...dados, concursoId, ordem: (ultimo?.ordem ?? -1) + 1 })
      .returning({ id: link.id });
    if (!novo) throw new Error("Falha ao inserir o link.");
    return novo.id;
  });
}

export async function atualizarLink(
  db: Db,
  concursoId: number,
  linkId: number,
  dados: LinkDados,
): Promise<void> {
  const linhas = await db
    .update(link)
    .set(dados)
    .where(and(eq(link.id, linkId), eq(link.concursoId, concursoId)))
    .returning({ id: link.id });
  if (linhas.length === 0) throw new ErroDominio(NAO_ENCONTRADO);
}

export async function excluirLink(db: Db, concursoId: number, linkId: number): Promise<void> {
  const linhas = await db
    .delete(link)
    .where(and(eq(link.id, linkId), eq(link.concursoId, concursoId)))
    .returning({ id: link.id });
  if (linhas.length === 0) throw new ErroDominio(NAO_ENCONTRADO);
}

/** Define a nova ordem: `ids` deve conter exatamente os links do concurso. */
export async function reordenarLinks(
  db: Db,
  concursoId: number,
  ids: readonly number[],
): Promise<void> {
  await db.transaction(async (tx) => {
    const atuais = (await listarLinks(tx, concursoId)).map((l) => l.id);
    const mesmoConjunto =
      atuais.length === ids.length && new Set([...atuais, ...ids]).size === atuais.length;
    if (!mesmoConjunto) throw new ErroDominio("A lista de links mudou. Recarregue a página.");
    for (const [ordem, id] of ids.entries()) {
      await tx
        .update(link)
        .set({ ordem })
        .where(and(eq(link.id, id), eq(link.concursoId, concursoId)));
    }
  });
}
