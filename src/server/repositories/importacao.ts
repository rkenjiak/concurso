/** Importação do backup JSON (RF09): substitui todos os dados em uma única transação. */
import { montarBuscaNormalizada } from "@/lib/normalize";
import type { Backup } from "@/lib/schemas/backup";
import type { Db } from "../db/client";
import {
  anexo,
  concurso,
  concursoTag,
  evento,
  link,
  resultadoFase,
  statusHistorico,
  tag,
} from "../db/schema";
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
  | typeof tag
  | typeof concursoTag
  | typeof link
  | typeof evento
  | typeof statusHistorico
  | typeof resultadoFase
  | typeof anexo;

async function inserirEmLotes<T extends TabelaImportada>(
  tx: Transacao,
  tabela: T,
  linhas: readonly T["$inferInsert"][],
): Promise<void> {
  for (let i = 0; i < linhas.length; i += LOTE) {
    await tx.insert(tabela).values(linhas.slice(i, i + LOTE) as T["$inferInsert"][]);
  }
}

/**
 * Apaga todos os dados atuais e grava os do backup (já validado por `validarBackup`),
 * preservando os IDs. Tudo ou nada: qualquer falha desfaz a importação inteira.
 */
export async function substituirTudo(db: Db, backup: Backup): Promise<ResumoImportacao> {
  const { dados } = backup;
  const nomeTag = new Map(dados.tags.map((t) => [t.id, t.nome]));
  const tagsDoConcurso = new Map<number, string[]>();
  for (const { concursoId, tagId } of dados.concursoTags) {
    const nome = nomeTag.get(tagId);
    if (nome) tagsDoConcurso.set(concursoId, [...(tagsDoConcurso.get(concursoId) ?? []), nome]);
  }

  await db.transaction(async (tx) => {
    // Filhas primeiro (independe de ON DELETE CASCADE estar ativo).
    for (const tabela of [concursoTag, anexo, resultadoFase, statusHistorico, evento, link]) {
      await tx.delete(tabela);
    }
    await tx.delete(tag);
    await tx.delete(concurso);

    await inserirEmLotes(
      tx,
      concurso,
      dados.concursos.map((c) => ({
        ...c,
        buscaNormalizada: montarBuscaNormalizada({
          ...c,
          tags: [...(tagsDoConcurso.get(c.id) ?? [])].sort(),
        }),
      })),
    );
    await inserirEmLotes(tx, tag, dados.tags);
    await inserirEmLotes(tx, concursoTag, dados.concursoTags);
    await inserirEmLotes(tx, link, dados.links);
    await inserirEmLotes(tx, evento, dados.eventos);
    await inserirEmLotes(tx, statusHistorico, dados.statusHistorico);
    await inserirEmLotes(tx, resultadoFase, dados.resultadosFase);
    await inserirEmLotes(tx, anexo, dados.anexos);
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
