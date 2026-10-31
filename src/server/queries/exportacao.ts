/** Exportação de todos os dados (RF09): backup JSON versionado e CSV de concursos. */
import { asc, eq, getTableColumns } from "drizzle-orm";
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

/** Lê todas as tabelas e monta o backup JSON (ordenado por ID, para diffs estáveis). */
export async function exportarDados(
  db: Db | Executor,
  agora: Date = new Date(),
): Promise<BackupJson> {
  const { buscaNormalizada: _, ...colunasConcurso } = getTableColumns(concurso);
  const [concursos, tags, concursoTags, links, eventos, historico, resultados, anexos] =
    await Promise.all([
      db.select(colunasConcurso).from(concurso).orderBy(asc(concurso.id)),
      db.select().from(tag).orderBy(asc(tag.id)),
      db.select().from(concursoTag).orderBy(asc(concursoTag.concursoId), asc(concursoTag.tagId)),
      db.select().from(link).orderBy(asc(link.id)),
      db.select().from(evento).orderBy(asc(evento.id)),
      db.select().from(statusHistorico).orderBy(asc(statusHistorico.id)),
      db.select().from(resultadoFase).orderBy(asc(resultadoFase.id)),
      db.select().from(anexo).orderBy(asc(anexo.id)),
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

/** CSV dos concursos (uma linha por concurso, tags separadas por vírgula). */
export async function exportarConcursosCsv(db: Db | Executor): Promise<string> {
  const [concursos, tags] = await Promise.all([
    db.select().from(concurso).orderBy(asc(concurso.id)),
    db
      .select({ concursoId: concursoTag.concursoId, nome: tag.nome })
      .from(concursoTag)
      .innerJoin(tag, eq(tag.id, concursoTag.tagId))
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
