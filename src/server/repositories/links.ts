/** Escritas de links (RF02). Toda operação é restrita ao concurso informado. */
import { and, eq, max } from "drizzle-orm";
import { ErroDominio } from "@/domain/erros";
import type { LinkDados } from "@/lib/schemas/link";
import type { Db } from "../db/client";
import { link } from "../db/schema";
import { listarLinks } from "../queries/links";
import { exigirConcurso } from "./eventos";
import type { Transacao } from "./tipos";

const NAO_ENCONTRADO = "Link não encontrado.";

/** Item de um lote: `id` nulo cria (no fim da lista); com `id`, atualiza o link existente. */
export interface ItemLink {
  id: number | null;
  dados: LinkDados;
}

/** Insere o link no fim da lista numa transação aberta (o concurso deve existir). */
export async function inserirLink(
  tx: Transacao,
  concursoId: number,
  dados: LinkDados,
): Promise<number> {
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
}

async function atualizarLinkTx(
  tx: Db | Transacao,
  concursoId: number,
  linkId: number,
  dados: LinkDados,
): Promise<void> {
  const linhas = await tx
    .update(link)
    .set(dados)
    .where(and(eq(link.id, linkId), eq(link.concursoId, concursoId)))
    .returning({ id: link.id });
  if (linhas.length === 0) throw new ErroDominio(NAO_ENCONTRADO);
}

/** Cria o link no fim da lista. Retorna o ID. */
export async function criarLink(db: Db, concursoId: number, dados: LinkDados): Promise<number> {
  return db.transaction(async (tx) => {
    await exigirConcurso(tx, concursoId);
    return inserirLink(tx, concursoId, dados);
  });
}

export async function atualizarLink(
  db: Db,
  concursoId: number,
  linkId: number,
  dados: LinkDados,
): Promise<void> {
  await atualizarLinkTx(db, concursoId, linkId, dados);
}

/**
 * Cria e atualiza vários links do concurso numa única transação (tudo ou nada). Nunca exclui.
 * Retorna os IDs na ordem dos itens.
 */
export async function salvarLinks(
  db: Db,
  concursoId: number,
  itens: readonly ItemLink[],
): Promise<number[]> {
  return db.transaction(async (tx) => {
    await exigirConcurso(tx, concursoId);
    const ids: number[] = [];
    for (const { id, dados } of itens) {
      if (id === null) {
        ids.push(await inserirLink(tx, concursoId, dados));
      } else {
        await atualizarLinkTx(tx, concursoId, id, dados);
        ids.push(id);
      }
    }
    return ids;
  });
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
