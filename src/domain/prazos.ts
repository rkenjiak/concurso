/**
 * Próximos prazos (RF06, ARQUITETURA.md §4.2). Funções puras: sem Next, sem banco e sem relógio —
 * `hoje` (data de calendário em America/Sao_Paulo, `YYYY-MM-DD`) é sempre parâmetro.
 */
import { type DataISO, diasEntre, ehDataISO } from "../lib/tz";
import type { Status, TipoEvento } from "./enums";
import { ROTULO_TIPO_EVENTO } from "./labels";
import { ehAtivo } from "./status";

/** Janela padrão de "próximos dias" do dashboard. */
export const JANELA_PADRAO_DIAS = 30;

/** Faltando até este número de dias (inclusive), um prazo crítico tem criticidade alta. */
export const DIAS_CRITICIDADE_ALTA = 3;
/** Faltando até este número de dias (inclusive), um prazo crítico tem criticidade média. */
export const DIAS_CRITICIDADE_MEDIA = 7;

/** Tipos de evento cujo atraso causa prejuízo (perder inscrição, prova, recurso, posse…). */
export const TIPOS_CRITICOS = [
  "FIM_INSCRICOES",
  "PEDIDO_ISENCAO",
  "VENCIMENTO_BOLETO",
  "PROVA_OBJETIVA",
  "PROVA_DISCURSIVA",
  "OUTRA_FASE",
  "PRAZO_RECURSO",
  "POSSE",
] as const satisfies readonly TipoEvento[];

export type Criticidade = "ALTA" | "MEDIA" | "NORMAL";

const PESO_CRITICIDADE: Readonly<Record<Criticidade, number>> = { ALTA: 0, MEDIA: 1, NORMAL: 2 };

export function ehTipoCritico(tipo: TipoEvento): boolean {
  return (TIPOS_CRITICOS as readonly TipoEvento[]).includes(tipo);
}

/**
 * Criticidade de um evento faltando `dias` dias (negativo = vencido). Só tipos críticos recebem
 * destaque: ≤ 3 dias (inclui hoje e vencidos) = alta, ≤ 7 dias = média.
 */
export function criticidade(tipo: TipoEvento, dias: number): Criticidade {
  if (!ehTipoCritico(tipo)) return "NORMAL";
  if (dias <= DIAS_CRITICIDADE_ALTA) return "ALTA";
  if (dias <= DIAS_CRITICIDADE_MEDIA) return "MEDIA";
  return "NORMAL";
}

/**
 * Nome exibido de um prazo/evento em todas as telas (#100): título do evento, rótulo do tipo ou
 * "Fim da validade do concurso" para o pseudo-evento derivado.
 */
export function nomePrazo(p: {
  tipo: TipoEvento;
  titulo: string | null;
  derivado?: boolean;
}): string {
  if (p.derivado) return "Fim da validade do concurso";
  return p.titulo ?? ROTULO_TIPO_EVENTO[p.tipo];
}

/**
 * Situação de um prazo exibida no badge (#100, D11), em ordem de precedência: concluído > vencido
 * > urgente > esta semana > prazo crítico.
 */
export type SituacaoPrazo = "CONCLUIDO" | "VENCIDO" | "URGENTE" | "ESTA_SEMANA" | "CRITICO";

export const ROTULO_SITUACAO: Readonly<Record<SituacaoPrazo, string>> = {
  CONCLUIDO: "Concluído",
  VENCIDO: "Vencido",
  URGENTE: "Urgente",
  ESTA_SEMANA: "Esta semana",
  CRITICO: "Prazo crítico",
};

/**
 * Regra única da situação de um prazo (#100, D11). Só prazos de tipo crítico, pendentes e de
 * concurso acompanhado ({@link concursoAcompanhado}) recebem destaque: vencido (data passada),
 * urgente (≤ {@link DIAS_CRITICIDADE_ALTA} dias), esta semana (≤ {@link DIAS_CRITICIDADE_MEDIA}
 * dias) ou apenas "prazo crítico". Concluído vale para qualquer evento. `null` = sem badge.
 */
export function situacaoPrazo(p: {
  tipo: TipoEvento;
  /** Dias de hoje até a data (negativo = passou). */
  dias: number;
  concluido?: boolean;
  /** Status do concurso; ausente = acompanhado. */
  status?: Status;
}): SituacaoPrazo | null {
  if (p.concluido) return "CONCLUIDO";
  if (p.status !== undefined && !concursoAcompanhado(p.status)) return null;
  if (!ehTipoCritico(p.tipo)) return null;
  if (p.dias < 0) return "VENCIDO";
  const c = criticidade(p.tipo, p.dias);
  if (c === "ALTA") return "URGENTE";
  if (c === "MEDIA") return "ESTA_SEMANA";
  return "CRITICO";
}

/** Dados mínimos de um evento para o cálculo de prazos. */
export interface EventoPrazo {
  id: number;
  concursoId: number;
  tipo: TipoEvento;
  titulo: string | null;
  /** `YYYY-MM-DD` (horário de Brasília). */
  data: DataISO;
  /** `HH:mm` ou `null` (dia inteiro). */
  hora: string | null;
  concluido: boolean;
  /** Oculto do dashboard pelo usuário (#44); ausente = visível. */
  ocultoDashboard?: boolean;
}

/** Dados mínimos de um concurso para o cálculo de prazos. */
export interface ConcursoPrazo {
  id: number;
  status: Status;
  /**
   * Fim da validade do concurso já calculado (§4.3), se conhecido. Gera um pseudo-evento
   * `VALIDADE` quando o concurso não tem evento `VALIDADE` explícito.
   */
  validadeFim?: DataISO | null;
  /** Pseudo-evento de validade oculto do dashboard pelo usuário (#44); ausente = visível. */
  validadeOcultaDashboard?: boolean;
}

export interface Prazo<
  E extends EventoPrazo = EventoPrazo,
  C extends ConcursoPrazo = ConcursoPrazo,
> {
  /** Chave estável para listas (`evento-<id>` ou `validade-<concursoId>`). */
  chave: string;
  /** Evento de origem; `null` para o pseudo-evento de validade. */
  evento: E | null;
  concurso: C;
  tipo: TipoEvento;
  titulo: string | null;
  data: DataISO;
  hora: string | null;
  /** Dias de calendário de `hoje` até `data` (negativo = vencido). */
  dias: number;
  critico: boolean;
  criticidade: Criticidade;
  /** `true` se derivado dos dados do concurso (validade), não de um evento cadastrado. */
  derivado: boolean;
  /** `true` se o usuário ocultou este prazo do dashboard (#44). */
  oculto: boolean;
}

export interface GruposPrazos<
  E extends EventoPrazo = EventoPrazo,
  C extends ConcursoPrazo = ConcursoPrazo,
> {
  /** Prazos críticos não concluídos com data anterior a hoje. */
  vencidos: Prazo<E, C>[];
  hoje: Prazo<E, C>[];
  /** De amanhã até `hoje + janelaDias` (inclusive). */
  proximos: Prazo<E, C>[];
}

/** Concurso cujos eventos entram no painel: ativo (não terminal, inclui suspenso). */
export function concursoAcompanhado(status: Status): boolean {
  return ehAtivo(status);
}

/** Campos usados na ordenação (serve também aos itens do calendário). */
type PrazoOrdenavel = Pick<
  Prazo,
  "data" | "hora" | "criticidade" | "critico" | "concurso" | "evento"
>;

/**
 * Ordenação dos prazos: data asc; no mesmo dia, sem hora ("dia inteiro") primeiro, depois hora asc;
 * depois criticidade (alta primeiro); por fim concurso e evento, para estabilidade.
 */
export function compararPrazos(a: PrazoOrdenavel, b: PrazoOrdenavel): number {
  if (a.data !== b.data) return a.data < b.data ? -1 : 1;
  if (a.hora !== b.hora) {
    if (a.hora === null) return -1;
    if (b.hora === null) return 1;
    return a.hora < b.hora ? -1 : 1;
  }
  const crit = PESO_CRITICIDADE[a.criticidade] - PESO_CRITICIDADE[b.criticidade];
  if (crit !== 0) return crit;
  if (a.critico !== b.critico) return a.critico ? -1 : 1;
  if (a.concurso.id !== b.concurso.id) return a.concurso.id - b.concurso.id;
  return (a.evento?.id ?? 0) - (b.evento?.id ?? 0);
}

function exigirJanela(janelaDias: number): void {
  if (!Number.isInteger(janelaDias) || janelaDias < 0) {
    throw new RangeError(`Janela inválida (esperado inteiro >= 0): ${janelaDias}`);
  }
}

/**
 * Agrupa os prazos em vencidos / hoje / próximos `janelaDias` dias (§4.2).
 *
 * - Considera só eventos não concluídos de concursos acompanhados ({@link concursoAcompanhado});
 *   eventos de concursos ausentes em `concursos` são ignorados.
 * - Vencidos: apenas tipos críticos (os demais já passaram sem exigir ação).
 * - Pseudo-evento de validade a partir de `concurso.validadeFim`, se não houver evento `VALIDADE`.
 * - Eventos com data inválida são ignorados.
 */
export function proximosPrazos<E extends EventoPrazo, C extends ConcursoPrazo>(
  eventos: readonly E[],
  concursos: readonly C[],
  hoje: DataISO,
  janelaDias: number = JANELA_PADRAO_DIAS,
): GruposPrazos<E, C> {
  if (!ehDataISO(hoje)) throw new RangeError(`Data inválida (esperado YYYY-MM-DD): "${hoje}"`);
  exigirJanela(janelaDias);

  const acompanhados = new Map<number, C>();
  for (const c of concursos) if (concursoAcompanhado(c.status)) acompanhados.set(c.id, c);

  const candidatos: Prazo<E, C>[] = [];
  const comValidadeExplicita = new Set<number>();

  for (const e of eventos) {
    if (e.tipo === "VALIDADE") comValidadeExplicita.add(e.concursoId);
    const concurso = acompanhados.get(e.concursoId);
    if (!concurso || e.concluido || !ehDataISO(e.data)) continue;
    const dias = diasEntre(hoje, e.data);
    candidatos.push({
      chave: `evento-${e.id}`,
      evento: e,
      concurso,
      tipo: e.tipo,
      titulo: e.titulo,
      data: e.data,
      hora: e.hora,
      dias,
      critico: ehTipoCritico(e.tipo),
      criticidade: criticidade(e.tipo, dias),
      derivado: false,
      oculto: e.ocultoDashboard === true,
    });
  }

  for (const concurso of acompanhados.values()) {
    const fim = concurso.validadeFim;
    if (!fim || !ehDataISO(fim) || comValidadeExplicita.has(concurso.id)) continue;
    const dias = diasEntre(hoje, fim);
    candidatos.push({
      chave: `validade-${concurso.id}`,
      evento: null,
      concurso,
      tipo: "VALIDADE",
      titulo: null,
      data: fim,
      hora: null,
      dias,
      critico: false,
      criticidade: criticidade("VALIDADE", dias),
      derivado: true,
      oculto: concurso.validadeOcultaDashboard === true,
    });
  }

  candidatos.sort(compararPrazos);

  const grupos: GruposPrazos<E, C> = { vencidos: [], hoje: [], proximos: [] };
  for (const p of candidatos) {
    if (p.dias < 0) {
      if (p.critico) grupos.vencidos.push(p);
    } else if (p.dias === 0) {
      grupos.hoje.push(p);
    } else if (p.dias <= janelaDias) {
      grupos.proximos.push(p);
    }
  }
  return grupos;
}

/** Total de prazos nos três grupos. */
export function totalPrazos(grupos: GruposPrazos<EventoPrazo, ConcursoPrazo>): number {
  return grupos.vencidos.length + grupos.hoje.length + grupos.proximos.length;
}

/** Grupos sem os prazos ocultos pelo usuário (#44). */
export function semOcultos<E extends EventoPrazo, C extends ConcursoPrazo>(
  grupos: GruposPrazos<E, C>,
): GruposPrazos<E, C> {
  const visivel = (p: Prazo<E, C>) => !p.oculto;
  return {
    vencidos: grupos.vencidos.filter(visivel),
    hoje: grupos.hoje.filter(visivel),
    proximos: grupos.proximos.filter(visivel),
  };
}

/** Número de prazos ocultos pelo usuário nos três grupos (#44). */
export function contarOcultos(grupos: GruposPrazos<EventoPrazo, ConcursoPrazo>): number {
  return [...grupos.vencidos, ...grupos.hoje, ...grupos.proximos].filter((p) => p.oculto).length;
}

/** Prazo identificado pela chave da lista: evento cadastrado ou validade derivada do concurso. */
export type AlvoPrazo =
  | { tipo: "evento"; eventoId: number }
  | { tipo: "validade"; concursoId: number };

/** Interpreta a {@link Prazo.chave} (`evento-<id>` / `validade-<concursoId>`); `null` se inválida. */
export function lerChavePrazo(chave: unknown): AlvoPrazo | null {
  if (typeof chave !== "string") return null;
  const m = /^(evento|validade)-([1-9]\d{0,15})$/.exec(chave);
  if (!m) return null;
  const id = Number(m[2]);
  if (!Number.isSafeInteger(id)) return null;
  return m[1] === "evento"
    ? { tipo: "evento", eventoId: id }
    : { tipo: "validade", concursoId: id };
}

/**
 * Próxima data do concurso: menor `data >= hoje` entre seus eventos não concluídos, ou `null`
 * (usada na ordenação da lista, RF07).
 */
export function proximaData(
  eventos: readonly Pick<EventoPrazo, "data" | "concluido">[],
  hoje: DataISO,
): DataISO | null {
  let menor: DataISO | null = null;
  for (const e of eventos) {
    if (e.concluido || !ehDataISO(e.data) || e.data < hoje) continue;
    if (menor === null || e.data < menor) menor = e.data;
  }
  return menor;
}

/** Texto relativo em pt-BR: "hoje", "amanhã", "em 5 dias", "ontem", "há 3 dias". */
export function descreverDias(dias: number): string {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  return dias > 0 ? `em ${dias} dias` : `há ${-dias} dias`;
}
