import { describe, expect, it } from "vitest";
import { STATUS, type Status, TIPO_EVENTO, type TipoEvento } from "./enums";
import {
  type ConcursoPrazo,
  compararPrazos,
  concursoAcompanhado,
  contarOcultos,
  criticidade,
  DIAS_CRITICIDADE_ALTA,
  DIAS_CRITICIDADE_MEDIA,
  descreverDias,
  type EventoPrazo,
  ehTipoCritico,
  JANELA_PADRAO_DIAS,
  lerChavePrazo,
  nomePrazo,
  proximaData,
  proximosPrazos,
  ROTULO_SITUACAO,
  semOcultos,
  situacaoPrazo,
  TIPOS_CRITICOS,
  totalPrazos,
} from "./prazos";
import { ehTerminal } from "./status";

const HOJE = "2026-10-31";

let proximoId = 1;
function ev(parcial: Partial<EventoPrazo> & Pick<EventoPrazo, "data">): EventoPrazo {
  return {
    id: proximoId++,
    concursoId: 1,
    tipo: "OUTRO",
    titulo: null,
    hora: null,
    concluido: false,
    ...parcial,
  };
}

const ativo: ConcursoPrazo = { id: 1, status: "INSCRITO" };

const chaves = (lista: { chave: string }[]) => lista.map((p) => p.chave);

describe("tipos críticos", () => {
  it("são exatamente os de §4.2", () => {
    expect([...TIPOS_CRITICOS].sort()).toEqual(
      [
        "FIM_INSCRICOES",
        "PEDIDO_ISENCAO",
        "VENCIMENTO_BOLETO",
        "PROVA_OBJETIVA",
        "PROVA_DISCURSIVA",
        "OUTRA_FASE",
        "PRAZO_RECURSO",
        "POSSE",
      ].sort(),
    );
  });

  it.each(TIPO_EVENTO)("ehTipoCritico(%s) é coerente com a lista", (tipo) => {
    expect(ehTipoCritico(tipo)).toBe((TIPOS_CRITICOS as readonly TipoEvento[]).includes(tipo));
  });
});

describe("criticidade", () => {
  it("janelas de 3 e 7 dias", () => {
    expect(DIAS_CRITICIDADE_ALTA).toBe(3);
    expect(DIAS_CRITICIDADE_MEDIA).toBe(7);
  });

  it.each([
    [-10, "ALTA"],
    [-1, "ALTA"],
    [0, "ALTA"],
    [1, "ALTA"],
    [3, "ALTA"],
    [4, "MEDIA"],
    [7, "MEDIA"],
    [8, "NORMAL"],
    [30, "NORMAL"],
  ] as const)("tipo crítico faltando %i dias → %s", (dias, esperado) => {
    expect(criticidade("VENCIMENTO_BOLETO", dias)).toBe(esperado);
  });

  it.each([-1, 0, 2, 5, 10])("tipo não crítico é sempre NORMAL (%i dias)", (dias) => {
    expect(criticidade("PUBLICACAO_EDITAL", dias)).toBe("NORMAL");
    expect(criticidade("VALIDADE", dias)).toBe("NORMAL");
  });
});

describe("concursoAcompanhado", () => {
  it.each(STATUS)("%s acompanhado ⇔ não terminal", (status: Status) => {
    expect(concursoAcompanhado(status)).toBe(!ehTerminal(status));
  });
});

describe("proximosPrazos", () => {
  it("agrupa em vencidos, hoje e próximos (janela inclusiva)", () => {
    const eventos = [
      ev({ id: 1, data: "2026-10-30", tipo: "FIM_INSCRICOES" }),
      ev({ id: 2, data: HOJE, tipo: "PROVA_OBJETIVA" }),
      ev({ id: 3, data: "2026-11-01" }),
      ev({ id: 4, data: "2026-11-30" }), // hoje + 30
      ev({ id: 5, data: "2026-12-01" }), // hoje + 31: fora da janela
    ];
    const g = proximosPrazos(eventos, [ativo], HOJE);
    expect(chaves(g.vencidos)).toEqual(["evento-1"]);
    expect(chaves(g.hoje)).toEqual(["evento-2"]);
    expect(chaves(g.proximos)).toEqual(["evento-3", "evento-4"]);
    expect(totalPrazos(g)).toBe(4);
  });

  it("usa janela padrão de 30 dias e aceita janela personalizada", () => {
    expect(JANELA_PADRAO_DIAS).toBe(30);
    const eventos = [ev({ id: 1, data: "2026-11-07" }), ev({ id: 2, data: "2026-11-08" })];
    expect(chaves(proximosPrazos(eventos, [ativo], HOJE, 7).proximos)).toEqual(["evento-1"]);
    const g0 = proximosPrazos([ev({ id: 3, data: HOJE }), ...eventos], [ativo], HOJE, 0);
    expect(chaves(g0.hoje)).toEqual(["evento-3"]);
    expect(g0.proximos).toEqual([]);
  });

  it("vencidos só incluem tipos críticos", () => {
    const eventos = [
      ev({ id: 1, data: "2026-10-01", tipo: "PUBLICACAO_EDITAL" }),
      ev({ id: 2, data: "2026-10-01", tipo: "PRAZO_RECURSO" }),
      ev({ id: 3, data: "2025-01-01", tipo: "VENCIMENTO_BOLETO" }),
    ];
    expect(chaves(proximosPrazos(eventos, [ativo], HOJE).vencidos)).toEqual([
      "evento-3",
      "evento-2",
    ]);
  });

  it("ignora eventos concluídos", () => {
    const eventos = [
      ev({ id: 1, data: "2026-10-30", tipo: "FIM_INSCRICOES", concluido: true }),
      ev({ id: 2, data: HOJE, concluido: true }),
      ev({ id: 3, data: "2026-11-02", concluido: true }),
    ];
    expect(totalPrazos(proximosPrazos(eventos, [ativo], HOJE))).toBe(0);
  });

  it("ignora concursos terminais e eventos sem concurso conhecido", () => {
    const concursos: ConcursoPrazo[] = [
      { id: 1, status: "EMPOSSADO" },
      { id: 2, status: "CANCELADO" },
      { id: 3, status: "REPROVADO" },
      { id: 4, status: "DESISTIU" },
      { id: 5, status: "NAO_INSCRITO" },
    ];
    const eventos = [1, 2, 3, 4, 5, 99].map((concursoId) =>
      ev({ concursoId, data: "2026-11-02", tipo: "POSSE" }),
    );
    expect(totalPrazos(proximosPrazos(eventos, concursos, HOJE))).toBe(0);
  });

  it.each(["APROVADO", "CLASSIFICADO", "NOMEADO", "SUSPENSO"] as const)(
    "considera eventos de concurso %s (convocação, nomeação, posse, validade)",
    (status) => {
      const eventos = (["CONVOCACAO", "NOMEACAO", "POSSE", "VALIDADE"] as const).map((tipo, i) =>
        ev({ id: 100 + i, data: "2026-11-05", tipo }),
      );
      const g = proximosPrazos(eventos, [{ id: 1, status }], HOJE);
      expect(g.proximos.map((p) => p.tipo).sort()).toEqual(
        ["CONVOCACAO", "NOMEACAO", "POSSE", "VALIDADE"].sort(),
      );
    },
  );

  it("calcula dias, criticidade e preserva evento e concurso de origem", () => {
    const concurso = { id: 7, status: "INSCRITO" as const, nome: "TRF" };
    const evento = {
      ...ev({ concursoId: 7, data: "2026-11-03", tipo: "VENCIMENTO_BOLETO" }),
      x: 1,
    };
    const [p] = proximosPrazos([evento], [concurso], HOJE).proximos;
    expect(p).toMatchObject({
      chave: `evento-${evento.id}`,
      evento,
      concurso,
      tipo: "VENCIMENTO_BOLETO",
      data: "2026-11-03",
      dias: 3,
      critico: true,
      criticidade: "ALTA",
      derivado: false,
    });
    expect(p?.concurso.nome).toBe("TRF");
    expect(p?.evento?.x).toBe(1);
  });

  it("ordena por data, sem hora primeiro, depois hora, depois criticidade", () => {
    const eventos = [
      ev({ id: 1, data: "2026-11-05", hora: "14:00" }),
      ev({ id: 2, data: "2026-11-05", hora: "09:00" }),
      ev({ id: 3, data: "2026-11-05" }),
      ev({ id: 4, data: "2026-11-02" }),
      ev({ id: 5, data: "2026-11-05", tipo: "PROVA_OBJETIVA" }),
      ev({ id: 6, data: "2026-11-05", hora: "09:00", tipo: "PROVA_DISCURSIVA" }),
    ];
    expect(chaves(proximosPrazos(eventos, [ativo], HOJE).proximos)).toEqual([
      "evento-4",
      "evento-5",
      "evento-3",
      "evento-6",
      "evento-2",
      "evento-1",
    ]);
  });

  it("desempata por concurso e evento", () => {
    const concursos: ConcursoPrazo[] = [
      { id: 2, status: "INSCRITO" },
      { id: 1, status: "INSCRITO" },
    ];
    const eventos = [
      ev({ id: 30, concursoId: 2, data: "2026-11-02" }),
      ev({ id: 20, concursoId: 1, data: "2026-11-02" }),
      ev({ id: 10, concursoId: 1, data: "2026-11-02" }),
    ];
    expect(chaves(proximosPrazos(eventos, concursos, HOJE).proximos)).toEqual([
      "evento-10",
      "evento-20",
      "evento-30",
    ]);
  });

  it("prazos críticos fora das janelas ficam NORMAL mas continuam críticos", () => {
    const [p] = proximosPrazos(
      [ev({ data: "2026-11-20", tipo: "FIM_INSCRICOES" })],
      [ativo],
      HOJE,
    ).proximos;
    expect(p).toMatchObject({ critico: true, criticidade: "NORMAL", dias: 20 });
  });

  it("criticidade média entre 4 e 7 dias; vencidos e hoje são altas", () => {
    const g = proximosPrazos(
      [
        ev({ id: 1, data: "2026-11-04", tipo: "PEDIDO_ISENCAO" }),
        ev({ id: 2, data: "2026-11-07", tipo: "PEDIDO_ISENCAO" }),
        ev({ id: 3, data: "2026-10-20", tipo: "PEDIDO_ISENCAO" }),
        ev({ id: 4, data: HOJE, tipo: "OUTRA_FASE" }),
      ],
      [ativo],
      HOJE,
    );
    expect(g.proximos.map((p) => p.criticidade)).toEqual(["MEDIA", "MEDIA"]);
    expect(g.vencidos[0]).toMatchObject({ criticidade: "ALTA", dias: -11 });
    expect(g.hoje[0]).toMatchObject({ criticidade: "ALTA", dias: 0 });
  });

  it("atravessa virada de mês e ano", () => {
    const g = proximosPrazos(
      [ev({ id: 1, data: "2027-01-02" }), ev({ id: 2, data: "2026-12-31", tipo: "POSSE" })],
      [ativo],
      "2026-12-31",
    );
    expect(g.hoje.map((p) => p.dias)).toEqual([0]);
    expect(g.proximos.map((p) => p.dias)).toEqual([2]);
  });

  it("considera ano bissexto", () => {
    const [p] = proximosPrazos([ev({ data: "2028-03-01" })], [ativo], "2028-02-28").proximos;
    expect(p?.dias).toBe(2);
  });

  describe("pseudo-evento de validade", () => {
    it("é gerado a partir de validadeFim quando não há evento VALIDADE", () => {
      const concurso: ConcursoPrazo = { id: 5, status: "CLASSIFICADO", validadeFim: "2026-11-15" };
      const g = proximosPrazos([], [concurso], HOJE);
      expect(g.proximos).toEqual([
        {
          chave: "validade-5",
          evento: null,
          concurso,
          tipo: "VALIDADE",
          titulo: null,
          data: "2026-11-15",
          hora: null,
          dias: 15,
          critico: false,
          criticidade: "NORMAL",
          derivado: true,
          oculto: false,
        },
      ]);
    });

    it("não é gerado se existir evento VALIDADE (mesmo concluído)", () => {
      const concurso: ConcursoPrazo = { id: 5, status: "APROVADO", validadeFim: "2026-11-15" };
      const concluido = ev({
        concursoId: 5,
        data: "2026-11-20",
        tipo: "VALIDADE",
        concluido: true,
      });
      expect(totalPrazos(proximosPrazos([concluido], [concurso], HOJE))).toBe(0);
      const aberto = ev({ concursoId: 5, data: "2026-11-20", tipo: "VALIDADE" });
      expect(chaves(proximosPrazos([aberto], [concurso], HOJE).proximos)).toEqual([
        `evento-${aberto.id}`,
      ]);
    });

    it("não é gerado para concurso terminal, validade ausente, inválida ou vencida", () => {
      const concursos: ConcursoPrazo[] = [
        { id: 1, status: "EMPOSSADO", validadeFim: "2026-11-15" },
        { id: 2, status: "APROVADO", validadeFim: null },
        { id: 3, status: "APROVADO" },
        { id: 4, status: "APROVADO", validadeFim: "2026-13-01" },
        { id: 5, status: "APROVADO", validadeFim: "2026-10-01" },
        { id: 6, status: "APROVADO", validadeFim: "2027-06-01" },
      ];
      expect(totalPrazos(proximosPrazos([], concursos, HOJE))).toBe(0);
    });

    it("aparece em hoje no último dia de validade", () => {
      const g = proximosPrazos([], [{ id: 1, status: "NOMEADO", validadeFim: HOJE }], HOJE);
      expect(chaves(g.hoje)).toEqual(["validade-1"]);
    });
  });

  it("ignora eventos com data inválida", () => {
    expect(totalPrazos(proximosPrazos([ev({ data: "2026-02-30" })], [ativo], HOJE))).toBe(0);
  });

  it.each(["", "31/10/2026", "2026-10-32"])("rejeita hoje inválido %j", (hoje) => {
    expect(() => proximosPrazos([], [], hoje)).toThrow(RangeError);
  });

  it.each([-1, 1.5, Number.NaN])("rejeita janela inválida %s", (janela) => {
    expect(() => proximosPrazos([], [], HOJE, janela)).toThrow(RangeError);
  });

  it("não depende da ordem de entrada nem a altera", () => {
    const eventos = [
      ev({ id: 1, data: "2026-11-10" }),
      ev({ id: 2, data: "2026-11-01" }),
      ev({ id: 3, data: "2026-11-05" }),
    ];
    const copia = [...eventos];
    const a = chaves(proximosPrazos(eventos, [ativo], HOJE).proximos);
    const b = chaves(proximosPrazos([...eventos].reverse(), [ativo], HOJE).proximos);
    expect(a).toEqual(["evento-2", "evento-3", "evento-1"]);
    expect(b).toEqual(a);
    expect(eventos).toEqual(copia);
  });
});

describe("prazos ocultos do dashboard (#44)", () => {
  const eventos = [
    ev({ id: 1, data: "2026-10-30", tipo: "FIM_INSCRICOES", ocultoDashboard: true }),
    ev({ id: 2, data: HOJE }),
    ev({ id: 3, data: "2026-11-05", ocultoDashboard: true }),
    ev({ id: 4, data: "2026-11-06", ocultoDashboard: false }),
  ];
  const concursos: ConcursoPrazo[] = [
    { ...ativo, validadeFim: "2026-11-10", validadeOcultaDashboard: true },
  ];

  it("marca os prazos ocultos sem removê-los dos grupos", () => {
    const g = proximosPrazos(eventos, concursos, HOJE);
    expect(g.vencidos.map((p) => [p.chave, p.oculto])).toEqual([["evento-1", true]]);
    expect(g.hoje.map((p) => [p.chave, p.oculto])).toEqual([["evento-2", false]]);
    expect(g.proximos.map((p) => [p.chave, p.oculto])).toEqual([
      ["evento-3", true],
      ["evento-4", false],
      ["validade-1", true],
    ]);
    expect(contarOcultos(g)).toBe(3);
  });

  it("semOcultos remove apenas os ocultos", () => {
    const g = semOcultos(proximosPrazos(eventos, concursos, HOJE));
    expect(chaves(g.vencidos)).toEqual([]);
    expect(chaves(g.hoje)).toEqual(["evento-2"]);
    expect(chaves(g.proximos)).toEqual(["evento-4"]);
    expect(contarOcultos(g)).toBe(0);
    expect(totalPrazos(g)).toBe(2);
  });

  it("sem a preferência, tudo é visível", () => {
    const g = proximosPrazos([ev({ id: 9, data: HOJE })], [{ ...ativo, validadeFim: HOJE }], HOJE);
    expect(g.hoje.every((p) => !p.oculto)).toBe(true);
    expect(contarOcultos(g)).toBe(0);
  });
});

describe("lerChavePrazo", () => {
  it("interpreta chaves de evento e de validade", () => {
    expect(lerChavePrazo("evento-12")).toEqual({ tipo: "evento", eventoId: 12 });
    expect(lerChavePrazo("validade-3")).toEqual({ tipo: "validade", concursoId: 3 });
  });

  it("rejeita chaves inválidas", () => {
    for (const chave of [
      "",
      "evento-",
      "evento-0",
      "evento-01",
      "evento--1",
      "evento-1.5",
      "outro-1",
      " evento-1",
      "evento-99999999999999999",
      12,
      null,
      undefined,
    ]) {
      expect(lerChavePrazo(chave)).toBeNull();
    }
  });
});

describe("compararPrazos", () => {
  const base = proximosPrazos([ev({ id: 1, data: "2026-11-02" })], [ativo], HOJE).proximos[0];
  if (!base) throw new Error("sem prazo base");

  it("é zero para o mesmo prazo e trata hora nula", () => {
    expect(compararPrazos(base, base)).toBe(0);
    const comHora = { ...base, hora: "10:00" };
    expect(compararPrazos(base, comHora)).toBeLessThan(0);
    expect(compararPrazos(comHora, base)).toBeGreaterThan(0);
  });

  it("prazo crítico antes do não crítico com mesma criticidade", () => {
    const critico = { ...base, critico: true };
    expect(compararPrazos(critico, base)).toBeLessThan(0);
    expect(compararPrazos(base, critico)).toBeGreaterThan(0);
  });

  it("pseudo-evento (sem id) vem antes no desempate final", () => {
    const pseudo = { ...base, evento: null };
    expect(compararPrazos(pseudo, base)).toBeLessThan(0);
  });
});

describe("proximaData", () => {
  it("menor data >= hoje entre eventos não concluídos", () => {
    expect(
      proximaData(
        [
          { data: "2026-12-01", concluido: false },
          { data: "2026-11-05", concluido: true },
          { data: "2026-10-01", concluido: false },
          { data: "2026-11-20", concluido: false },
        ],
        HOJE,
      ),
    ).toBe("2026-11-20");
  });

  it("inclui hoje", () => {
    expect(proximaData([{ data: HOJE, concluido: false }], HOJE)).toBe(HOJE);
  });

  it("null se não houver data futura pendente", () => {
    expect(proximaData([], HOJE)).toBeNull();
    expect(
      proximaData(
        [
          { data: "2026-10-30", concluido: false },
          { data: "2026-11-30", concluido: true },
          { data: "2026-02-30", concluido: false },
        ],
        HOJE,
      ),
    ).toBeNull();
  });
});

describe("descreverDias", () => {
  it.each([
    [0, "hoje"],
    [1, "amanhã"],
    [2, "em 2 dias"],
    [30, "em 30 dias"],
    [-1, "ontem"],
    [-5, "há 5 dias"],
  ])("%i → %s", (dias, texto) => {
    expect(descreverDias(dias)).toBe(texto);
  });
});

describe("nomePrazo (#100)", () => {
  it("título, rótulo do tipo ou fim da validade (derivado)", () => {
    expect(nomePrazo({ tipo: "PROVA_OBJETIVA", titulo: null })).toBe("Prova objetiva");
    expect(nomePrazo({ tipo: "PROVA_OBJETIVA", titulo: "Prova TJ" })).toBe("Prova TJ");
    expect(nomePrazo({ tipo: "PROVA_OBJETIVA", titulo: "Prova TJ", derivado: false })).toBe(
      "Prova TJ",
    );
    expect(nomePrazo({ tipo: "VALIDADE", titulo: null, derivado: true })).toBe(
      "Fim da validade do concurso",
    );
  });
});

describe("situacaoPrazo (#100, D11)", () => {
  const boleto = "VENCIMENTO_BOLETO" as const;

  it("concluído tem precedência sobre tudo, inclusive concurso encerrado", () => {
    expect(situacaoPrazo({ tipo: boleto, dias: -5, concluido: true })).toBe("CONCLUIDO");
    expect(situacaoPrazo({ tipo: "OUTRO", dias: 10, concluido: true })).toBe("CONCLUIDO");
    expect(situacaoPrazo({ tipo: boleto, dias: 1, concluido: true, status: "DESISTIU" })).toBe(
      "CONCLUIDO",
    );
  });

  it("vencido só para prazo crítico, pendente e de concurso acompanhado", () => {
    expect(situacaoPrazo({ tipo: boleto, dias: -1 })).toBe("VENCIDO");
    expect(situacaoPrazo({ tipo: boleto, dias: -1, status: "INSCRITO" })).toBe("VENCIDO");
    expect(situacaoPrazo({ tipo: boleto, dias: -1, status: "DESISTIU" })).toBeNull();
    expect(situacaoPrazo({ tipo: "OUTRO", dias: -1 })).toBeNull();
    expect(situacaoPrazo({ tipo: "VALIDADE", dias: -1 })).toBeNull();
  });

  it("urgente, esta semana e prazo crítico pelas faixas de criticidade", () => {
    expect(situacaoPrazo({ tipo: boleto, dias: 0 })).toBe("URGENTE");
    expect(situacaoPrazo({ tipo: boleto, dias: DIAS_CRITICIDADE_ALTA })).toBe("URGENTE");
    expect(situacaoPrazo({ tipo: boleto, dias: DIAS_CRITICIDADE_ALTA + 1 })).toBe("ESTA_SEMANA");
    expect(situacaoPrazo({ tipo: boleto, dias: DIAS_CRITICIDADE_MEDIA })).toBe("ESTA_SEMANA");
    expect(situacaoPrazo({ tipo: boleto, dias: DIAS_CRITICIDADE_MEDIA + 1 })).toBe("CRITICO");
  });

  it("tipos não críticos e concursos não acompanhados ficam sem badge", () => {
    expect(situacaoPrazo({ tipo: "GABARITO_PRELIMINAR", dias: 1 })).toBeNull();
    expect(situacaoPrazo({ tipo: boleto, dias: 1, status: "REPROVADO" })).toBeNull();
  });

  it("todas as situações têm rótulo", () => {
    expect(ROTULO_SITUACAO.VENCIDO).toBe("Vencido");
    expect(ROTULO_SITUACAO.ESTA_SEMANA).toBe("Esta semana");
  });
});
