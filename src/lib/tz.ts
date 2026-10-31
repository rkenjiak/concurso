/**
 * Fuso horário de referência do app: America/Sao_Paulo (RNF04, ARQUITETURA.md §7.2).
 *
 * Datas de calendário circulam como strings `YYYY-MM-DD` (wall-clock de Brasília). Regras de
 * domínio nunca chamam `new Date()` diretamente: recebem `hoje` como parâmetro, obtido aqui.
 */
import { TZDate } from "@date-fns/tz";
import { addDays, differenceInCalendarDays, format, isValid, parse } from "date-fns";

export const FUSO_SP = "America/Sao_Paulo";

/** Data de calendário no formato `YYYY-MM-DD`. */
export type DataISO = string;

const RE_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** `true` se `valor` é uma data de calendário `YYYY-MM-DD` existente (ex.: rejeita 2026-02-30). */
export function ehDataISO(valor: string): valor is DataISO {
  if (!RE_DATA_ISO.test(valor)) return false;
  const d = parse(valor, "yyyy-MM-dd", new Date(0));
  return isValid(d) && format(d, "yyyy-MM-dd") === valor;
}

function exigirDataISO(valor: string): DataISO {
  if (!ehDataISO(valor)) throw new RangeError(`Data inválida (esperado YYYY-MM-DD): "${valor}"`);
  return valor;
}

/** O instante informado (padrão: agora) visto no fuso de São Paulo. */
export function agoraSP(instante: Date | number = Date.now()): TZDate {
  return new TZDate(typeof instante === "number" ? instante : instante.getTime(), FUSO_SP);
}

/** Data de calendário (`YYYY-MM-DD`) de um instante no fuso de São Paulo. */
export function dataSP(instante: Date | number): DataISO {
  return format(agoraSP(instante), "yyyy-MM-dd");
}

/** "Hoje" em São Paulo (`YYYY-MM-DD`). Aceita o instante para testes determinísticos. */
export function hojeSP(instante: Date | number = Date.now()): DataISO {
  return dataSP(instante);
}

/** Instante (UTC) correspondente a `data` às `hora` (padrão 00:00) no horário de Brasília. */
export function instanteSP(data: DataISO, hora = "00:00"): Date {
  exigirDataISO(data);
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
  if (!m) throw new RangeError(`Hora inválida (esperado HH:mm): "${hora}"`);
  const [ano, mes, dia] = data.split("-").map(Number) as [number, number, number];
  const tz = new TZDate(ano, mes - 1, dia, Number(m[1]), Number(m[2]), FUSO_SP);
  return new Date(tz.getTime());
}

/** Soma `dias` (pode ser negativo) a uma data de calendário. */
export function somarDias(data: DataISO, dias: number): DataISO {
  const base = parse(exigirDataISO(data), "yyyy-MM-dd", new Date(0));
  return format(addDays(base, dias), "yyyy-MM-dd");
}

/** Diferença em dias de calendário `ate - de` (ex.: de 2026-01-30 até 2026-02-01 = 2). */
export function diasEntre(de: DataISO, ate: DataISO): number {
  const ref = new Date(0);
  return differenceInCalendarDays(
    parse(exigirDataISO(ate), "yyyy-MM-dd", ref),
    parse(exigirDataISO(de), "yyyy-MM-dd", ref),
  );
}
