import { describe, expect, it } from "vitest";
import {
  concursoEdicaoSchema,
  concursoSchema,
  VALORES_INICIAIS_CONCURSO,
  valoresDoConcurso,
} from "./concurso";

const base = { ...VALORES_INICIAIS_CONCURSO, orgao: "TRF 3ª Região", cargo: "Analista" };

describe("concursoSchema", () => {
  it("normaliza valores do formulário", () => {
    const r = concursoSchema.parse({
      ...base,
      orgao: "  TRF 3ª Região ",
      banca: " FCC ",
      esfera: "FEDERAL",
      uf: "SP",
      escolaridade: "SUPERIOR",
      remuneracao: "14.000,00",
      taxaInscricao: "R$ 130,50",
      vagasAmpla: "10",
      vagasCadastroReserva: "",
      vagasCotas: " 3 ",
      possuiCadastroReserva: true,
      status: "INSCRITO",
      observacoes: "**nota**",
      tags: [" Prioridade", "prioridade"],
    });
    expect(r).toEqual({
      orgao: "TRF 3ª Região",
      cargo: "Analista",
      banca: "FCC",
      esfera: "FEDERAL",
      uf: "SP",
      cidade: null,
      escolaridade: "SUPERIOR",
      remuneracao: 1_400_000,
      taxaInscricao: 13_050,
      vagasAmpla: 10,
      vagasCadastroReserva: null,
      possuiCadastroReserva: true,
      vagasCotas: 3,
      status: "INSCRITO",
      observacoes: "**nota**",
      tags: ["prioridade"],
      cor: null,
      icone: null,
      homologacaoData: null,
      validadeMeses: null,
      validadeProrrogada: false,
      validadeFimManual: null,
    });
  });

  it("lê os campos de validade", () => {
    const r = concursoSchema.parse({
      ...base,
      homologacaoData: "2026-03-15",
      validadeMeses: " 24 ",
      validadeProrrogada: true,
      validadeFimManual: "2028-03-15",
    });
    expect(r).toMatchObject({
      homologacaoData: "2026-03-15",
      validadeMeses: 24,
      validadeProrrogada: true,
      validadeFimManual: "2028-03-15",
    });
  });

  it("fim manual não pode ser anterior à homologação (criação e edição)", () => {
    const entrada = { ...base, homologacaoData: "2026-03-15", validadeFimManual: "2026-03-14" };
    for (const schema of [concursoSchema, concursoEdicaoSchema]) {
      const r = schema.safeParse(entrada);
      expect(r.error?.issues.map((i) => i.path)).toEqual([["validadeFimManual"]]);
    }
    expect(concursoSchema.safeParse({ ...entrada, homologacaoData: "" }).success).toBe(true);
  });

  it("campos opcionais vazios viram null", () => {
    const r = concursoSchema.parse(base);
    expect(r.banca).toBeNull();
    expect(r.esfera).toBeNull();
    expect(r.remuneracao).toBeNull();
    expect(r.vagasAmpla).toBeNull();
    expect(r.observacoes).toBeNull();
  });

  it("exige órgão e cargo", () => {
    const r = concursoSchema.safeParse({ ...base, orgao: "   ", cargo: "" });
    expect(r.success).toBe(false);
    const campos = r.error?.issues.map((i) => i.path[0]);
    expect(campos).toEqual(["orgao", "cargo"]);
    expect(r.error?.issues[0]?.message).toBe("Informe o nome ou órgão.");
  });

  it.each([
    ["remuneracao", "abc", "Valor em reais inválido."],
    ["taxaInscricao", "-10", "Valor em reais inválido."],
    ["vagasAmpla", "1,5", "Informe um número inteiro entre 0 e 1000000."],
    ["vagasCotas", "-1", "Informe um número inteiro entre 0 e 1000000."],
    ["esfera", "GALACTICA", "Esfera inválida."],
    ["uf", "XX", "UF inválida."],
    ["status", "INEXISTENTE", "Selecione o status."],
    ["homologacaoData", "2026-02-30", "Data inválida."],
    ["validadeFimManual", "15/03/2026", "Data inválida."],
    ["validadeMeses", "0", "Informe de 1 a 24 meses."],
    ["validadeMeses", "25", "Informe de 1 a 24 meses."],
    ["validadeMeses", "1,5", "Informe de 1 a 24 meses."],
  ])("rejeita %s = %j", (campo, valor, mensagem) => {
    const r = concursoSchema.safeParse({ ...base, [campo]: valor });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual([campo]);
    expect(r.error?.issues[0]?.message).toBe(mensagem);
  });

  it("limita o tamanho dos textos", () => {
    const r = concursoSchema.safeParse({ ...base, banca: "x".repeat(101) });
    expect(r.error?.issues[0]?.message).toBe("Use no máximo 100 caracteres.");
  });

  it("schema de edição ignora o status", () => {
    const r = concursoEdicaoSchema.parse({ ...base, status: "INEXISTENTE" });
    expect(r).not.toHaveProperty("status");
  });
});

describe("valoresDoConcurso", () => {
  it("converte o concurso persistido em valores de formulário (ida e volta)", () => {
    const valores = valoresDoConcurso({
      orgao: "TRF",
      cargo: "Analista",
      banca: null,
      esfera: "FEDERAL",
      uf: "SP",
      cidade: null,
      escolaridade: null,
      remuneracaoCentavos: 1_234_56,
      taxaInscricaoCentavos: null,
      vagasAmpla: 0,
      vagasCadastroReserva: null,
      possuiCadastroReserva: false,
      vagasCotas: 2,
      status: "PREVISTO",
      observacoes: null,
    });
    expect(valores).toMatchObject({
      banca: "",
      esfera: "FEDERAL",
      escolaridade: "",
      remuneracao: "1.234,56",
      taxaInscricao: "",
      vagasAmpla: "0",
      vagasCotas: "2",
      observacoes: "",
    });
    const dados = concursoSchema.parse(valores);
    expect(dados.remuneracao).toBe(123_456);
    expect(dados.vagasAmpla).toBe(0);
    expect(dados).toMatchObject({ homologacaoData: null, validadeMeses: null });
  });

  it("converte os campos de validade (ida e volta)", () => {
    const valores = valoresDoConcurso({
      ...VALORES_INICIAIS_CONCURSO,
      orgao: "TRF",
      cargo: "Analista",
      banca: null,
      esfera: null,
      uf: null,
      cidade: null,
      escolaridade: null,
      remuneracaoCentavos: null,
      taxaInscricaoCentavos: null,
      vagasAmpla: null,
      vagasCadastroReserva: null,
      vagasCotas: null,
      observacoes: null,
      cor: null,
      icone: null,
      homologacaoData: "2026-03-15",
      validadeMeses: 12,
      validadeProrrogada: true,
      validadeFimManual: null,
    });
    expect(valores).toMatchObject({
      homologacaoData: "2026-03-15",
      validadeMeses: "12",
      validadeProrrogada: true,
      validadeFimManual: "",
    });
    expect(concursoSchema.parse(valores)).toMatchObject({
      homologacaoData: "2026-03-15",
      validadeMeses: 12,
      validadeProrrogada: true,
      validadeFimManual: null,
    });
  });

  it("converte cor e ícone (ida e volta); sem cor = automática", () => {
    const base = {
      status: "PREVISTO" as const,
      possuiCadastroReserva: false,
      orgao: "TRF",
      cargo: "Analista",
      banca: null,
      esfera: null,
      uf: null,
      cidade: null,
      escolaridade: null,
      remuneracaoCentavos: null,
      taxaInscricaoCentavos: null,
      vagasAmpla: null,
      vagasCadastroReserva: null,
      vagasCotas: null,
      observacoes: null,
    };
    const valores = valoresDoConcurso({ ...base, cor: "VERDE_AGUA", icone: "⚖️" });
    expect(valores).toMatchObject({ cor: "VERDE_AGUA", icone: "⚖️" });
    expect(concursoSchema.parse(valores)).toMatchObject({ cor: "VERDE_AGUA", icone: "⚖️" });
    const sem = valoresDoConcurso({ ...base, cor: null, icone: null });
    expect(sem).toMatchObject({ cor: "", icone: "" });
    expect(concursoSchema.parse(sem)).toMatchObject({ cor: null, icone: null });
  });
});

describe("cor e ícone do concurso", () => {
  const valido = { ...VALORES_INICIAIS_CONCURSO, orgao: "TRF", cargo: "Analista" };

  it.each(["⚖️", "🏛️", "👩🏽‍⚖️", "🇧🇷", "★", "T"])("aceita um único símbolo (%s)", (icone) => {
    expect(concursoSchema.parse({ ...valido, icone }).icone).toBe(icone);
  });

  it("apara espaços do ícone", () => {
    expect(concursoSchema.parse({ ...valido, icone: "  🚓 " }).icone).toBe("🚓");
  });

  it.each(["⚖️🏛️", "ab", "texto longo"])("rejeita mais de um símbolo (%s)", (icone) => {
    const r = concursoSchema.safeParse({ ...valido, icone });
    expect(r.error?.issues).toMatchObject([
      { path: ["icone"], message: "Use um único emoji ou símbolo." },
    ]);
  });

  it("rejeita cor fora da paleta", () => {
    const r = concursoSchema.safeParse({ ...valido, cor: "VERMELHO" });
    expect(r.error?.issues).toMatchObject([{ path: ["cor"], message: "Cor inválida." }]);
  });
});
