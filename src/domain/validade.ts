/**
 * Validade do concurso (RF05, ARQUITETURA.md §4.3). Funções puras: sem Next, sem banco e sem
 * relógio — `hoje` (data de calendário em America/Sao_Paulo, `YYYY-MM-DD`) é sempre parâmetro.
 *
 * ```
 * se validade_fim_manual → usa ela
 * senão se homologacao_data e validade_meses:
 *   fim = homologacao_data + validade_meses
 *   se validade_prorrogada: fim = fim + validade_meses   (prorrogação única, por igual período)
 * senão → indefinida
 * ```
 */
import { type DataISO, diasEntre, ehDataISO } from "../lib/tz";

/** Limites de `validade_meses` (CF art. 37, III: até 2 anos). */
export const VALIDADE_MESES_MIN = 1;
export const VALIDADE_MESES_MAX = 24;

/** Faltando até este número de dias (inclusive), a validade está "vencendo" (alerta). */
export const DIAS_ALERTA_VALIDADE = 90;

/** Campos do concurso usados no cálculo. */
export interface DadosValidade {
  homologacaoData: DataISO | null;
  validadeMeses: number | null;
  validadeProrrogada: boolean;
  validadeFimManual: DataISO | null;
}

export type SituacaoValidade = "INDEFINIDA" | "VIGENTE" | "VENCENDO" | "EXPIRADA";

export interface Validade {
  /** Último dia de validade, ou `null` se indefinida. */
  fim: DataISO | null;
  /** `MANUAL` = data informada sobrescreve o cálculo. */
  origem: "MANUAL" | "CALCULADA" | null;
  /** Dias de calendário de `hoje` até `fim` (negativo = expirada). */
  diasRestantes: number | null;
  situacao: SituacaoValidade;
}

/** `true` se `meses` é um prazo de validade aceito (inteiro entre 1 e 24). */
export function ehValidadeMeses(meses: number): boolean {
  return Number.isInteger(meses) && meses >= VALIDADE_MESES_MIN && meses <= VALIDADE_MESES_MAX;
}

const ehBissexto = (ano: number) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;

const DIAS_NO_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function diasNoMes(ano: number, mes: number): number {
  return mes === 2 && ehBissexto(ano) ? 29 : (DIAS_NO_MES[mes - 1] as number);
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/**
 * Soma `meses` (inteiro ≥ 0) a uma data de calendário. Se o dia não existe no mês de destino,
 * usa o último dia desse mês (31/01 + 1 mês = 28/02 ou 29/02 em ano bissexto).
 */
export function somarMeses(data: DataISO, meses: number): DataISO {
  if (!ehDataISO(data)) throw new RangeError(`Data inválida (esperado YYYY-MM-DD): "${data}"`);
  if (!Number.isInteger(meses) || meses < 0) {
    throw new RangeError(`Meses inválidos (esperado inteiro >= 0): ${meses}`);
  }
  const [ano, mes, dia] = data.split("-").map(Number) as [number, number, number];
  const total = mes - 1 + meses;
  const novoAno = ano + Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  const novoDia = Math.min(dia, diasNoMes(novoAno, novoMes));
  return `${String(novoAno).padStart(4, "0")}-${doisDigitos(novoMes)}-${doisDigitos(novoDia)}`;
}

/**
 * Fim da validade (§4.3): a data manual, se válida; senão homologação + meses (somados de novo,
 * a partir do primeiro fim, se prorrogada); senão `null`. Dados inválidos são tratados como
 * ausentes.
 */
export function calcularValidadeFim(dados: DadosValidade): DataISO | null {
  return resolverFim(dados).fim;
}

function resolverFim(dados: DadosValidade): Pick<Validade, "fim" | "origem"> {
  const { homologacaoData, validadeMeses, validadeProrrogada, validadeFimManual } = dados;
  if (validadeFimManual && ehDataISO(validadeFimManual)) {
    return { fim: validadeFimManual, origem: "MANUAL" };
  }
  if (!homologacaoData || !ehDataISO(homologacaoData)) return { fim: null, origem: null };
  if (validadeMeses === null || !ehValidadeMeses(validadeMeses)) {
    return { fim: null, origem: null };
  }
  const fim = somarMeses(homologacaoData, validadeMeses);
  return {
    fim: validadeProrrogada ? somarMeses(fim, validadeMeses) : fim,
    origem: "CALCULADA",
  };
}

/**
 * Validade em relação a `hoje`: vigente, vencendo (≤ {@link DIAS_ALERTA_VALIDADE} dias,
 * inclui o último dia) ou expirada (após o fim).
 */
export function situacaoValidade(dados: DadosValidade, hoje: DataISO): Validade {
  if (!ehDataISO(hoje)) throw new RangeError(`Data inválida (esperado YYYY-MM-DD): "${hoje}"`);
  const { fim, origem } = resolverFim(dados);
  if (fim === null) return { fim, origem, diasRestantes: null, situacao: "INDEFINIDA" };
  const diasRestantes = diasEntre(hoje, fim);
  const situacao =
    diasRestantes < 0 ? "EXPIRADA" : diasRestantes <= DIAS_ALERTA_VALIDADE ? "VENCENDO" : "VIGENTE";
  return { fim, origem, diasRestantes, situacao };
}

/** Texto em pt-BR: "vence hoje", "vence amanhã", "vence em 5 dias", "expirou ontem/há 3 dias". */
export function descreverValidade(validade: Validade): string {
  const dias = validade.diasRestantes;
  if (dias === null) return "Validade não definida";
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  if (dias > 1) return `vence em ${dias} dias`;
  if (dias === -1) return "expirou ontem";
  return `expirou há ${-dias} dias`;
}
