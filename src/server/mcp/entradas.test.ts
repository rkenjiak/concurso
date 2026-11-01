import { describe, expect, it } from "vitest";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import { VALORES_INICIAIS_RESULTADO_FASE } from "@/lib/schemas/resultado-fase";
import { valoresConcurso, valoresEvento, valoresResultado } from "./entradas";

describe("valoresConcurso", () => {
  it("converte reais, números e null para os valores do formulário", () => {
    const valores = valoresConcurso(VALORES_INICIAIS_CONCURSO, {
      orgao: "TRF3",
      cargo: "Analista",
      remuneracao: 13994.78,
      taxaInscricao: 85,
      vagasAmpla: 5,
      esfera: "FEDERAL",
      banca: null,
      possuiCadastroReserva: true,
    });
    expect(valores).toMatchObject({
      remuneracao: "13.994,78",
      taxaInscricao: "85,00",
      vagasAmpla: "5",
      esfera: "FEDERAL",
      banca: "",
      possuiCadastroReserva: true,
    });
    expect(concursoSchema.parse(valores)).toMatchObject({
      remuneracao: 1_399_478,
      taxaInscricao: 8500,
      vagasAmpla: 5,
      banca: null,
    });
  });

  it("mantém o que foi omitido e limpa o que veio null", () => {
    const base = { ...VALORES_INICIAIS_CONCURSO, banca: "FCC", uf: "SP" as const, tags: ["a"] };
    expect(valoresConcurso(base, { uf: null, tags: undefined, id: 3 })).toEqual({
      ...base,
      uf: "",
    });
  });

  it("valores negativos chegam ao schema e são recusados com mensagem", () => {
    const r = concursoSchema.safeParse(
      valoresConcurso(VALORES_INICIAIS_CONCURSO, { orgao: "X", cargo: "Y", remuneracao: -1 }),
    );
    expect(r.success).toBe(false);
  });
});

describe("valoresEvento e valoresResultado", () => {
  it("converte hora nula e decimais", () => {
    expect(
      valoresEvento(
        {
          tipo: "OUTRO",
          titulo: "",
          data: "",
          hora: "10:00",
          local: "",
          observacao: "",
          concluido: false,
        },
        { data: "2027-01-02", hora: null, concluido: null },
      ),
    ).toMatchObject({ data: "2027-01-02", hora: "", concluido: false });
    expect(
      valoresResultado(VALORES_INICIAIS_RESULTADO_FASE, { nota: 72.5, classificacaoGeral: 3 }),
    ).toMatchObject({ nota: "72,5", classificacaoGeral: "3" });
  });
});
