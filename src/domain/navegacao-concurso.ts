/**
 * Links para o detalhe do concurso a partir de um evento e o caminho de volta à tela de origem
 * (#100, decisões D1/D2). Funções puras: sem Next, sem banco e sem relógio — `hoje` (data de
 * calendário em America/Sao_Paulo) é sempre parâmetro.
 *
 * - Evento cadastrado: `/concursos/{id}?aba=eventos&evento={eventoId}`.
 * - Validade derivada (sem evento): `/concursos/{id}?aba=geral&foco=validade`.
 * - Origem opcional: `de=dashboard|notificacoes|calendario` (+ `mes` e `concursos` do
 *   calendário). O retorno é reconstruído por allowlist; nunca se aceita uma URL arbitrária.
 */
import { FOCO_VALIDADE, PARAM_ABA, PARAM_EVENTO, PARAM_FOCO } from "../lib/aba-concurso";
import { formatarMes } from "../lib/format";
import type { DataISO } from "../lib/tz";
import { lerMes, type MesISO } from "./calendario";
import {
  hrefCalendario,
  lerSelecaoConcursos,
  PARAM_CONCURSOS,
  PARAM_MES,
  type SelecaoConcursos,
  serializarSelecao,
} from "./navegacao-calendario";

/** Tela de origem no parâmetro `?de=`. */
export const PARAM_DE = "de";

export const ORIGENS = ["dashboard", "notificacoes", "calendario"] as const;
export type TipoOrigem = (typeof ORIGENS)[number];

/** Tela de onde se chegou ao concurso; o calendário guarda o mês e a seleção de concursos. */
export type Origem =
  | { de: "dashboard" }
  | { de: "notificacoes" }
  | { de: "calendario"; mes: MesISO; selecao: SelecaoConcursos };

const RE_ID = /^[1-9]\d{0,15}$/;

/**
 * Valor de `?evento=` → id de evento (inteiro positivo) ou `null` se ausente, repetido ou
 * malformado. Pertencer ao concurso é verificado por quem tem a lista de eventos.
 */
export function lerIdEvento(valor: unknown): number | null {
  if (typeof valor !== "string" || !RE_ID.test(valor)) return null;
  const id = Number(valor);
  return Number.isSafeInteger(id) ? id : null;
}

/** Parâmetros da origem, na ordem `de`, `mes`, `concursos` (vírgulas legíveis, sem `%2C`). */
function parametrosOrigem(origem: Origem | undefined): string[] {
  if (!origem) return [];
  const params = [`${PARAM_DE}=${origem.de}`];
  if (origem.de === "calendario") {
    params.push(`${PARAM_MES}=${origem.mes}`);
    const concursos = serializarSelecao(origem.selecao);
    if (concursos !== null) params.push(`${PARAM_CONCURSOS}=${concursos}`);
  }
  return params;
}

/** Deep-link de um evento cadastrado: aba Eventos com o evento destacado (D2). */
export function hrefEvento(concursoId: number, eventoId: number, origem?: Origem): string {
  const params = [`${PARAM_ABA}=eventos`, `${PARAM_EVENTO}=${eventoId}`];
  return `/concursos/${concursoId}?${[...params, ...parametrosOrigem(origem)].join("&")}`;
}

/** Deep-link do fim da validade derivado: Visão geral com o card Validade destacado (D2). */
export function hrefValidade(concursoId: number, origem?: Origem): string {
  const params = [`${PARAM_ABA}=geral`, `${PARAM_FOCO}=${FOCO_VALIDADE}`];
  return `/concursos/${concursoId}?${[...params, ...parametrosOrigem(origem)].join("&")}`;
}

/** Deep-link de um prazo: o evento, se houver; senão (validade derivada), o card Validade. */
export function hrefPrazo(
  concursoId: number,
  evento: { id: number } | null,
  origem?: Origem,
): string {
  return evento ? hrefEvento(concursoId, evento.id, origem) : hrefValidade(concursoId, origem);
}

const primeiro = (valor: unknown) => (Array.isArray(valor) ? valor[0] : valor);

/**
 * Origem a partir dos `searchParams` do detalhe; `null` se ausente ou fora da allowlist. No
 * calendário, mês inválido cai no mês de hoje e IDs inválidos são descartados (normalizadores do
 * calendário, #83).
 */
export function lerOrigem(
  params: Readonly<Record<string, string | string[] | undefined>>,
  hoje: DataISO,
): Origem | null {
  const de = primeiro(params[PARAM_DE]);
  switch (de) {
    case "dashboard":
    case "notificacoes":
      return { de };
    case "calendario":
      return {
        de,
        mes: lerMes(params[PARAM_MES], hoje),
        selecao: lerSelecaoConcursos(params[PARAM_CONCURSOS]),
      };
    default:
      return null;
  }
}

export interface LinkVoltar {
  href: string;
  rotulo: string;
}

/** Link "voltar" do detalhe: a tela de origem ou, sem origem, a lista de concursos. */
export function linkVoltar(origem: Origem | null): LinkVoltar {
  switch (origem?.de) {
    case "dashboard":
      return { href: "/", rotulo: "Dashboard" };
    case "notificacoes":
      return { href: "/notificacoes", rotulo: "Notificações" };
    case "calendario":
      return {
        href: hrefCalendario(origem.mes, origem.selecao),
        rotulo: `Calendário · ${formatarMes(origem.mes)}`,
      };
    default:
      return { href: "/concursos", rotulo: "Concursos" };
  }
}
