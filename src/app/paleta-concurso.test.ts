/**
 * Contraste da paleta de concursos (#46): cada cor, nos temas claro e escuro, precisa de ao menos
 * 3:1 contra os fundos onde aparece (WCAG 1.4.11, elementos gráficos). Lê os tokens de
 * `globals.css` e converte OKLCH → sRGB para calcular a luminância relativa.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COR_CONCURSO, varCorConcurso } from "@/domain/cores";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");
const [claro = "", escuro = ""] = css.split(/^\.dark \{/m);

type Oklch = [number, number, number];

function token(bloco: string, nome: string): Oklch {
  const m = new RegExp(String.raw`--${nome}: oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)`).exec(bloco);
  if (!m) throw new Error(`Token --${nome} ausente`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function luminancia([L, C, h]: Oklch): number {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * (rgb[0] ?? 0) + 0.7152 * (rgb[1] ?? 0) + 0.0722 * (rgb[2] ?? 0);
}

function contraste(x: Oklch, y: Oklch): number {
  const [a, b] = [luminancia(x), luminancia(y)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const nomeToken = (cor: (typeof COR_CONCURSO)[number]) =>
  varCorConcurso(cor).slice("var(--".length, -1);

describe.each([
  ["claro", claro, ["background", "card", "muted"]],
  ["escuro", escuro, ["background", "card", "muted"]],
])("paleta no tema %s", (_tema, bloco, fundos) => {
  it.each([...COR_CONCURSO])("%s tem contraste >= 3:1 com os fundos", (cor) => {
    const valor = token(bloco, nomeToken(cor));
    for (const fundo of fundos) {
      expect(contraste(valor, token(bloco, fundo))).toBeGreaterThanOrEqual(3);
    }
  });
});
