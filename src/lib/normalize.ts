/**
 * Normalização de texto para busca sem acento/maiúsculas (RF07, ARQUITETURA.md §7.2).
 */

/** Minúsculas, sem diacríticos e com espaços colapsados: "  Técnico  JUDICIÁRIO " → "tecnico judiciario". */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Nome canônico de tag: trim + minúsculas (acentos preservados para exibição). */
export function normalizarTag(nome: string): string {
  return nome.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

export interface CamposBusca {
  orgao: string;
  cargo: string;
  banca?: string | null;
  tags?: readonly string[];
}

/** Valor da coluna `concurso.busca_normalizada`: órgão + cargo + banca + tags normalizados. */
export function montarBuscaNormalizada({ orgao, cargo, banca, tags = [] }: CamposBusca): string {
  return normalizarTexto([orgao, cargo, banca ?? "", ...tags].join(" "));
}
