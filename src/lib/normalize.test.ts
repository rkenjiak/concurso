import { describe, expect, it } from "vitest";
import { montarBuscaNormalizada, normalizarTag, normalizarTexto } from "./normalize";

describe("normalizarTexto", () => {
  it("remove acentos, cedilha e maiúsculas", () => {
    expect(normalizarTexto("Técnico JUDICIÁRIO — Inspeção")).toBe("tecnico judiciario — inspecao");
  });

  it("colapsa espaços e faz trim", () => {
    expect(normalizarTexto("  TRF   3ª\tRegião \n")).toBe("trf 3ª regiao");
  });

  it("aceita texto vazio", () => {
    expect(normalizarTexto("   ")).toBe("");
  });

  it("é idempotente", () => {
    const uma = normalizarTexto("Polícia Federal");
    expect(normalizarTexto(uma)).toBe(uma);
  });
});

describe("normalizarTag", () => {
  it("aplica trim e minúsculas preservando acentos", () => {
    expect(normalizarTag("  Prioridade  Máxima ")).toBe("prioridade máxima");
  });
});

describe("montarBuscaNormalizada", () => {
  it("junta órgão, cargo, banca e tags", () => {
    expect(
      montarBuscaNormalizada({
        orgao: "TRF 3ª Região",
        cargo: "Analista Judiciário",
        banca: "FCC",
        tags: ["Tribunais", "prioridade"],
      }),
    ).toBe("trf 3ª regiao analista judiciario fcc tribunais prioridade");
  });

  it("ignora banca ausente", () => {
    expect(montarBuscaNormalizada({ orgao: "INSS", cargo: "Técnico", banca: null })).toBe(
      "inss tecnico",
    );
  });
});
