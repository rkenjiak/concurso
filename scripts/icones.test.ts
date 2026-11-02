import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COR_FUNDO, extrairPartes, svgVariante, VARIANTES } from "./icones";

const LOGO = readFileSync("assets/logo.svg", "utf8");

describe("extrairPartes", () => {
  it("extrai os <defs> e o desenho marcado do logo", () => {
    const { defs, marca } = extrairPartes(LOGO);
    expect(defs).toMatch(/^<defs>[\s\S]*<\/defs>$/);
    expect(defs).toContain('id="gradiente-logo"');
    expect(marca).toContain("<path");
    expect(marca).not.toContain("marca:");
  });

  it("falha se o logo perder as marcações", () => {
    expect(() => extrairPartes("<svg><defs></defs></svg>")).toThrow(/marca:inicio/);
  });
});

describe("svgVariante", () => {
  const partes = { defs: "<defs/>", marca: "<path/>" };

  it("monta o quadro 512×512 com fundo e o desenho escalado no centro", () => {
    const svg = svgVariante(partes, VARIANTES.cheio);
    expect(svg).toContain('viewBox="0 0 512 512"');
    expect(svg).toContain(`<rect width="512" height="512" fill="${COR_FUNDO}"/>`);
    expect(svg).toContain("translate(256 256) scale(1.45) translate(-250 -258)");
    expect(svg).toContain("<path/>");
  });

  it("arredonda os cantos só quando pedido", () => {
    expect(svgVariante(partes, VARIANTES.arredondado)).toContain('rx="112"');
    expect(svgVariante(partes, VARIANTES.maskable)).not.toContain("rx=");
  });

  it("mantém o maskable dentro do círculo seguro (raio do desenho ≈ 155 × escala ≤ 40% de 512)", () => {
    expect(155 * VARIANTES.maskable.escala).toBeLessThanOrEqual(512 * 0.4);
  });
});
