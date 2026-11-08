import { describe, expect, it } from "vitest";
import {
  hrefEvento,
  hrefPrazo,
  hrefValidade,
  lerIdEvento,
  lerOrigem,
  linkVoltar,
} from "./navegacao-concurso";

const HOJE = "2026-11-07";

describe("hrefEvento / hrefValidade / hrefPrazo", () => {
  it("abre a aba Eventos com o evento", () => {
    expect(hrefEvento(42, 17)).toBe("/concursos/42?aba=eventos&evento=17");
  });

  it("validade derivada abre a Visão geral com foco no card", () => {
    expect(hrefValidade(42)).toBe("/concursos/42?aba=geral&foco=validade");
  });

  it("acrescenta a origem", () => {
    expect(hrefEvento(42, 17, { de: "dashboard" })).toBe(
      "/concursos/42?aba=eventos&evento=17&de=dashboard",
    );
    expect(hrefValidade(42, { de: "notificacoes" })).toBe(
      "/concursos/42?aba=geral&foco=validade&de=notificacoes",
    );
    expect(hrefEvento(42, 17, { de: "calendario", mes: "2026-11", selecao: [42, 1] })).toBe(
      "/concursos/42?aba=eventos&evento=17&de=calendario&mes=2026-11&concursos=1,42",
    );
    expect(hrefEvento(42, 17, { de: "calendario", mes: "2026-11", selecao: null })).toBe(
      "/concursos/42?aba=eventos&evento=17&de=calendario&mes=2026-11",
    );
    expect(hrefEvento(42, 17, { de: "calendario", mes: "2026-11", selecao: [] })).toBe(
      "/concursos/42?aba=eventos&evento=17&de=calendario&mes=2026-11&concursos=",
    );
  });

  it("hrefPrazo escolhe pelo evento", () => {
    expect(hrefPrazo(3, { id: 9 })).toBe("/concursos/3?aba=eventos&evento=9");
    expect(hrefPrazo(3, null, { de: "dashboard" })).toBe(
      "/concursos/3?aba=geral&foco=validade&de=dashboard",
    );
  });
});

describe("lerIdEvento", () => {
  it("aceita inteiros positivos", () => {
    expect(lerIdEvento("17")).toBe(17);
  });

  it("rejeita ausente, repetido ou malformado", () => {
    for (const v of [undefined, null, "", "0", "-1", "1.5", "01", "abc", "17x", ["17"], 17]) {
      expect(lerIdEvento(v)).toBeNull();
    }
    expect(lerIdEvento("99999999999999999")).toBeNull();
  });
});

describe("lerOrigem", () => {
  it("sem `de` ou fora da allowlist não tem origem", () => {
    expect(lerOrigem({}, HOJE)).toBeNull();
    expect(lerOrigem({ de: "https://evil.example" }, HOJE)).toBeNull();
    expect(lerOrigem({ de: "/concursos" }, HOJE)).toBeNull();
    expect(lerOrigem({ de: "Dashboard" }, HOJE)).toBeNull();
  });

  it("lê dashboard e notificações (ignorando o resto)", () => {
    expect(lerOrigem({ de: "dashboard", mes: "2026-01" }, HOJE)).toEqual({ de: "dashboard" });
    expect(lerOrigem({ de: ["notificacoes", "dashboard"] }, HOJE)).toEqual({
      de: "notificacoes",
    });
  });

  it("normaliza mês e seleção do calendário", () => {
    expect(lerOrigem({ de: "calendario", mes: "2026-03", concursos: "3,1,x,3" }, HOJE)).toEqual({
      de: "calendario",
      mes: "2026-03",
      selecao: [1, 3],
    });
    expect(lerOrigem({ de: "calendario", mes: "2026-13" }, HOJE)).toEqual({
      de: "calendario",
      mes: "2026-11",
      selecao: null,
    });
  });
});

describe("linkVoltar", () => {
  it("volta para a lista sem origem", () => {
    expect(linkVoltar(null)).toEqual({ href: "/concursos", rotulo: "Concursos" });
  });

  it("volta para o dashboard e as notificações", () => {
    expect(linkVoltar({ de: "dashboard" })).toEqual({ href: "/", rotulo: "Dashboard" });
    expect(linkVoltar({ de: "notificacoes" })).toEqual({
      href: "/notificacoes",
      rotulo: "Notificações",
    });
  });

  it("volta ao mesmo mês e filtro do calendário", () => {
    expect(linkVoltar({ de: "calendario", mes: "2026-11", selecao: [1, 42] })).toEqual({
      href: "/calendario?mes=2026-11&concursos=1,42",
      rotulo: "Calendário · novembro de 2026",
    });
  });
});
