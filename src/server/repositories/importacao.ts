/**
 * Importação do backup JSON (RF09): substitui todos os dados do usuário (#49) em uma única
 * transação. Os dados de outros usuários não são tocados.
 *
 * Como as tabelas são compartilhadas entre usuários, os IDs do arquivo não são preservados: os
 * concursos recebem IDs novos (mantendo a ordem do arquivo) e as filhas são religadas a eles;
 * as tags são reaproveitadas pelo nome. Os eventos também recebem IDs novos, explícitos, para
 * religar o estado das notificações (#65), cuja chave usa o ID do evento.
 */
import { asc, eq, inArray, max } from "drizzle-orm";
import { chaveNotificacao } from "@/domain/notificacoes";
import { montarBuscaNormalizada } from "@/lib/normalize";
import type { Backup } from "@/lib/schemas/backup";
import type { Db } from "../db/client";
import {
  anexo,
  concurso,
  concursoTag,
  evento,
  link,
  notificacaoEstado,
  regraNotificacao,
  resultadoFase,
  statusHistorico,
  tag,
} from "../db/schema";
import { serializarAntecedencias } from "./notificacoes";
import { removerTagsOrfas } from "./tags";
import type { Transacao } from "./tipos";

/** Linhas por INSERT (mantém o número de parâmetros bem abaixo do limite do SQLite). */
const LOTE = 200;

export interface ResumoImportacao {
  concursos: number;
  tags: number;
  links: number;
  eventos: number;
  statusHistorico: number;
  resultadosFase: number;
  anexos: number;
}

type TabelaImportada =
  | typeof concurso
  | typeof concursoTag
  | typeof link
  | typeof evento
  | typeof statusHistorico
  | typeof resultadoFase
  | typeof anexo
  | typeof notificacaoEstado
  | typeof regraNotificacao;

async function inserirEmLotes<T extends TabelaImportada>(
  tx: Transacao,
  tabela: T,
  linhas: readonly T["$inferInsert"][],
): Promise<void> {
  for (let i = 0; i < linhas.length; i += LOTE) {
    await tx.insert(tabela).values(linhas.slice(i, i + LOTE) as T["$inferInsert"][]);
  }
}

/** Ordena por `id` do arquivo (preserva a ordem relativa nos IDs novos). */
const porId = <L extends { id: number }>(linhas: readonly L[]) =>
  [...linhas].sort((a, b) => a.id - b.id);

/**
 * Apaga os dados atuais do usuário e grava os do backup (já validado por `validarBackup`).
 * Tudo ou nada: qualquer falha desfaz a importação inteira.
 */
export async function substituirTudo(
  db: Db,
  usuarioId: number,
  backup: Backup,
): Promise<ResumoImportacao> {
  const { dados } = backup;
  const nomeTag = new Map(dados.tags.map((t) => [t.id, t.nome]));
  const tagsDoConcurso = new Map<number, string[]>();
  for (const { concursoId, tagId } of dados.concursoTags) {
    const nome = nomeTag.get(tagId);
    if (nome) tagsDoConcurso.set(concursoId, [...(tagsDoConcurso.get(concursoId) ?? []), nome]);
  }

  await db.transaction(async (tx) => {
    const doUsuario = tx
      .select({ id: concurso.id })
      .from(concurso)
      .where(eq(concurso.usuarioId, usuarioId));
    // Filhas primeiro (independe de ON DELETE CASCADE estar ativo).
    for (const tabela of [
      notificacaoEstado,
      concursoTag,
      anexo,
      resultadoFase,
      statusHistorico,
      evento,
      link,
    ]) {
      await tx.delete(tabela).where(inArray(tabela.concursoId, doUsuario));
    }
    await tx.delete(concurso).where(eq(concurso.usuarioId, usuarioId));
    await tx.delete(regraNotificacao).where(eq(regraNotificacao.usuarioId, usuarioId));

    // IDs novos a partir do maior existente: a transação de escrita impede inserções paralelas.
    const [ultimo] = await tx.select({ id: max(concurso.id) }).from(concurso);
    let proximo = (ultimo?.id ?? 0) + 1;
    const novoId = new Map<number, number>();
    for (const c of porId(dados.concursos)) novoId.set(c.id, proximo++);
    const religar = <L extends { id: number; concursoId: number }>(linhas: readonly L[]) =>
      porId(linhas).map(({ id: _, concursoId, ...resto }) => ({
        ...resto,
        concursoId: novoId.get(concursoId) as number,
      }));

    await inserirEmLotes(
      tx,
      concurso,
      porId(dados.concursos).map((c) => ({
        ...c,
        id: novoId.get(c.id) as number,
        usuarioId,
        buscaNormalizada: montarBuscaNormalizada({
          ...c,
          tags: [...(tagsDoConcurso.get(c.id) ?? [])].sort(),
        }),
      })),
    );

    // Tags: vocabulário compartilhado; reaproveita as que já existem (de outros usuários).
    const nomes = [...new Set(porId(dados.tags).map((t) => t.nome))];
    const idTag = new Map<string, number>();
    for (let i = 0; i < nomes.length; i += LOTE) {
      await tx
        .insert(tag)
        .values(nomes.slice(i, i + LOTE).map((nome) => ({ nome })))
        .onConflictDoNothing({ target: tag.nome });
      const linhas = await tx
        .select({ id: tag.id, nome: tag.nome })
        .from(tag)
        .where(inArray(tag.nome, nomes.slice(i, i + LOTE)))
        .orderBy(asc(tag.id));
      for (const t of linhas) idTag.set(t.nome, t.id);
    }
    await inserirEmLotes(
      tx,
      concursoTag,
      dados.concursoTags.map(({ concursoId, tagId }) => ({
        concursoId: novoId.get(concursoId) as number,
        tagId: idTag.get(nomeTag.get(tagId) as string) as number,
      })),
    );
    await inserirEmLotes(tx, link, religar(dados.links));
    const [ultimoEvento] = await tx.select({ id: max(evento.id) }).from(evento);
    let proximoEvento = (ultimoEvento?.id ?? 0) + 1;
    const novoIdEvento = new Map<number, number>();
    for (const e of porId(dados.eventos)) novoIdEvento.set(e.id, proximoEvento++);
    await inserirEmLotes(
      tx,
      evento,
      porId(dados.eventos).map(({ id, concursoId, ...resto }) => ({
        ...resto,
        id: novoIdEvento.get(id) as number,
        concursoId: novoId.get(concursoId) as number,
      })),
    );
    await inserirEmLotes(tx, statusHistorico, religar(dados.statusHistorico));
    await inserirEmLotes(tx, resultadoFase, religar(dados.resultadosFase));
    await inserirEmLotes(tx, anexo, religar(dados.anexos));
    await inserirEmLotes(
      tx,
      regraNotificacao,
      dados.regrasNotificacao.map((r) => ({
        usuarioId,
        tipo: r.tipo,
        ativo: r.ativo,
        antecedencias: serializarAntecedencias(r.antecedencias),
      })),
    );
    await inserirEmLotes(
      tx,
      notificacaoEstado,
      dados.notificacoes.map((n) => {
        const concursoId = novoId.get(n.concursoId) as number;
        const eventoId = n.eventoId === null ? null : (novoIdEvento.get(n.eventoId) as number);
        return {
          ...n,
          concursoId,
          eventoId,
          chave: chaveNotificacao(
            eventoId === null ? `validade-${concursoId}` : `evento-${eventoId}`,
            n.antecedencia,
          ),
        };
      }),
    );
    await removerTagsOrfas(tx);
  });

  return {
    concursos: dados.concursos.length,
    tags: dados.tags.length,
    links: dados.links.length,
    eventos: dados.eventos.length,
    statusHistorico: dados.statusHistorico.length,
    resultadosFase: dados.resultadosFase.length,
    anexos: dados.anexos.length,
  };
}
