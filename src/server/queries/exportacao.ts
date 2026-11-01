/**
 * Exportação de todos os dados do usuário (RF09, #49): backup JSON versionado e CSV de
 * concursos. O dono (`usuario_id`) não entra no arquivo: a importação grava no usuário que importa.
 */
import { asc, eq, getTableColumns, inArray } from "drizzle-orm";
import { ROTULO_ESCOLARIDADE, ROTULO_ESFERA, ROTULO_STATUS } from "@/domain/labels";
import { centavosCsv, gerarCsv } from "@/lib/csv";
import { formatarData, formatarDataHora } from "@/lib/format";
import { APP_BACKUP, type BackupJson, VERSAO_BACKUP } from "@/lib/schemas/backup";
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
import type { Executor } from "../repositories/tipos";

/** Converte os `Date` de uma linha em strings ISO 8601 (formato do arquivo). */
function serializar<T extends Record<string, unknown>>(
  linha: T,
): {
  [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K];
} {
  return Object.fromEntries(
    Object.entries(linha).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
  ) as never;
}

/** Lê os dados do usuário e monta o backup JSON (ordenado por ID, para diffs estáveis). */
export async function exportarDados(
  db: Db | Executor,
  usuarioId: number,
  agora: Date = new Date(),
): Promise<BackupJson> {
  const { buscaNormalizada: _, usuarioId: __, ...colunasConcurso } = getTableColumns(concurso);
  const doUsuario = db
    .select({ id: concurso.id })
    .from(concurso)
    .where(eq(concurso.usuarioId, usuarioId));
  const [concursos, tags, concursoTags, links, eventos, historico, resultados, anexos] =
    await Promise.all([
      db
        .select(colunasConcurso)
        .from(concurso)
        .where(eq(concurso.usuarioId, usuarioId))
        .orderBy(asc(concurso.id)),
      db
        .selectDistinct({ id: tag.id, nome: tag.nome })
        .from(tag)
        .innerJoin(concursoTag, eq(concursoTag.tagId, tag.id))
        .where(inArray(concursoTag.concursoId, doUsuario))
        .orderBy(asc(tag.id)),
      db
        .select()
        .from(concursoTag)
        .where(inArray(concursoTag.concursoId, doUsuario))
        .orderBy(asc(concursoTag.concursoId), asc(concursoTag.tagId)),
      db.select().from(link).where(inArray(link.concursoId, doUsuario)).orderBy(asc(link.id)),
      db.select().from(evento).where(inArray(evento.concursoId, doUsuario)).orderBy(asc(evento.id)),
      db
        .select()
        .from(statusHistorico)
        .where(inArray(statusHistorico.concursoId, doUsuario))
        .orderBy(asc(statusHistorico.id)),
      db
        .select()
        .from(resultadoFase)
        .where(inArray(resultadoFase.concursoId, doUsuario))
        .orderBy(asc(resultadoFase.id)),
      db.select().from(anexo).where(inArray(anexo.concursoId, doUsuario)).orderBy(asc(anexo.id)),
    ]);

  return {
    app: APP_BACKUP,
    schemaVersion: VERSAO_BACKUP,
    exportadoEm: agora.toISOString(),
    dados: {
      concursos: concursos.map(serializar),
      tags,
      concursoTags,
      links: links.map(serializar),
      eventos: eventos.map(serializar),
      statusHistorico: historico.map(serializar),
      resultadosFase: resultados,
      anexos: anexos.map(serializar),
    },
  };
}

const CABECALHO_CSV = [
  "ID",
  "Órgão",
  "Cargo",
  "Banca",
  "Esfera",
  "UF",
  "Cidade",
  "Escolaridade",
  "Remuneração (R$)",
  "Taxa de inscrição (R$)",
  "Vagas (ampla)",
  "Vagas (cadastro reserva)",
  "Possui cadastro reserva",
  "Vagas (cotas)",
  "Status",
  "Status desde",
  "Homologação",
  "Validade (meses)",
  "Validade prorrogada",
  "Fim da validade (manual)",
  "Tags",
  "Observações",
  "Criado em",
  "Atualizado em",
] as const;

/** CSV dos concursos do usuário (uma linha por concurso, tags separadas por vírgula). */
export async function exportarConcursosCsv(db: Db | Executor, usuarioId: number): Promise<string> {
  const [concursos, tags] = await Promise.all([
    db.select().from(concurso).where(eq(concurso.usuarioId, usuarioId)).orderBy(asc(concurso.id)),
    db
      .select({ concursoId: concursoTag.concursoId, nome: tag.nome })
      .from(concursoTag)
      .innerJoin(tag, eq(tag.id, concursoTag.tagId))
      .innerJoin(concurso, eq(concurso.id, concursoTag.concursoId))
      .where(eq(concurso.usuarioId, usuarioId))
      .orderBy(asc(tag.nome)),
  ]);
  const tagsPorConcurso = new Map<number, string[]>();
  for (const { concursoId, nome } of tags) {
    tagsPorConcurso.set(concursoId, [...(tagsPorConcurso.get(concursoId) ?? []), nome]);
  }
  const vazio = (texto: string) => (texto === "—" ? "" : texto);

  return gerarCsv(
    CABECALHO_CSV,
    concursos.map((c) => [
      c.id,
      c.orgao,
      c.cargo,
      c.banca,
      c.esfera ? ROTULO_ESFERA[c.esfera] : null,
      c.uf,
      c.cidade,
      c.escolaridade ? ROTULO_ESCOLARIDADE[c.escolaridade] : null,
      centavosCsv(c.remuneracaoCentavos),
      centavosCsv(c.taxaInscricaoCentavos),
      c.vagasAmpla,
      c.vagasCadastroReserva,
      c.possuiCadastroReserva,
      c.vagasCotas,
      ROTULO_STATUS[c.status],
      vazio(formatarDataHora(c.statusDesde)),
      vazio(formatarData(c.homologacaoData)),
      c.validadeMeses,
      c.validadeProrrogada,
      vazio(formatarData(c.validadeFimManual)),
      (tagsPorConcurso.get(c.id) ?? []).join(", "),
      c.observacoes,
      vazio(formatarDataHora(c.createdAt)),
      vazio(formatarDataHora(c.updatedAt)),
    ]),
  );
}
