import { describe, expect, it } from "vitest";
import { celulaCsv, centavosCsv, gerarCsv } from "./csv";

describe("celulaCsv", () => {
  it("converte valores simples", () => {
    expect(celulaCsv(null)).toBe("");
    expect(celulaCsv(undefined)).toBe("");
    expect(celulaCsv(42)).toBe("42");
    expect(celulaCsv(true)).toBe("sim");
    expect(celulaCsv(false)).toBe("não");
    expect(celulaCsv("Técnico")).toBe("Técnico");
  });

  it("envolve em aspas quando há separador, aspas ou quebra de linha", () => {
    expect(celulaCsv("a;b")).toBe('"a;b"');
    expect(celulaCsv('diz "oi"')).toBe('"diz ""oi"""');
    expect(celulaCsv("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"');
    expect(celulaCsv("a,b")).toBe("a,b");
    expect(celulaCsv("a,b", ",")).toBe('"a,b"');
  });

  it.each(["=1+1", "+55", "-2", "@soma", "\tx"])("neutraliza fórmula em %j", (texto) => {
    expect(celulaCsv(texto).replace(/^"/, "").startsWith("'")).toBe(true);
  });

  it("não altera números negativos", () => {
    expect(celulaCsv(-2)).toBe("-2");
  });
});

describe("gerarCsv", () => {
  it("gera BOM, separador ; e CRLF", () => {
    expect(
      gerarCsv(
        ["id", "nome"],
        [
          [1, "A"],
          [2, null],
        ],
      ),
    ).toBe("﻿id;nome\r\n1;A\r\n2;\r\n");
  });
});

describe("centavosCsv", () => {
  it.each([
    [null, ""],
    [0, "0,00"],
    [5, "0,05"],
    [123456, "1234,56"],
    [-150, "-1,50"],
  ] as const)("%j → %j", (centavos, esperado) => {
    expect(centavosCsv(centavos)).toBe(esperado);
  });
});
