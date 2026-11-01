import { describe, expect, it } from "vitest";
import { STATUS, type Status } from "./enums";
import { COLUNAS_AGRUPADAS, COLUNAS_PRINCIPAIS, montarQuadro } from "./quadro";

describe("colunas do quadro", () => {
  it("principais seguem o pipeline", () => {
    expect(COLUNAS_PRINCIPAIS).toEqual([
      "PREVISTO",
      "EDITAL_PUBLICADO",
      "INSCRITO",
      "PROVA_AGENDADA",
      "PROVA_REALIZADA",
      "AGUARDANDO_RESULTADO",
      "APROVADO",
      "CLASSIFICADO",
      "NOMEADO",
    ]);
  });

  it("agrupadas são os demais status (encerrados e suspenso), sem repetição", () => {
    expect(COLUNAS_AGRUPADAS).toEqual([
      "REPROVADO",
      "EMPOSSADO",
      "DESISTIU",
      "NAO_INSCRITO",
      "SUSPENSO",
      "CANCELADO",
    ]);
    expect(new Set([...COLUNAS_PRINCIPAIS, ...COLUNAS_AGRUPADAS]).size).toBe(STATUS.length);
  });
});

describe("montarQuadro", () => {
  const item = (id: number, status: Status) => ({ id, status });

  it("sem itens: todas as colunas, vazias", () => {
    const q = montarQuadro([]);
    expect(q.principais.map((c) => c.status)).toEqual(COLUNAS_PRINCIPAIS);
    expect(q.agrupadas.map((c) => c.status)).toEqual(COLUNAS_AGRUPADAS);
    expect([...q.principais, ...q.agrupadas].every((c) => c.itens.length === 0)).toBe(true);
    expect(q.totalAgrupadas).toBe(0);
  });

  it("distribui por status preservando a ordem de entrada", () => {
    const q = montarQuadro([
      item(1, "INSCRITO"),
      item(2, "CANCELADO"),
      item(3, "INSCRITO"),
      item(4, "NOMEADO"),
      item(5, "SUSPENSO"),
    ]);
    const ids = (status: Status) =>
      [...q.principais, ...q.agrupadas].find((c) => c.status === status)?.itens.map((i) => i.id);
    expect(ids("INSCRITO")).toEqual([1, 3]);
    expect(ids("NOMEADO")).toEqual([4]);
    expect(ids("CANCELADO")).toEqual([2]);
    expect(ids("SUSPENSO")).toEqual([5]);
    expect(ids("PREVISTO")).toEqual([]);
    expect(q.totalAgrupadas).toBe(2);
  });
});
