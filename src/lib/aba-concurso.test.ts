import { describe, expect, it } from "vitest";
import { ABAS_CONCURSO, ehAbaConcurso, normalizarAba, urlComAba } from "./aba-concurso";

describe("normalizarAba", () => {
  it("aceita as abas conhecidas", () => {
    for (const aba of ABAS_CONCURSO) expect(normalizarAba(aba)).toBe(aba);
  });

  it("cai na visão geral com valor ausente, desconhecido ou repetido", () => {
    expect(normalizarAba(undefined)).toBe("geral");
    expect(normalizarAba("")).toBe("geral");
    expect(normalizarAba("LINKS")).toBe("geral");
    expect(normalizarAba("constructor")).toBe("geral");
    expect(normalizarAba(["links", "eventos"])).toBe("geral");
  });
});

describe("ehAbaConcurso", () => {
  it("só aceita strings da lista", () => {
    expect(ehAbaConcurso("historico")).toBe(true);
    expect(ehAbaConcurso("toString")).toBe(false);
    expect(ehAbaConcurso(1)).toBe(false);
    expect(ehAbaConcurso(null)).toBe(false);
  });
});

describe("urlComAba", () => {
  it("grava a aba no parâmetro", () => {
    expect(urlComAba("/concursos/7", "links")).toBe("/concursos/7?aba=links");
    expect(urlComAba("/concursos/7?aba=links", "eventos")).toBe("/concursos/7?aba=eventos");
  });

  it("remove o parâmetro na aba padrão", () => {
    expect(urlComAba("/concursos/7?aba=links", "geral")).toBe("/concursos/7");
  });

  it("preserva outros parâmetros e o hash", () => {
    expect(urlComAba("http://localhost:3000/concursos/7?x=1#topo", "historico")).toBe(
      "/concursos/7?x=1&aba=historico#topo",
    );
    expect(urlComAba("/concursos/7?aba=links&x=1", "geral")).toBe("/concursos/7?x=1");
  });
});
