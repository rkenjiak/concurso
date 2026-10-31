/**
 * Formatação e parsing no padrão brasileiro (RNF04): moeda BRL, datas `dd/mm/aaaa`,
 * horários no fuso America/Sao_Paulo.
 */
import { type DataISO, ehDataISO, FUSO_SP } from "./tz";

const SEM_VALOR = "—";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const dataSPFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_SP,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dataHoraSPFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_SP,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Centavos → "R$ 1.234,56". `null`/`undefined` → "—". */
export function formatarBRL(centavos: number | null | undefined): string {
  if (centavos == null || !Number.isFinite(centavos)) return SEM_VALOR;
  return brl.format(centavos / 100);
}

/**
 * Converte texto digitado em moeda brasileira para centavos.
 * Aceita "R$ 1.234,56", "1234,56", "1.234", "1234.56", "1234". Retorna `null` se vazio ou
 * inválido (inclui negativos e mais de 2 casas decimais).
 */
export function parseBRL(texto: string | null | undefined): number | null {
  if (texto == null) return null;
  // `\s` também cobre o espaço não separável (U+00A0) que o Intl usa após "R$".
  const limpo = texto.replace(/R\$/gi, "").replace(/\s/g, "");
  if (limpo === "") return null;

  let inteiro: string;
  let fracao = "";
  if (limpo.includes(",")) {
    // Formato brasileiro: "." separa milhar, "," separa decimais.
    const partes = limpo.split(",");
    if (partes.length !== 2) return null;
    [inteiro, fracao] = partes as [string, string];
    if (!/^\d{1,3}(\.\d{3})*$|^\d*$/.test(inteiro)) return null;
    if (inteiro === "" && fracao === "") return null;
    inteiro = inteiro.replaceAll(".", "");
  } else if (/^\d+\.\d{1,2}$/.test(limpo)) {
    // Um único ponto seguido de 1–2 dígitos: decimal ("1234.5").
    [inteiro, fracao] = limpo.split(".") as [string, string];
  } else if (/^\d{1,3}(\.\d{3})+$|^\d+$/.test(limpo)) {
    // Somente separadores de milhar ("1.234.567") ou só dígitos.
    inteiro = limpo.replaceAll(".", "");
  } else {
    return null;
  }

  if (!/^\d{0,2}$/.test(fracao)) return null;
  if (inteiro === "") inteiro = "0";
  const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) ? centavos : null;
}

/** Data de calendário `YYYY-MM-DD` → "dd/mm/aaaa" (sem conversão de fuso). */
export function formatarData(data: DataISO | null | undefined): string {
  if (data == null || data === "") return SEM_VALOR;
  if (!ehDataISO(data)) throw new RangeError(`Data inválida (esperado YYYY-MM-DD): "${data}"`);
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Instante → "dd/mm/aaaa" no fuso de São Paulo. */
export function formatarDataInstante(instante: Date | number | null | undefined): string {
  if (instante == null) return SEM_VALOR;
  return dataSPFmt.format(instante);
}

/** Instante → "dd/mm/aaaa HH:mm" no fuso de São Paulo. */
export function formatarDataHora(instante: Date | number | null | undefined): string {
  if (instante == null) return SEM_VALOR;
  return dataHoraSPFmt.format(instante).replace(",", "");
}

const numeroEntradaFmt = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Centavos → texto do campo de moeda ("1.234,56", sem "R$"). `null` → "". */
export function centavosParaEntrada(centavos: number | null | undefined): string {
  if (centavos == null || !Number.isFinite(centavos)) return "";
  return numeroEntradaFmt.format(centavos / 100);
}

/** Máximo de dígitos aceitos pela máscara (R$ 9.999.999.999.999,99). */
const MAX_DIGITOS_MOEDA = 15;

/**
 * Máscara de digitação de moeda: considera só os dígitos, preenchendo da direita para a esquerda
 * (estilo caixa eletrônico). "123456" → "1.234,56"; "" → "".
 */
export function mascararBRL(texto: string): string {
  const digitos = texto.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_DIGITOS_MOEDA);
  if (digitos === "") return texto.replace(/\D/g, "") === "" ? "" : "0,00";
  return centavosParaEntrada(Number(digitos));
}
