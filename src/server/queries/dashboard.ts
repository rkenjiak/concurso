/** Leituras do dashboard (RF06), restritas aos concursos do usuário (#49). */
import { and, asc, count, eq, inArray, lte, or } from "drizzle-orm";
import { type CorConcurso, corDoConcurso } from "@/domain/cores";
import { STATUS, type Status } from "@/domain/enums";
import {
  contarOcultos,
  type GruposPrazos,
  JANELA_PADRAO_DIAS,
  proximosPrazos,
  semOcultos,
  totalPrazos,
} from "@/domain/prazos";
import { calcularValidadeFim } from "@/domain/validade";
import { type DataISO, somarDias } from "@/lib/tz";
import type { Db } from "../db/client";
import { concurso, evento } from "../db/schema";

export interface ConcursoDoPrazo {
  id: number;
  orgao: string;
  cargo: string;
  status: Status;
  /** Fim da validade (§4.3), calculado a partir dos dados do concurso; `null` se indefinida. */
  validadeFim: DataISO | null;
  /** Pseudo-evento de validade oculto do dashboard (#44). */
  validadeOcultaDashboard: boolean;
  /** Cor exibida (#46): a escolhida ou, se não houver, a automática derivada do ID. */
  cor: CorConcurso;
  /** Ícone (emoji) opcional (#46). */
  icone: string | null;
}

export interface EventoDoPrazo {
  id: number;
  concursoId: number;
  tipo: (typeof evento.$inferSelect)["tipo"];
  titulo: string | null;
  data: DataISO;
  hora: string | null;
  local: string | null;
  concluido: boolean;
  /** Oculto do dashboard (#44). */
  ocultoDashboard: boolean;
}

export interface ContagemStatus {
  status: Status;
  quantidade: number;
}

export interface Dashboard {
  /** Todos os prazos da janela, inclusive os ocultos (`prazo.oculto`); filtre com `semOcultos`. */
  prazos: GruposPrazos<EventoDoPrazo, ConcursoDoPrazo>;
  /** Total de prazos visíveis (não ocultos). */
  totalPrazos: number;
  /** Prazos da janela ocultos pelo usuário (#44). */
  ocultos: number;
  /** Apenas status com ao menos um concurso, na ordem do enum. */
  porStatus: ContagemStatus[];
  totalConcursos: number;
}

/** Contagem de concursos por status (somente status presentes), na ordem do enum `STATUS`. */
export async function contarPorStatus(db: Db, usuarioId: number): Promise<ContagemStatus[]> {
  const linhas = await db
    .select({ status: concurso.status, quantidade: count() })
    .from(concurso)
    .where(eq(concurso.usuarioId, usuarioId))
    .groupBy(concurso.status);
  const mapa = new Map(linhas.map((l) => [l.status, l.quantidade]));
  return STATUS.filter((s) => (mapa.get(s) ?? 0) > 0).map((status) => ({
    status,
    quantidade: mapa.get(status) ?? 0,
  }));
}

/** Concursos com o fim da validade já calculado (§4.3), para prazos e calendário. */
export async function listarConcursosDoPrazo(
  db: Db,
  usuarioId: number,
): Promise<ConcursoDoPrazo[]> {
  const linhas = await db
    .select({
      id: concurso.id,
      orgao: concurso.orgao,
      cargo: concurso.cargo,
      status: concurso.status,
      homologacaoData: concurso.homologacaoData,
      validadeMeses: concurso.validadeMeses,
      validadeProrrogada: concurso.validadeProrrogada,
      validadeFimManual: concurso.validadeFimManual,
      validadeOcultaDashboard: concurso.validadeOcultaDashboard,
      cor: concurso.cor,
      icone: concurso.icone,
    })
    .from(concurso)
    .where(eq(concurso.usuarioId, usuarioId));
  return linhas.map(
    ({ homologacaoData, validadeMeses, validadeProrrogada, validadeFimManual, ...c }) => ({
      ...c,
      cor: corDoConcurso(c),
      validadeFim: calcularValidadeFim({
        homologacaoData,
        validadeMeses,
        validadeProrrogada,
        validadeFimManual,
      }),
    }),
  );
}

/** Condição: o evento é de um concurso do usuário. */
export function eventoDoUsuario(db: Db, usuarioId: number) {
  return inArray(
    evento.concursoId,
    db.select({ id: concurso.id }).from(concurso).where(eq(concurso.usuarioId, usuarioId)),
  );
}

/** Colunas de evento usadas por prazos e calendário. */
export const COLUNAS_EVENTO_PRAZO = {
  id: evento.id,
  concursoId: evento.concursoId,
  tipo: evento.tipo,
  titulo: evento.titulo,
  data: evento.data,
  hora: evento.hora,
  local: evento.local,
  concluido: evento.concluido,
  ocultoDashboard: evento.ocultoDashboard,
};

/**
 * Dados do dashboard para o dia `hoje` (America/Sao_Paulo). Lê só eventos pendentes até o fim da
 * janela (e todos os de validade, que suprimem o pseudo-evento); o agrupamento fica no domínio.
 */
export async function obterDashboard(
  db: Db,
  usuarioId: number,
  hoje: DataISO,
  janelaDias: number = JANELA_PADRAO_DIAS,
): Promise<Dashboard> {
  const limite = somarDias(hoje, janelaDias);
  const [concursos, eventos, porStatus] = await Promise.all([
    listarConcursosDoPrazo(db, usuarioId),
    db
      .select(COLUNAS_EVENTO_PRAZO)
      .from(evento)
      .where(
        and(
          eventoDoUsuario(db, usuarioId),
          or(
            and(eq(evento.concluido, false), lte(evento.data, limite)),
            eq(evento.tipo, "VALIDADE"),
          ),
        ),
      )
      .orderBy(asc(evento.data), asc(evento.id)),
    contarPorStatus(db, usuarioId),
  ]);
  const prazos = proximosPrazos(eventos, concursos, hoje, janelaDias);
  return {
    prazos,
    totalPrazos: totalPrazos(semOcultos(prazos)),
    ocultos: contarOcultos(prazos),
    porStatus,
    totalConcursos: porStatus.reduce((soma, s) => soma + s.quantidade, 0),
  };
}
