/**
 * Cor e ícone de identificação do concurso (#46). A paleta é fechada: cada cor tem variantes clara
 * e escura definidas como tokens CSS (`--concurso-<cor>` em `globals.css`), escolhidas para ter
 * contraste de ao menos 3:1 (elemento gráfico, WCAG 1.4.11) contra o fundo de cada tema. A cor é
 * só um marcador (ponto/faixa): o texto continua na cor do tema. Vermelho e âmbar ficam de fora de
 * propósito — são reservados ao destaque de prazos críticos (criticidade).
 *
 * Concursos sem cor escolhida recebem uma cor automática, determinística, derivada do ID.
 */

export const COR_CONCURSO = [
  "AZUL",
  "CIANO",
  "VERDE_AGUA",
  "VERDE",
  "VIOLETA",
  "MAGENTA",
  "ROSA",
  "CINZA",
] as const;
export type CorConcurso = (typeof COR_CONCURSO)[number];

export const ROTULO_COR_CONCURSO: Readonly<Record<CorConcurso, string>> = {
  AZUL: "Azul",
  CIANO: "Ciano",
  VERDE_AGUA: "Verde-água",
  VERDE: "Verde",
  VIOLETA: "Violeta",
  MAGENTA: "Magenta",
  ROSA: "Rosa",
  CINZA: "Cinza",
};

/** `true` se `valor` é uma cor da paleta. */
export function ehCorConcurso(valor: unknown): valor is CorConcurso {
  return typeof valor === "string" && (COR_CONCURSO as readonly string[]).includes(valor);
}

/** Multiplicador do hash; primo com o tamanho da paleta, o que torna o hash uma permutação. */
const PASSO_HASH = 5;

/**
 * Cor automática do concurso: hash simples do ID (`id × 5 mod n`). Determinística (o mesmo
 * concurso tem sempre a mesma cor) e, por ser uma permutação da paleta, quaisquer `n` IDs
 * consecutivos recebem `n` cores diferentes, embaralhadas.
 */
export function corPadrao(id: number): CorConcurso {
  const n = COR_CONCURSO.length;
  const indice = (((Math.trunc(id) * PASSO_HASH) % n) + n) % n;
  return COR_CONCURSO[indice] as CorConcurso;
}

/** Cor exibida: a escolhida pelo usuário ou, na falta dela, a automática. */
export function corDoConcurso(c: { id: number; cor: CorConcurso | null }): CorConcurso {
  return c.cor ?? corPadrao(c.id);
}

/** Variável CSS da cor (definida em `globals.css`, com variante clara e escura). */
export function varCorConcurso(cor: CorConcurso): string {
  return `var(--concurso-${cor.toLowerCase().replace("_", "-")})`;
}

/** Tamanho máximo, em unidades UTF-16, do ícone (um emoji com modificadores cabe com folga). */
export const ICONE_MAX = 16;

/** Quantidade de grafemas (caracteres percebidos) de `texto`. */
function grafemas(texto: string): number {
  return [...new Intl.Segmenter("pt-BR", { granularity: "grapheme" }).segment(texto)].length;
}

/**
 * `true` se `icone` é um único símbolo: um emoji (inclusive com tom de pele, variação ou
 * sequência ZWJ) ou outro caractere visível isolado.
 */
export function ehIconeValido(icone: string): boolean {
  return (
    icone.length > 0 && icone.length <= ICONE_MAX && icone.trim() === icone && grafemas(icone) === 1
  );
}

/** Sugestões de ícone exibidas no formulário. */
export const SUGESTOES_ICONE = ["⚖️", "🏛️", "🚓", "🏥", "🎓", "💼", "📊", "🛡️"] as const;
