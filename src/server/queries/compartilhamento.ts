/**
 * Leitura pública do concurso compartilhado por token (#129).
 *
 * Usa DTO dedicado com `select({...})` explícito: nenhum dado privado (`observacoes`, `evento.local`,
 * `evento.observacao`, `status_historico.observacao`, links, resultados, anexos, tags, IDs internos
 * ou dados da conta do dono) é selecionado nem retornado. Ignora `ocultoDashboard`.
 *
 * Não depende de `headers()`, `cookies()` nem escreve no banco, preservando o ISR da rota pública.
 */
import { and, asc, eq } from "drizzle-orm";
import { type CorConcurso, corDoConcurso } from "@/domain/cores";
import type { Esfera, Status, TipoEvento } from "@/domain/enums";
import type { DadosValidade } from "@/domain/validade";
import { ehTokenCompartilhamentoValido } from "@/lib/compartilhamento";
import type { DataISO } from "@/lib/tz";
import { donoDoTokenAutorizado } from "../auth/autorizacao";
import type { ConfigAuth } from "../auth/config";
import { compartilhamentoConcurso, concurso, evento, statusHistorico, usuario } from "../db/schema";
import type { Executor } from "../repositories/tipos";

export interface CompartilhamentoAtivo {
  token: string;
  createdAt: Date;
}

/**
 * Link de compartilhamento ativo do concurso, conferindo o dono (#49, #129). Retorna `null` se
 * o concurso não estiver compartilhado ou pertencer a outro usuário.
 */
export async function obterCompartilhamentoDoConcurso(
  db: Executor,
  usuarioId: number,
  concursoId: number,
): Promise<CompartilhamentoAtivo | null> {
  const [linha] = await db
    .select({
      token: compartilhamentoConcurso.token,
      createdAt: compartilhamentoConcurso.createdAt,
    })
    .from(compartilhamentoConcurso)
    .innerJoin(concurso, eq(concurso.id, compartilhamentoConcurso.concursoId))
    .where(
      and(eq(compartilhamentoConcurso.concursoId, concursoId), eq(concurso.usuarioId, usuarioId)),
    )
    .limit(1);
  return linha ?? null;
}

export interface EventoCompartilhado {
  tipo: TipoEvento;
  titulo: string | null;
  data: DataISO;
  hora: string | null;
  concluido: boolean;
}

export interface StatusHistoricoCompartilhado {
  de: Status | null;
  para: Status;
  alteradoEm: Date;
}

export interface ConcursoCompartilhado {
  orgao: string;
  cargo: string;
  banca: string | null;
  esfera: Esfera | null;
  uf: string | null;
  cidade: string | null;
  status: Status;
  statusDesde: Date;
  cor: CorConcurso;
  icone: string | null;
  validade: DadosValidade;
  eventos: EventoCompartilhado[];
  historico: StatusHistoricoCompartilhado[];
}

/**
 * Obtém os dados públicos do concurso pelo token opaco, ou `null` se o token tiver formato
 * inválido, não existir ou o dono não estiver mais autorizado ({@link donoDoTokenAutorizado}).
 */
export async function obterConcursoCompartilhado(
  db: Executor,
  config: ConfigAuth,
  token: string,
): Promise<ConcursoCompartilhado | null> {
  if (!ehTokenCompartilhamentoValido(token)) return null;

  const [linha] = await db
    .select({
      concursoId: concurso.id,
      orgao: concurso.orgao,
      cargo: concurso.cargo,
      banca: concurso.banca,
      esfera: concurso.esfera,
      uf: concurso.uf,
      cidade: concurso.cidade,
      status: concurso.status,
      statusDesde: concurso.statusDesde,
      cor: concurso.cor,
      icone: concurso.icone,
      homologacaoData: concurso.homologacaoData,
      validadeMeses: concurso.validadeMeses,
      validadeProrrogada: concurso.validadeProrrogada,
      validadeFimManual: concurso.validadeFimManual,
      donoId: usuario.id,
      donoEmail: usuario.email,
      donoPapel: usuario.papel,
      donoBloqueadoEm: usuario.bloqueadoEm,
    })
    .from(compartilhamentoConcurso)
    .innerJoin(concurso, eq(concurso.id, compartilhamentoConcurso.concursoId))
    .innerJoin(usuario, eq(usuario.id, concurso.usuarioId))
    .where(eq(compartilhamentoConcurso.token, token))
    .limit(1);

  if (!linha) return null;

  const autorizado = await donoDoTokenAutorizado(db, config, {
    id: linha.donoId,
    email: linha.donoEmail,
    papel: linha.donoPapel,
    bloqueadoEm: linha.donoBloqueadoEm,
  });
  if (!autorizado) return null;

  const [eventos, historico] = await Promise.all([
    db
      .select({
        tipo: evento.tipo,
        titulo: evento.titulo,
        data: evento.data,
        hora: evento.hora,
        concluido: evento.concluido,
      })
      .from(evento)
      .where(eq(evento.concursoId, linha.concursoId))
      .orderBy(asc(evento.data), asc(evento.hora), asc(evento.id)),
    db
      .select({
        de: statusHistorico.de,
        para: statusHistorico.para,
        alteradoEm: statusHistorico.alteradoEm,
      })
      .from(statusHistorico)
      .where(eq(statusHistorico.concursoId, linha.concursoId))
      .orderBy(asc(statusHistorico.alteradoEm), asc(statusHistorico.id)),
  ]);

  return {
    orgao: linha.orgao,
    cargo: linha.cargo,
    banca: linha.banca,
    esfera: linha.esfera,
    uf: linha.uf,
    cidade: linha.cidade,
    status: linha.status,
    statusDesde: linha.statusDesde,
    cor: corDoConcurso({ id: linha.concursoId, cor: linha.cor }),
    icone: linha.icone,
    validade: {
      homologacaoData: linha.homologacaoData,
      validadeMeses: linha.validadeMeses,
      validadeProrrogada: linha.validadeProrrogada,
      validadeFimManual: linha.validadeFimManual,
    },
    eventos: eventos.map((e) => ({
      tipo: e.tipo,
      titulo: e.titulo,
      data: e.data,
      hora: e.hora,
      concluido: e.concluido,
    })),
    historico: historico.map((h) => ({
      de: h.de,
      para: h.para,
      alteradoEm: h.alteradoEm,
    })),
  };
}
