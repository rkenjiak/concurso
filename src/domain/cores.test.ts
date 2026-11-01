import { describe, expect, it } from "vitest";
import {
  COR_CONCURSO,
  corDoConcurso,
  corPadrao,
  ehCorConcurso,
  ehIconeValido,
  ICONE_MAX,
  ROTULO_COR_CONCURSO,
  SUGESTOES_ICONE,
  varCorConcurso,
} from "./cores";

describe("paleta de cores do concurso", () => {
  it("tem rótulo para cada cor e não usa vermelho/âmbar (reservados à criticidade)", () => {
    expect(Object.keys(ROTULO_COR_CONCURSO)).toEqual([...COR_CONCURSO]);
    expect(COR_CONCURSO).not.toContain("VERMELHO");
    expect(COR_CONCURSO).not.toContain("AMARELO");
  });

  it("reconhece cores válidas", () => {
    expect(ehCorConcurso("AZUL")).toBe(true);
    expect(ehCorConcurso("azul")).toBe(false);
    expect(ehCorConcurso(null)).toBe(false);
  });

  it("mapeia cada cor para a variável CSS", () => {
    expect(varCorConcurso("AZUL")).toBe("var(--concurso-azul)");
    expect(varCorConcurso("VERDE_AGUA")).toBe("var(--concurso-verde-agua)");
  });
});

describe("corPadrao", () => {
  it("é determinística", () => {
    expect(corPadrao(42)).toBe(corPadrao(42));
  });

  it("dá cores diferentes a IDs consecutivos (cobre a paleta inteira)", () => {
    const n = COR_CONCURSO.length;
    for (const inicio of [1, 9, 1000]) {
      const cores = Array.from({ length: n }, (_, i) => corPadrao(inicio + i));
      expect(new Set(cores).size).toBe(n);
    }
    expect(corPadrao(1)).not.toBe(corPadrao(2));
  });

  it("aceita IDs fora do usual sem quebrar", () => {
    for (const id of [0, -3, 2.7, Number.MAX_SAFE_INTEGER]) {
      expect(COR_CONCURSO).toContain(corPadrao(id));
    }
  });
});

describe("corDoConcurso", () => {
  it("usa a cor escolhida ou, na falta dela, a automática", () => {
    expect(corDoConcurso({ id: 1, cor: "ROSA" })).toBe("ROSA");
    expect(corDoConcurso({ id: 1, cor: null })).toBe(corPadrao(1));
  });
});

describe("ehIconeValido", () => {
  it.each(["⚖️", "👩🏽‍⚖️", "🇧🇷", "A", ...SUGESTOES_ICONE])("aceita %s", (icone) => {
    expect(ehIconeValido(icone)).toBe(true);
  });

  it.each(["", " ", " ⚖️", "⚖️⚖️", "ab", "x".repeat(ICONE_MAX + 1)])("rejeita %j", (icone) => {
    expect(ehIconeValido(icone)).toBe(false);
  });
});
