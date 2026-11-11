import { describe, expect, it } from "vitest";
import { alternarTodos, estadoTodos, marcarItem, somenteVisiveis } from "./selecao";

const ORDEM = [10, 20, 30, 40, 50];
const lista = (s: Set<number>) => [...s].sort((a, b) => a - b);

describe("marcarItem", () => {
  it("marca e desmarca um item", () => {
    const s = marcarItem(new Set(), ORDEM, 20, true);
    expect(lista(s)).toEqual([20]);
    expect(lista(marcarItem(s, ORDEM, 20, false))).toEqual([]);
  });

  it("com âncora, aplica o estado a todo o intervalo, nos dois sentidos", () => {
    expect(lista(marcarItem(new Set([20]), ORDEM, 40, true, 20))).toEqual([20, 30, 40]);
    expect(lista(marcarItem(new Set([40]), ORDEM, 10, true, 40))).toEqual([10, 20, 30, 40]);
    expect(lista(marcarItem(new Set(ORDEM), ORDEM, 40, false, 20))).toEqual([10, 50]);
  });

  it("âncora fora da lista vale como clique simples", () => {
    expect(lista(marcarItem(new Set(), ORDEM, 30, true, 99))).toEqual([30]);
  });
});

describe("cabeçalho", () => {
  it("estado: nenhum, parcial (indeterminado) ou todos", () => {
    expect(estadoTodos(new Set(), ORDEM)).toBe(false);
    expect(estadoTodos(new Set([10]), ORDEM)).toBe("indeterminate");
    expect(estadoTodos(new Set(ORDEM), ORDEM)).toBe(true);
    expect(estadoTodos(new Set([99]), ORDEM)).toBe(false);
    expect(estadoTodos(new Set(), [])).toBe(false);
  });

  it("alternar: parcial ou nenhum marca todos; todos desmarca os visíveis", () => {
    expect(lista(alternarTodos(new Set([10]), ORDEM))).toEqual(ORDEM);
    expect(lista(alternarTodos(new Set([...ORDEM, 99]), ORDEM))).toEqual([99]);
  });

  it("somenteVisiveis descarta o que saiu da lista", () => {
    expect(lista(somenteVisiveis(new Set([10, 99]), ORDEM))).toEqual([10]);
  });
});
