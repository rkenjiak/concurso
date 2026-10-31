import { describe, expect, it } from "vitest";
import {
  formatarBRL,
  formatarData,
  formatarDataHora,
  formatarDataInstante,
  parseBRL,
} from "./format";

/** Intl usa espaço não separável entre "R$" e o número. */
const nbsp = (s: string) => s.replace(" ", " ");

describe("formatarBRL", () => {
  it.each([
    [123456, "R$ 1.234,56"],
    [0, "R$ 0,00"],
    [5, "R$ 0,05"],
    [1_400_000, "R$ 14.000,00"],
    [100_000_000_00, "R$ 100.000.000,00"],
  ])("%d centavos → %s", (centavos, esperado) => {
    expect(formatarBRL(centavos)).toBe(nbsp(esperado));
  });

  it("valor ausente vira traço", () => {
    expect(formatarBRL(null)).toBe("—");
    expect(formatarBRL(undefined)).toBe("—");
    expect(formatarBRL(Number.NaN)).toBe("—");
  });
});

describe("parseBRL", () => {
  it.each([
    ["R$ 1.234,56", 123456],
    ["R$ 1.234,56", 123456],
    ["1234,56", 123456],
    ["1.234", 123400],
    ["1.234.567,8", 123456780],
    ["1234.56", 123456],
    ["1234.5", 123450],
    ["1234", 123400],
    [",50", 50],
    ["0,05", 5],
    ["  R$ 14.000,00 ", 1_400_000],
  ])("%j → %d", (texto, esperado) => {
    expect(parseBRL(texto)).toBe(esperado);
  });

  it.each(["", "   ", "R$", "abc", "-10,00", "1,234,56", "12,345", "1.23,00", "12.34.56", "1e3"])(
    "%j é inválido",
    (texto) => {
      expect(parseBRL(texto)).toBeNull();
    },
  );

  it("null/undefined → null", () => {
    expect(parseBRL(null)).toBeNull();
    expect(parseBRL(undefined)).toBeNull();
  });

  it("faz ida e volta com formatarBRL", () => {
    for (const centavos of [0, 1, 99, 100, 123456, 987654321]) {
      expect(parseBRL(formatarBRL(centavos))).toBe(centavos);
    }
  });
});

describe("formatarData", () => {
  it("converte YYYY-MM-DD para dd/mm/aaaa sem deslocar o dia", () => {
    expect(formatarData("2026-03-01")).toBe("01/03/2026");
    expect(formatarData("2026-12-31")).toBe("31/12/2026");
  });

  it("valor ausente vira traço", () => {
    expect(formatarData(null)).toBe("—");
    expect(formatarData("")).toBe("—");
  });

  it("rejeita data inválida", () => {
    expect(() => formatarData("2026-02-30")).toThrow(RangeError);
  });
});

describe("formatarDataInstante / formatarDataHora", () => {
  // 01/03/2026 02:30 UTC = 28/02/2026 23:30 em São Paulo
  const instante = new Date("2026-03-01T02:30:00Z");

  it("exibe a data no fuso de São Paulo", () => {
    expect(formatarDataInstante(instante)).toBe("28/02/2026");
    expect(formatarDataInstante(instante.getTime())).toBe("28/02/2026");
  });

  it("exibe data e hora no fuso de São Paulo", () => {
    expect(formatarDataHora(instante)).toBe("28/02/2026 23:30");
    expect(formatarDataHora(new Date("2026-07-10T03:05:00Z"))).toBe("10/07/2026 00:05");
  });

  it("valor ausente vira traço", () => {
    expect(formatarDataInstante(null)).toBe("—");
    expect(formatarDataHora(undefined)).toBe("—");
  });
});
