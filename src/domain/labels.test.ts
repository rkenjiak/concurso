import { describe, expect, it } from "vitest";
import {
  ESCOLARIDADE,
  ESFERA,
  FASE,
  SITUACAO_FASE,
  STATUS,
  TIPO_EVENTO,
  TIPO_LINK,
  UF,
} from "./enums";
import {
  DESCRICAO_STATUS,
  opcoes,
  ROTULO_ESCOLARIDADE,
  ROTULO_ESFERA,
  ROTULO_FASE,
  ROTULO_SITUACAO_FASE,
  ROTULO_STATUS,
  ROTULO_TIPO_EVENTO,
  ROTULO_TIPO_LINK,
  ROTULO_UF,
} from "./labels";

const pares: [string, readonly string[], Readonly<Record<string, string>>][] = [
  ["Status", STATUS, ROTULO_STATUS],
  ["Status (descrição)", STATUS, DESCRICAO_STATUS],
  ["Esfera", ESFERA, ROTULO_ESFERA],
  ["Escolaridade", ESCOLARIDADE, ROTULO_ESCOLARIDADE],
  ["TipoLink", TIPO_LINK, ROTULO_TIPO_LINK],
  ["TipoEvento", TIPO_EVENTO, ROTULO_TIPO_EVENTO],
  ["Fase", FASE, ROTULO_FASE],
  ["SituacaoFase", SITUACAO_FASE, ROTULO_SITUACAO_FASE],
  ["UF", UF, ROTULO_UF],
];

describe("labels", () => {
  it.each(pares)("%s: todo valor tem rótulo não vazio e não há sobras", (_, valores, rotulos) => {
    expect(Object.keys(rotulos).sort()).toEqual([...valores].sort());
    for (const v of valores) expect(rotulos[v]?.trim()).not.toBe("");
  });

  it("rótulos de status são únicos e em pt-BR", () => {
    const valores = Object.values(ROTULO_STATUS);
    expect(new Set(valores).size).toBe(valores.length);
    expect(ROTULO_STATUS.NAO_INSCRITO).toBe("Não inscrito");
    expect(ROTULO_STATUS.AGUARDANDO_RESULTADO).toBe("Aguardando resultado");
  });

  it("UF tem as 27 unidades federativas", () => {
    expect(UF).toHaveLength(27);
    expect(ROTULO_UF.SP).toBe("São Paulo");
  });

  it("opcoes() mantém a ordem do enum", () => {
    expect(opcoes(ESFERA, ROTULO_ESFERA)).toEqual([
      { valor: "FEDERAL", rotulo: "Federal" },
      { valor: "ESTADUAL", rotulo: "Estadual" },
      { valor: "MUNICIPAL", rotulo: "Municipal" },
      { valor: "DISTRITAL", rotulo: "Distrital" },
    ]);
  });
});
