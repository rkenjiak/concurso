import { describe, expect, it } from "vitest";
import { dataSP, diasEntre, ehDataISO, hojeSP, instanteSP, somarDias } from "./tz";

describe("hojeSP", () => {
  it("usa o calendário de São Paulo, não o UTC", () => {
    // 01/03/2026 02:30 UTC = 28/02/2026 23:30 em São Paulo (UTC-3)
    expect(hojeSP(new Date("2026-03-01T02:30:00Z"))).toBe("2026-02-28");
    expect(hojeSP(new Date("2026-03-01T03:00:00Z"))).toBe("2026-03-01");
  });

  it("aceita epoch ms", () => {
    expect(hojeSP(Date.UTC(2026, 11, 31, 12))).toBe("2026-12-31");
  });

  it("sem argumento usa o relógio atual", () => {
    expect(ehDataISO(hojeSP())).toBe(true);
  });
});

describe("dataSP", () => {
  it("converte instante para data de Brasília", () => {
    expect(dataSP(new Date("2026-06-15T00:00:00Z"))).toBe("2026-06-14");
  });
});

describe("instanteSP", () => {
  it("interpreta data/hora como horário de Brasília", () => {
    expect(instanteSP("2026-03-15", "13:00").toISOString()).toBe("2026-03-15T16:00:00.000Z");
  });

  it("usa meia-noite quando não há hora", () => {
    expect(instanteSP("2026-01-01").toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });

  it("rejeita entradas inválidas", () => {
    expect(() => instanteSP("2026-02-30")).toThrow(RangeError);
    expect(() => instanteSP("2026-02-10", "24:00")).toThrow(RangeError);
  });
});

describe("ehDataISO", () => {
  it.each([
    ["2026-02-28", true],
    ["2028-02-29", true],
    ["2026-02-29", false],
    ["2026-13-01", false],
    ["26-01-01", false],
    ["2026-1-1", false],
    ["", false],
  ])("%s → %s", (valor, esperado) => {
    expect(ehDataISO(valor)).toBe(esperado);
  });
});

describe("somarDias / diasEntre", () => {
  it("atravessa meses e anos", () => {
    expect(somarDias("2026-01-30", 2)).toBe("2026-02-01");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("calcula diferença em dias de calendário", () => {
    expect(diasEntre("2026-01-30", "2026-02-01")).toBe(2);
    expect(diasEntre("2026-02-01", "2026-01-30")).toBe(-2);
    expect(diasEntre("2026-05-10", "2026-05-10")).toBe(0);
  });

  it("rejeita datas inválidas", () => {
    expect(() => somarDias("31/12/2026", 1)).toThrow(RangeError);
    expect(() => diasEntre("2026-01-01", "x")).toThrow(RangeError);
  });
});
