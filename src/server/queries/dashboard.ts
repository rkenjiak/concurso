/** Leituras do dashboard (RF06). */
import { and, asc, count, eq, lte, or } from "drizzle-orm";
import { STATUS, type Status } from "@/domain/enums";
import {
  type GruposPrazos,
  JANELA_PADRAO_DIAS,
  proximosPrazos,
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
}

export interface ContagemStatus {
  status: Status;
  quantidade: number;
}

export interface Dashboard {
  prazos: GruposPrazos<EventoDoPrazo, ConcursoDoPrazo>;
  totalPrazos: number;
  /** Apenas status com ao menos um concurso, na ordem do enum. */
  porStatus: ContagemStatus[];
  totalConcursos: number;
}

/** Contagem de concursos por status (somente status presentes), na ordem do enum `STATUS`. */
export async function contarPorStatus(db: Db): Promise<ContagemStatus[]> {
  const linhas = await db
    .select({ status: concurso.status, quantidade: count() })
    .from(concurso)
    .groupBy(concurso.status);
  const mapa = new Map(linhas.map((l) => [l.status, l.quantidade]));
  return STATUS.filter((s) => (mapa.get(s) ?? 0) > 0).map((status) => ({
    status,
    quantidade: mapa.get(status) ?? 0,
  }));
}

/**
 * Dados do dashboard para o dia `hoje` (America/Sao_Paulo). Lê só eventos pendentes até o fim da
 * janela (e todos os de validade, que suprimem o pseudo-evento); o agrupamento fica no domínio.
 */
export async function obterDashboard(
  db: Db,
  hoje: DataISO,
  janelaDias: number = JANELA_PADRAO_DIAS,
): Promise<Dashboard> {
  const limite = somarDias(hoje, janelaDias);
  const [concursos, eventos, porStatus] = await Promise.all([
    db
      .select({
        id: concurso.id,
        orgao: concurso.orgao,
        cargo: concurso.cargo,
        status: concurso.status,
        homologacaoData: concurso.homologacaoData,
        validadeMeses: concurso.validadeMeses,
        validadeProrrogada: concurso.validadeProrrogada,
        validadeFimManual: concurso.validadeFimManual,
      })
      .from(concurso),
    db
      .select({
        id: evento.id,
        concursoId: evento.concursoId,
        tipo: evento.tipo,
        titulo: evento.titulo,
        data: evento.data,
        hora: evento.hora,
        local: evento.local,
        concluido: evento.concluido,
      })
      .from(evento)
      .where(
        or(and(eq(evento.concluido, false), lte(evento.data, limite)), eq(evento.tipo, "VALIDADE")),
      )
      .orderBy(asc(evento.data), asc(evento.id)),
    contarPorStatus(db),
  ]);
  const prazos = proximosPrazos(
    eventos,
    concursos.map(
      ({ homologacaoData, validadeMeses, validadeProrrogada, validadeFimManual, ...c }) => ({
        ...c,
        validadeFim: calcularValidadeFim({
          homologacaoData,
          validadeMeses,
          validadeProrrogada,
          validadeFimManual,
        }),
      }),
    ),
    hoje,
    janelaDias,
  );
  return {
    prazos,
    totalPrazos: totalPrazos(prazos),
    porStatus,
    totalConcursos: porStatus.reduce((soma, s) => soma + s.quantidade, 0),
  };
}
