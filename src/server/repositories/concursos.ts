/**
 * Escritas de concurso (RF01). Todas as funções recebem o banco por parâmetro (testáveis com
 * `:memory:`) e mantêm `busca_normalizada` atualizada.
 */
import { eq } from "drizzle-orm";
import { montarBuscaNormalizada } from "@/lib/normalize";
import type { ConcursoDados, ConcursoEdicaoDados } from "@/lib/schemas/concurso";
import type { Db } from "../db/client";
import { concurso, statusHistorico } from "../db/schema";

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
    buscaNormalizada: montarBuscaNormalizada(dados),
  };
}

/** Cria o concurso e o registro inicial do histórico de status (`de = null`). Retorna o ID. */
export async function criarConcurso(
  db: Db,
  dados: ConcursoDados,
  agora: Date = new Date(),
): Promise<number> {
  return db.transaction(async (tx) => {
    const [linha] = await tx
      .insert(concurso)
      .values({ ...colunas(dados), status: dados.status, statusDesde: agora })
      .returning({ id: concurso.id });
    if (!linha) throw new Error("Falha ao inserir o concurso.");
    await tx
      .insert(statusHistorico)
      .values({ concursoId: linha.id, de: null, para: dados.status, alteradoEm: agora });
    return linha.id;
  });
}

/** Atualiza os dados cadastrais (não altera o status). Retorna `false` se o concurso não existe. */
export async function atualizarConcurso(
  db: Db,
  id: number,
  dados: ConcursoEdicaoDados,
): Promise<boolean> {
  const linhas = await db
    .update(concurso)
    .set(colunas(dados))
    .where(eq(concurso.id, id))
    .returning({ id: concurso.id });
  return linhas.length > 0;
}

/** Exclui o concurso e, em cascata, links, eventos, histórico etc. */
export async function excluirConcurso(db: Db, id: number): Promise<boolean> {
  const linhas = await db
    .delete(concurso)
    .where(eq(concurso.id, id))
    .returning({ id: concurso.id });
  return linhas.length > 0;
}
