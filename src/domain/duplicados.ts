/**
 * Detecção de possíveis concursos duplicados (MCP: antes de cadastrar a partir do edital).
 * Compara órgão e cargo por sobreposição de palavras (sem acento, maiúsculas nem palavras
 * vazias), de modo que "TRF 3ª Região" e "Tribunal Regional Federal da 3ª Região" não colidem,
 * mas "Técnico Judiciário – Área Administrativa" e "Técnico Judiciário Administrativo" sim.
 * Números distinguem órgãos ("TRF da 1ª Região" ≠ "TRF da 3ª Região").
 */
import { normalizarTexto } from "@/lib/normalize";

/** Similaridade mínima (Jaccard das palavras) para órgão e cargo serem considerados iguais. */
export const SIMILARIDADE_MINIMA = 0.5;

const PALAVRAS_VAZIAS = new Set([
  "a",
  "o",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "para",
  "area",
]);

/** Palavras significativas do texto, normalizadas. */
export function palavras(texto: string): Set<string> {
  return new Set(
    normalizarTexto(texto)
      .replace(/[^a-z0-9 ]/g, " ")
      .split(" ")
      .filter((p) => p !== "" && !PALAVRAS_VAZIAS.has(p)),
  );
}

/** Índice de Jaccard entre dois conjuntos (0 a 1; dois vazios = 0). */
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let comuns = 0;
  for (const p of a) if (b.has(p)) comuns++;
  return comuns / (a.size + b.size - comuns);
}

/** `true` se os dois têm números e eles diferem (ex.: regiões ou zonas diferentes). */
function numerosDiferentes(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  const na = [...a].filter((p) => /^\d+$/.test(p));
  const nb = [...b].filter((p) => /^\d+$/.test(p));
  return na.length > 0 && nb.length > 0 && jaccard(new Set(na), new Set(nb)) < 1;
}

export interface Identificacao {
  orgao: string;
  cargo: string;
}

/** Candidatos parecidos com `alvo` (órgão e cargo similares), do mais ao menos parecido. */
export function possiveisDuplicados<T extends Identificacao>(
  alvo: Identificacao,
  candidatos: readonly T[],
): T[] {
  const orgao = palavras(alvo.orgao);
  const cargo = palavras(alvo.cargo);
  return candidatos
    .map((c) => {
      const orgaoC = palavras(c.orgao);
      return {
        c,
        so: numerosDiferentes(orgao, orgaoC) ? 0 : jaccard(orgao, orgaoC),
        sc: jaccard(cargo, palavras(c.cargo)),
      };
    })
    .filter(({ so, sc }) => so >= SIMILARIDADE_MINIMA && sc >= SIMILARIDADE_MINIMA)
    .sort((x, y) => y.so + y.sc - (x.so + x.sc))
    .map(({ c }) => c);
}
