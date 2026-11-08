import { describe, expect, it } from "vitest";
import {
  ABAS_CONCURSO,
  ehAbaConcurso,
  normalizarAba,
  urlComAba,
  urlSemParametro,
} from "./aba-concurso";

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

  it("remove o destaque e preserva a origem (#100)", () => {
    expect(
      urlComAba(
        "/concursos/7?aba=eventos&evento=3&de=calendario&mes=2026-11&concursos=1,7",
        "links",
      ),
    ).toBe("/concursos/7?aba=links&de=calendario&mes=2026-11&concursos=1,7");
    expect(urlComAba("/concursos/7?aba=geral&foco=validade&de=dashboard", "eventos")).toBe(
      "/concursos/7?aba=eventos&de=dashboard",
    );
  });
});

describe("urlSemParametro", () => {
  it("remove só o parâmetro pedido", () => {
    expect(urlSemParametro("/concursos/7?aba=eventos&evento=x&de=dashboard#a", "evento")).toBe(
      "/concursos/7?aba=eventos&de=dashboard#a",
    );
    expect(urlSemParametro("/concursos/7?evento=1", "evento")).toBe("/concursos/7");
  });
});
