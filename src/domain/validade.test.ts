import { describe, expect, it } from "vitest";
import {
  calcularValidadeFim,
  type DadosValidade,
  DIAS_ALERTA_VALIDADE,
  descreverValidade,
  ehValidadeMeses,
  situacaoValidade,
  somarMeses,
  type Validade,
} from "./validade";

const base: DadosValidade = {
  homologacaoData: "2026-03-15",
  validadeMeses: 24,
  validadeProrrogada: false,
  validadeFimManual: null,
};

describe("somarMeses", () => {
  it.each([
    ["2026-03-15", 0, "2026-03-15"],
    ["2026-03-15", 1, "2026-04-15"],
    ["2026-11-30", 2, "2027-01-30"],
    ["2026-03-15", 24, "2028-03-15"],
    ["2026-12-01", 13, "2028-01-01"],
  ])("%s + %i meses = %s", (data, meses, esperado) => {
    expect(somarMeses(data, meses)).toBe(esperado);
  });

  it("usa o último dia do mês quando o dia não existe", () => {
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMeses("2026-03-31", 1)).toBe("2026-04-30");
    expect(somarMeses("2026-08-31", 3)).toBe("2026-11-30");
  });

  it("respeita anos bissextos (inclusive regras de 100 e 400 anos)", () => {
    expect(somarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(somarMeses("2024-02-29", 12)).toBe("2025-02-28");
    expect(somarMeses("2024-02-29", 48)).toBe("2028-02-29");
    expect(somarMeses("2100-01-31", 1)).toBe("2100-02-28");
    expect(somarMeses("2000-01-31", 1)).toBe("2000-02-29");
  });

  it("rejeita data ou meses inválidos", () => {
    expect(() => somarMeses("2026-02-30", 1)).toThrow(RangeError);
    expect(() => somarMeses("2026-01-01", -1)).toThrow(RangeError);
    expect(() => somarMeses("2026-01-01", 1.5)).toThrow(RangeError);
  });
});

describe("ehValidadeMeses", () => {
  it("aceita inteiros de 1 a 24", () => {
    expect([1, 12, 24].every(ehValidadeMeses)).toBe(true);
    expect([0, 25, -3, 6.5, Number.NaN].some(ehValidadeMeses)).toBe(false);
  });
});

describe("calcularValidadeFim", () => {
  it("homologação + meses", () => {
    expect(calcularValidadeFim(base)).toBe("2028-03-15");
    expect(calcularValidadeFim({ ...base, validadeMeses: 6 })).toBe("2026-09-15");
  });

  it("prorrogada: soma o mesmo período a partir do primeiro fim", () => {
    expect(calcularValidadeFim({ ...base, validadeProrrogada: true })).toBe("2030-03-15");
    // 31/08 + 6 = 28/02 (fim do mês); + 6 = 28/08 — a prorrogação parte do primeiro fim.
    expect(
      calcularValidadeFim({
        ...base,
        homologacaoData: "2025-08-31",
        validadeMeses: 6,
        validadeProrrogada: true,
      }),
    ).toBe("2026-08-28");
  });

  it("data manual sobrescreve o cálculo, mesmo sem homologação", () => {
    expect(calcularValidadeFim({ ...base, validadeFimManual: "2027-01-10" })).toBe("2027-01-10");
    expect(
      calcularValidadeFim({
        homologacaoData: null,
        validadeMeses: null,
        validadeProrrogada: true,
        validadeFimManual: "2027-01-10",
      }),
    ).toBe("2027-01-10");
  });

  it("indefinida sem homologação ou sem meses", () => {
    expect(calcularValidadeFim({ ...base, homologacaoData: null })).toBeNull();
    expect(calcularValidadeFim({ ...base, validadeMeses: null })).toBeNull();
  });

  it("ignora dados inválidos", () => {
    expect(calcularValidadeFim({ ...base, validadeFimManual: "2026-02-30" })).toBe("2028-03-15");
    expect(calcularValidadeFim({ ...base, homologacaoData: "15/03/2026" })).toBeNull();
    expect(calcularValidadeFim({ ...base, validadeMeses: 0 })).toBeNull();
    expect(calcularValidadeFim({ ...base, validadeMeses: 25 })).toBeNull();
  });
});

describe("situacaoValidade", () => {
  const fim = "2028-03-15";

  it("indefinida", () => {
    expect(situacaoValidade({ ...base, homologacaoData: null }, "2026-10-31")).toEqual({
      fim: null,
      origem: null,
      diasRestantes: null,
      situacao: "INDEFINIDA",
    });
  });

  it("vigente quando faltam mais de 90 dias", () => {
    expect(situacaoValidade(base, "2026-10-31")).toMatchObject({
      fim,
      origem: "CALCULADA",
      diasRestantes: 501,
      situacao: "VIGENTE",
    });
  });

  it("vencendo de 90 dias até o último dia (inclusive)", () => {
    const limite = "2027-12-16"; // fim - 90 dias
    expect(situacaoValidade(base, "2027-12-15")).toMatchObject({
      diasRestantes: DIAS_ALERTA_VALIDADE + 1,
      situacao: "VIGENTE",
    });
    expect(situacaoValidade(base, limite)).toMatchObject({
      diasRestantes: DIAS_ALERTA_VALIDADE,
      situacao: "VENCENDO",
    });
    expect(situacaoValidade(base, fim)).toMatchObject({ diasRestantes: 0, situacao: "VENCENDO" });
  });

  it("expirada após o fim", () => {
    expect(situacaoValidade(base, "2028-03-16")).toMatchObject({
      diasRestantes: -1,
      situacao: "EXPIRADA",
    });
  });

  it("indica a origem manual", () => {
    expect(
      situacaoValidade({ ...base, validadeFimManual: "2026-11-30" }, "2026-10-31"),
    ).toMatchObject({ fim: "2026-11-30", origem: "MANUAL", diasRestantes: 30 });
  });

  it("rejeita hoje inválido", () => {
    expect(() => situacaoValidade(base, "31/10/2026")).toThrow(RangeError);
  });
});

describe("descreverValidade", () => {
  const com = (diasRestantes: number | null): Validade => ({
    fim: null,
    origem: null,
    diasRestantes,
    situacao: "VIGENTE",
  });

  it.each([
    [null, "Validade não definida"],
    [0, "vence hoje"],
    [1, "vence amanhã"],
    [45, "vence em 45 dias"],
    [-1, "expirou ontem"],
    [-10, "expirou há 10 dias"],
  ])("%s → %s", (dias, texto) => {
    expect(descreverValidade(com(dias))).toBe(texto);
  });
});
