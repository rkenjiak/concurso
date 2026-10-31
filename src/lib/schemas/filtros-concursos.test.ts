import { describe, expect, it } from "vitest";
import {
  contarFiltrosAvancados,
  FILTROS_VAZIOS,
  type FiltrosConcursos,
  filtrosParaBusca,
  lerFiltrosConcursos,
  MAX_BUSCA,
  parametrosDeEntradas,
  temFiltros,
} from "./filtros-concursos";

describe("lerFiltrosConcursos", () => {
  it("sem parâmetros retorna filtros vazios com a ordenação padrão", () => {
    expect(lerFiltrosConcursos({})).toEqual(FILTROS_VAZIOS);
  });

  it("lê todos os filtros válidos", () => {
    expect(
      lerFiltrosConcursos({
        q: "  técnico TRF ",
        status: ["INSCRITO", "PREVISTO"],
        esfera: "FEDERAL",
        uf: "sp",
        escolaridade: "SUPERIOR",
        remMin: "5.000,00",
        remMax: "R$ 12.000",
        ordem: "proxima_data",
      }),
    ).toEqual({
      busca: "técnico TRF",
      status: ["PREVISTO", "INSCRITO"],
      esfera: "FEDERAL",
      uf: "SP",
      escolaridade: "SUPERIOR",
      remuneracaoMin: 500_000,
      remuneracaoMax: 1_200_000,
      ordem: "proxima_data",
    });
  });

  it("aceita status único (links do dashboard) e lista separada por vírgula", () => {
    expect(lerFiltrosConcursos({ status: "APROVADO" }).status).toEqual(["APROVADO"]);
    expect(lerFiltrosConcursos({ status: "NOMEADO,APROVADO,APROVADO" }).status).toEqual([
      "APROVADO",
      "NOMEADO",
    ]);
  });

  it("ignora valores inválidos sem falhar", () => {
    expect(
      lerFiltrosConcursos({
        q: "   ",
        status: ["XYZ", ""],
        esfera: "GALACTICA",
        uf: "XX",
        escolaridade: "",
        remMin: "abc",
        remMax: "-10",
        ordem: "aleatoria",
      }),
    ).toEqual(FILTROS_VAZIOS);
  });

  it("usa o primeiro valor de parâmetros simples repetidos", () => {
    const f = lerFiltrosConcursos({ q: ["a", "b"], esfera: ["MUNICIPAL", "FEDERAL"] });
    expect(f).toMatchObject({ busca: "a", esfera: "MUNICIPAL" });
  });

  it("limita o tamanho da busca", () => {
    expect(lerFiltrosConcursos({ q: "x".repeat(500) }).busca).toHaveLength(MAX_BUSCA);
  });

  it("inverte a faixa de remuneração quando mínimo > máximo", () => {
    expect(lerFiltrosConcursos({ remMin: "10000", remMax: "3000" })).toMatchObject({
      remuneracaoMin: 300_000,
      remuneracaoMax: 1_000_000,
    });
    expect(lerFiltrosConcursos({ remMax: "3000" })).toMatchObject({
      remuneracaoMin: null,
      remuneracaoMax: 300_000,
    });
  });
});

describe("filtrosParaBusca", () => {
  it("sem filtros gera string vazia", () => {
    expect(filtrosParaBusca(FILTROS_VAZIOS)).toBe("");
  });

  it("gera URL canônica que volta aos mesmos filtros", () => {
    const filtros = lerFiltrosConcursos({
      q: "analista",
      status: ["INSCRITO", "PREVISTO"],
      esfera: "ESTADUAL",
      uf: "RJ",
      escolaridade: "MEDIO",
      remMin: "1500,5",
      remMax: "9000",
      ordem: "nome",
    });
    const busca = filtrosParaBusca(filtros);
    expect(busca).toBe(
      "?q=analista&status=PREVISTO&status=INSCRITO&esfera=ESTADUAL&uf=RJ&escolaridade=MEDIO" +
        "&remMin=1.500%2C50&remMax=9.000%2C00&ordem=nome",
    );
    const ida = new URLSearchParams(busca);
    expect(lerFiltrosConcursos(parametrosDeEntradas(ida))).toEqual(filtros);
  });
});

describe("parametrosDeEntradas", () => {
  it("agrupa valores repetidos e ignora arquivos", () => {
    const entradas: [string, FormDataEntryValue][] = [
      ["status", "A"],
      ["q", "x"],
      ["status", "B"],
      ["anexo", new File([], "a.txt")],
    ];
    expect(parametrosDeEntradas(entradas)).toEqual({ status: ["A", "B"], q: ["x"] });
  });
});

describe("contarFiltrosAvancados / temFiltros", () => {
  it("conta filtros além da busca e da ordenação", () => {
    expect(contarFiltrosAvancados(FILTROS_VAZIOS)).toBe(0);
    expect(temFiltros({ ...FILTROS_VAZIOS, ordem: "nome" })).toBe(false);
    expect(temFiltros({ ...FILTROS_VAZIOS, busca: "x" })).toBe(true);
    const f: FiltrosConcursos = {
      ...FILTROS_VAZIOS,
      status: ["PREVISTO", "INSCRITO"],
      uf: "SP",
      remuneracaoMin: 0,
    };
    expect(contarFiltrosAvancados(f)).toBe(3);
    expect(temFiltros(f)).toBe(true);
  });
});
