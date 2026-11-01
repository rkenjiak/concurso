/**
 * Escritas de concurso (RF01). Todas as funções recebem o banco por parâmetro (testáveis com
 * `:memory:`) e mantêm `busca_normalizada` atualizada (órgão + cargo + banca + tags).
 */
import { eq } from "drizzle-orm";
import { montarBuscaNormalizada } from "@/lib/normalize";
import type { ConcursoDados, ConcursoEdicaoDados } from "@/lib/schemas/concurso";
import type { EventoDados } from "@/lib/schemas/evento";
import type { LinkDados } from "@/lib/schemas/link";
import type { Db } from "../db/client";
import { concurso, statusHistorico } from "../db/schema";
import { inserirEvento } from "./eventos";
import { inserirLink } from "./links";
import { removerTagsOrfas, sincronizarTags } from "./tags";
import type { Transacao } from "./tipos";

function colunas(dados: ConcursoEdicaoDados) {
  return {
    orgao: dados.orgao,
    cargo: dados.cargo,
    banca: dados.banca,
    esfera: dados.esfera,
    uf: dados.uf,
    cidade: dados.cidade,
    escolaridade: dados.escolaridade,
    remuneracaoCentavos: dados.remuneracao,
    taxaInscricaoCentavos: dados.taxaInscricao,
    vagasAmpla: dados.vagasAmpla,
    vagasCadastroReserva: dados.vagasCadastroReserva,
    possuiCadastroReserva: dados.possuiCadastroReserva,
    vagasCotas: dados.vagasCotas,
    observacoes: dados.observacoes,
    cor: dados.cor,
    icone: dados.icone,
    homologacaoData: dados.homologacaoData,
    validadeMeses: dados.validadeMeses,
    validadeProrrogada: dados.validadeProrrogada,
    validadeFimManual: dados.validadeFimManual,
    buscaNormalizada: montarBuscaNormalizada(dados),
  };
}

/** Insere o concurso, suas tags e o registro inicial do histórico numa transação aberta. */
export async function inserirConcurso(
  tx: Transacao,
  dados: ConcursoDados,
  agora: Date,
): Promise<number> {
  const [linha] = await tx
    .insert(concurso)
    .values({ ...colunas(dados), status: dados.status, statusDesde: agora })
    .returning({ id: concurso.id });
  if (!linha) throw new Error("Falha ao inserir o concurso.");
  await tx
    .insert(statusHistorico)
    .values({ concursoId: linha.id, de: null, para: dados.status, alteradoEm: agora });
  await sincronizarTags(tx, linha.id, dados.tags);
  return linha.id;
}

/** Cria o concurso, suas tags e o registro inicial do histórico (`de = null`). Retorna o ID. */
export async function criarConcurso(
  db: Db,
  dados: ConcursoDados,
  agora: Date = new Date(),
): Promise<number> {
  return db.transaction((tx) => inserirConcurso(tx, dados, agora));
}

/**
 * Cria o concurso com seus eventos e links numa única transação (tudo ou nada) — usado pelo
 * cadastro a partir do edital (MCP). Os links entram na ordem informada. Retorna o ID.
 */
export async function criarConcursoCompleto(
  db: Db,
  dados: ConcursoDados,
  eventos: readonly EventoDados[],
  links: readonly LinkDados[],
  agora: Date = new Date(),
): Promise<number> {
  return db.transaction(async (tx) => {
    const id = await inserirConcurso(tx, dados, agora);
    for (const e of eventos) await inserirEvento(tx, id, e, agora);
    for (const l of links) await inserirLink(tx, id, l);
    return id;
  });
}

/**
 * Atualiza os dados cadastrais e as tags (não altera o status).
 * Retorna `false` se o concurso não existe.
 */
export async function atualizarConcurso(
  db: Db,
  id: number,
  dados: ConcursoEdicaoDados,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const linhas = await tx
      .update(concurso)
      .set(colunas(dados))
      .where(eq(concurso.id, id))
      .returning({ id: concurso.id });
    if (linhas.length === 0) return false;
    await sincronizarTags(tx, id, dados.tags);
    return true;
  });
}

/** Exclui o concurso (links, eventos, histórico etc. em cascata) e as tags que ficarem órfãs. */
export async function excluirConcurso(db: Db, id: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const linhas = await tx
      .delete(concurso)
      .where(eq(concurso.id, id))
      .returning({ id: concurso.id });
    if (linhas.length === 0) return false;
    await removerTagsOrfas(tx);
    return true;
  });
}
