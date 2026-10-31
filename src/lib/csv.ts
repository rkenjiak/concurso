/**
 * Geração de CSV (RF09) no formato que o Excel/LibreOffice em pt-BR abre direto: separador `;`,
 * BOM UTF-8 e quebras de linha CRLF (RFC 4180 para aspas).
 */

export type CelulaCsv = string | number | boolean | null | undefined;

export const SEPARADOR_CSV = ";";
const BOM = "﻿";

/** Caracteres iniciais que planilhas interpretam como fórmula (CSV injection). */
const INICIO_FORMULA = /^[=+\-@\t\r]/;

/** Escapa uma célula: protege fórmulas e envolve em aspas quando necessário. */
export function celulaCsv(valor: CelulaCsv, separador = SEPARADOR_CSV): string {
  if (valor == null) return "";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  let texto = String(valor);
  if (typeof valor === "string" && INICIO_FORMULA.test(texto)) texto = `'${texto}`;
  if (texto.includes(separador) || /["\r\n]/.test(texto)) {
    return `"${texto.replaceAll('"', '""')}"`;
  }
  return texto;
}

/** Monta o CSV completo (com BOM) a partir do cabeçalho e das linhas. */
export function gerarCsv(
  cabecalho: readonly string[],
  linhas: readonly (readonly CelulaCsv[])[],
  separador = SEPARADOR_CSV,
): string {
  const linha = (celulas: readonly CelulaCsv[]) =>
    celulas.map((c) => celulaCsv(c, separador)).join(separador);
  return `${BOM}${[cabecalho, ...linhas].map(linha).join("\r\n")}\r\n`;
}

/** Centavos → "1234,56" (sem símbolo nem separador de milhar, para planilhas). */
export function centavosCsv(centavos: number | null | undefined): string {
  if (centavos == null) return "";
  const sinal = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  return `${sinal}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}
