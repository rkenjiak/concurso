import { describe, expect, it } from "vitest";
import { agruparPorDia, grupoDoDia } from "./agrupar-por-dia";

const HOJE = "2026-03-01";

describe("grupoDoDia", () => {
  it("classifica hoje, ontem (atravessando o mês) e anteriores", () => {
    expect(grupoDoDia("2026-03-01", HOJE)).toBe("hoje");
    expect(grupoDoDia("2026-02-28", HOJE)).toBe("ontem");
    expect(grupoDoDia("2026-02-27", HOJE)).toBe("anteriores");
    expect(grupoDoDia("2025-12-31", HOJE)).toBe("anteriores");
  });

  it("reconhece ontem na virada do ano", () => {
    expect(grupoDoDia("2025-12-31", "2026-01-01")).toBe("ontem");
    expect(grupoDoDia("2025-12-30", "2026-01-01")).toBe("anteriores");
  });

  it("trata datas futuras como hoje", () => {
    expect(grupoDoDia("2026-03-02", HOJE)).toBe("hoje");
  });
});

describe("agruparPorDia", () => {
  const item = (id: string, dia: string) => ({ id, dia });

  it("agrupa na ordem Hoje, Ontem, Anteriores, preservando a ordem interna", () => {
    const itens = [
      item("a", "2026-02-20"),
      item("b", "2026-03-01"),
      item("c", "2026-02-28"),
      item("d", "2026-03-01"),
      item("e", "2026-01-05"),
    ];
    const grupos = agruparPorDia(itens, (i) => i.dia, HOJE);
    expect(grupos.map((g) => g.rotulo)).toEqual(["Hoje", "Ontem", "Anteriores"]);
    expect(grupos.map((g) => g.itens.map((i) => i.id))).toEqual([["b", "d"], ["c"], ["a", "e"]]);
  });

  it("omite grupos vazios", () => {
    const grupos = agruparPorDia([item("a", "2026-02-10")], (i) => i.dia, HOJE);
    expect(grupos).toEqual([
      { chave: "anteriores", rotulo: "Anteriores", itens: [item("a", "2026-02-10")] },
    ]);
    expect(agruparPorDia([], (i: { dia: string }) => i.dia, HOJE)).toEqual([]);
  });
});
