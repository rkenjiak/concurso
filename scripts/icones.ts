/**
 * Composição dos ícones do app a partir de `assets/logo.svg` (#66). Funções puras: só montam o
 * SVG de cada variante; a rasterização (PNG) fica em `gerar-icones.ts`.
 *
 * O logo marca o desenho entre `<!-- marca:inicio -->` e `<!-- marca:fim -->`, no sistema de
 * coordenadas original (centro {@link CENTRO_MARCA}); cada variante o reposiciona com a própria
 * escala sobre um fundo quadrado (ícones "any" e Apple) ou arredondado (favicon).
 */

export const TAMANHO = 512;
/** Centro aproximado do desenho no sistema de coordenadas do logo. */
export const CENTRO_MARCA = { x: 250, y: 258 } as const;
/** Fundo do ícone (slate-900), também usado como cor de fundo do splash do PWA. */
export const COR_FUNDO = "#0f172a";

export interface PartesLogo {
  defs: string;
  marca: string;
}

/** Extrai `<defs>` e o desenho marcado do SVG do logo. */
export function extrairPartes(svg: string): PartesLogo {
  const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)?.[0];
  const marca = svg.match(/<!-- marca:inicio -->([\s\S]*?)<!-- marca:fim -->/)?.[1];
  if (!defs || !marca?.trim()) {
    throw new Error("assets/logo.svg precisa de <defs> e do trecho entre marca:inicio/marca:fim");
  }
  return { defs, marca: marca.trim() };
}

export interface OpcoesVariante {
  /**
   * Escala do desenho. Raio do desenho ≈ 155 unidades: 1,45 ocupa bem o quadro; ≤ 1,3 mantém
   * tudo no círculo seguro dos ícones maskable (raio de 40% do lado).
   */
  escala: number;
  /** Raio dos cantos do fundo (0 = quadrado, para ícones que o sistema recorta). */
  raioCantos?: number;
}

/** SVG 512×512 de uma variante do ícone. */
export function svgVariante({ defs, marca }: PartesLogo, opcoes: OpcoesVariante): string {
  const { escala, raioCantos = 0 } = opcoes;
  const cantos = raioCantos > 0 ? ` rx="${raioCantos}"` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TAMANHO} ${TAMANHO}">`,
    defs,
    `<rect width="${TAMANHO}" height="${TAMANHO}"${cantos} fill="${COR_FUNDO}"/>`,
    `<g transform="translate(${TAMANHO / 2} ${TAMANHO / 2}) scale(${escala}) translate(${-CENTRO_MARCA.x} ${-CENTRO_MARCA.y})">`,
    marca,
    "</g>",
    "</svg>",
    "",
  ].join("\n");
}

export const VARIANTES = {
  /** Ícone "any": ocupa o quadro. */
  cheio: { escala: 1.45 },
  /** Favicon (`src/app/icon.svg`) e o ícone do README: cantos arredondados. */
  arredondado: { escala: 1.45, raioCantos: 112 },
  /** Maskable: desenho dentro do círculo seguro (o Android recorta em círculo/squircle). */
  maskable: { escala: 1.25 },
} as const satisfies Record<string, OpcoesVariante>;
