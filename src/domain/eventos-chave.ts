/**
 * Eventos-chave de um concurso em relação a `hoje` (data de calendário em America/Sao_Paulo).
 * Base comum da contagem regressiva (#84, `domain/contagem.ts`) e das pendências de status
 * (#85, `domain/sugestao-status.ts`). Funções puras: sem Next, sem banco e sem relógio.
 */
import { type DataISO, diasEntre, ehDataISO } from "../lib/tz";
import type { Status, TipoEvento } from "./enums";
import { ROTULO_TIPO_EVENTO } from "./labels";
import { ehTerminal } from "./status";

/** Dados mínimos de um evento datado. */
export interface EventoChave {
  id: number;
  tipo: TipoEvento;
  titulo: string | null;
  /** `YYYY-MM-DD` (horário de Brasília). */
  data: DataISO;
  /** `HH:mm` ou `null`/ausente (dia inteiro). */
  hora?: string | null;
  concluido: boolean;
}

/** Evento com os dias de calendário de `hoje` até a data (negativo = já passou). */
export interface EventoComDias<E extends EventoChave = EventoChave> {
  evento: E;
  dias: number;
}

export const TIPOS_PROVA = [
  "PROVA_OBJETIVA",
  "PROVA_DISCURSIVA",
] as const satisfies readonly TipoEvento[];

/**
 * Concurso em andamento: não encerrado (terminal: empossado, desistência, não inscrito,
 * cancelado, reprovado) nem suspenso (datas de um concurso suspenso não são confiáveis).
 */
export function concursoEmAndamento(status: Status): boolean {
  return !ehTerminal(status) && status !== "SUSPENSO";
}

/** O evento já passou: concluído ou com data anterior a hoje. */
export function eventoPassou(e: Pick<EventoChave, "data" | "concluido">, hoje: DataISO): boolean {
  return e.concluido || e.data < hoje;
}

/** O evento chegou: concluído ou com data até hoje (inclusive). */
export function eventoChegou(e: Pick<EventoChave, "data" | "concluido">, hoje: DataISO): boolean {
  return e.concluido || e.data <= hoje;
}

/** Ordem cronológica: data; no mesmo dia, sem hora primeiro, depois hora; por fim o id. */
export function compararEventos(a: EventoChave, b: EventoChave): number {
  if (a.data !== b.data) return a.data < b.data ? -1 : 1;
  const ha = a.hora ?? null;
  const hb = b.hora ?? null;
  if (ha !== hb) {
    if (ha === null) return -1;
    if (hb === null) return 1;
    return ha < hb ? -1 : 1;
  }
  return a.id - b.id;
}

/** Eventos válidos (data `YYYY-MM-DD` existente) dos tipos pedidos, em ordem cronológica. */
export function eventosDosTipos<E extends EventoChave>(
  eventos: readonly E[],
  tipos: readonly TipoEvento[],
): E[] {
  return eventos.filter((e) => tipos.includes(e.tipo) && ehDataISO(e.data)).sort(compararEventos);
}

function exigirHoje(hoje: DataISO): void {
  if (!ehDataISO(hoje)) throw new RangeError(`Data inválida (esperado YYYY-MM-DD): "${hoje}"`);
}

/** Próximo evento dos tipos pedidos, não concluído, com data a partir de hoje; ou `null`. */
export function proximoEvento<E extends EventoChave>(
  eventos: readonly E[],
  tipos: readonly TipoEvento[],
  hoje: DataISO,
): EventoComDias<E> | null {
  exigirHoje(hoje);
  const e = eventosDosTipos(eventos, tipos).find((x) => !x.concluido && x.data >= hoje);
  return e ? { evento: e, dias: diasEntre(hoje, e.data) } : null;
}

/**
 * Evento mais recente dos tipos pedidos que já chegou (`incluirHoje`, padrão) ou já passou
 * (`incluirHoje = false`); concluídos contam mesmo com data futura. `null` se não houver.
 */
export function ultimoEvento<E extends EventoChave>(
  eventos: readonly E[],
  tipos: readonly TipoEvento[],
  hoje: DataISO,
  { incluirHoje = true }: { incluirHoje?: boolean } = {},
): EventoComDias<E> | null {
  exigirHoje(hoje);
  const ocorreu = incluirHoje ? eventoChegou : eventoPassou;
  const e = eventosDosTipos(eventos, tipos)
    .filter((x) => ocorreu(x, hoje))
    .at(-1);
  return e ? { evento: e, dias: diasEntre(hoje, e.data) } : null;
}

/** Nome exibido do evento: título ou rótulo do tipo. */
export function nomeEvento(e: Pick<EventoChave, "titulo" | "tipo">): string {
  return e.titulo ?? ROTULO_TIPO_EVENTO[e.tipo];
}

/** `YYYY-MM-DD` → `dd/mm/aaaa` (data de calendário, sem conversão de fuso). */
export function dataBr(data: DataISO): string {
  return data.split("-").reverse().join("/");
}
