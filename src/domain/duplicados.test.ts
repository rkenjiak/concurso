import { describe, expect, it } from "vitest";
import { jaccard, palavras, possiveisDuplicados } from "./duplicados";

describe("palavras", () => {
  it("normaliza, remove pontuação e palavras vazias", () => {
    expect([...palavras("Analista Judiciário – Área Judiciária")]).toEqual([
      "analista",
      "judiciario",
      "judiciaria",
    ]);
    expect([...palavras("Tribunal Regional Federal da 3ª Região")]).toEqual([
      "tribunal",
      "regional",
      "federal",
      "3",
      "regiao",
    ]);
  });
});

describe("jaccard", () => {
  it("mede a sobreposição", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3);
    expect(jaccard(new Set(["a"]), new Set(["a"]))).toBe(1);
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});

describe("possiveisDuplicados", () => {
  const candidatos = [
    { id: 1, orgao: "Tribunal Regional Federal da 3ª Região", cargo: "Técnico Judiciário" },
    {
      id: 2,
      orgao: "Tribunal Regional Federal da 3a Regiao",
      cargo: "Analista Judiciário - Judiciária",
    },
    { id: 3, orgao: "Tribunal Regional Federal da 1ª Região", cargo: "Analista Judiciário" },
    { id: 4, orgao: "Prefeitura de São Paulo", cargo: "Analista Judiciário – Área Judiciária" },
  ];

  it("encontra órgão e cargo parecidos; números diferentes distinguem órgãos", () => {
    const alvo = {
      orgao: "TRIBUNAL REGIONAL FEDERAL DA 3ª REGIÃO",
      cargo: "Analista Judiciário – Área Judiciária",
    };
    expect(possiveisDuplicados(alvo, candidatos).map((c) => c.id)).toEqual([2]);
  });

  it("ordena do mais parecido ao menos", () => {
    const alvo = { orgao: "Tribunal Regional Federal", cargo: "Analista Judiciário" };
    expect(possiveisDuplicados(alvo, candidatos).map((c) => c.id)).toEqual([3, 2]);
  });

  it("não acusa cargo ou órgão diferentes", () => {
    expect(
      possiveisDuplicados({ orgao: "Câmara dos Deputados", cargo: "Analista" }, candidatos),
    ).toEqual([]);
  });
});
