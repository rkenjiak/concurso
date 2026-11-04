/**
 * Contagem regressiva até a próxima prova de cada concurso (#84). Função pura: `hoje` (data de
 * calendário em America/Sao_Paulo) é parâmetro.
 *
 * - Considera o próximo evento dos tipos ativos (padrão: provas e outras fases), não concluído e
 *   com data a partir de hoje.
 * - Não há contagem para concursos encerrados, cancelados, com desistência ou suspensos.
 * - Destaque: hoje, amanhã e até {@link DIAS_CONTAGEM_PROXIMA} dias.
 */
import type { DataISO } from "../lib/tz";
import type { Status, TipoEvento } from "./enums";
import {
  concursoEmAndamento,
  dataBr,
  type EventoChave,
  nomeEvento,
  proximoEvento,
} from "./eventos-chave";

/** Tipos de evento com contagem regressiva por padrão. */
export const TIPOS_CONTAGEM_PADRAO = [
  "PROVA_OBJETIVA",
  "PROVA_DISCURSIVA",
  "OUTRA_FASE",
] as const satisfies readonly TipoEvento[];

/** Faltando até este número de dias (inclusive), a contagem ganha destaque. */
export const DIAS_CONTAGEM_PROXIMA = 7;

export type DestaqueContagem = "HOJE" | "AMANHA" | "PROXIMA" | "NORMAL";

export interface Contagem<E extends EventoChave = EventoChave> {
  evento: E;
  /** Dias de calendário de hoje até o evento (0 = hoje). */
  dias: number;
  destaque: DestaqueContagem;
  /** Texto curto: "é hoje", "é amanhã", "faltam 12 dias". */
  texto: string;
  /** Texto acessível: "Prova objetiva em 12 dias, 14/11/2026". */
  rotulo: string;
}

export function destaqueContagem(dias: number): DestaqueContagem {
  if (dias <= 0) return "HOJE";
  if (dias === 1) return "AMANHA";
  if (dias <= DIAS_CONTAGEM_PROXIMA) return "PROXIMA";
  return "NORMAL";
}

/** "é hoje", "é amanhã", "faltam N dias". */
export function textoContagem(dias: number): string {
  if (dias <= 0) return "é hoje";
  if (dias === 1) return "é amanhã";
  return `faltam ${dias} dias`;
}

function rotuloContagem(e: EventoChave, dias: number): string {
  const quando = dias <= 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`;
  return `${nomeEvento(e)} ${quando}, ${dataBr(e.data)}`;
}

/** Contagem regressiva do concurso, ou `null` se não houver evento futuro dos tipos ativos. */
export function contagemRegressiva<E extends EventoChave>(
  status: Status,
  eventos: readonly E[],
  hoje: DataISO,
  tipos: readonly TipoEvento[] = TIPOS_CONTAGEM_PADRAO,
): Contagem<E> | null {
  const proximo = proximoEvento(eventos, tipos, hoje);
  if (!proximo || !concursoEmAndamento(status)) return null;
  const { evento, dias } = proximo;
  return {
    evento,
    dias,
    destaque: destaqueContagem(dias),
    texto: textoContagem(dias),
    rotulo: rotuloContagem(evento, dias),
  };
}

/** Ordena contagens de vários concursos: a mais próxima primeiro (empate: concurso). */
export function compararContagens<T extends { concursoId: number; contagem: Contagem }>(
  a: T,
  b: T,
): number {
  if (a.contagem.dias !== b.contagem.dias) return a.contagem.dias - b.contagem.dias;
  const ha = a.contagem.evento.hora ?? "";
  const hb = b.contagem.evento.hora ?? "";
  if (ha !== hb) return ha < hb ? -1 : 1;
  return a.concursoId - b.concursoId;
}
