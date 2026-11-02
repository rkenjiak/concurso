import { describe, expect, it } from "vitest";
import { TIPO_EVENTO } from "./enums";
import {
  ANTECEDENCIA_MAXIMA,
  antecedenciaVigente,
  type ConcursoNotificavel,
  chaveNotificacao,
  contarNaoLidas,
  descreverAntecedencia,
  ehRegraPadrao,
  formatarAntecedencias,
  lerAntecedencias,
  lerChaveNotificacao,
  MAX_ANTECEDENCIAS,
  mesclarRegras,
  notificacoesDisparadas,
  REGRAS_PADRAO,
} from "./notificacoes";
import type { EventoPrazo } from "./prazos";

const HOJE = "2026-11-10";

let proximoId = 1;
function ev(parcial: Partial<EventoPrazo> & Pick<EventoPrazo, "data">): EventoPrazo {
  return {
    id: proximoId++,
    concursoId: 1,
    tipo: "FIM_INSCRICOES",
    titulo: null,
    hora: null,
    concluido: false,
    ...parcial,
  };
}

const ativo: ConcursoNotificavel = { id: 1, status: "INSCRITO" };
const padrao = mesclarRegras();

const disparadas = (
  eventos: EventoPrazo[],
  concursos: ConcursoNotificavel[] = [ativo],
  hoje = HOJE,
  regras = padrao,
) => notificacoesDisparadas(eventos, concursos, regras, hoje);

describe("regras padrão", () => {
  it("cobrem todos os tipos de evento, com antecedências válidas e ordenadas", () => {
    expect(Object.keys(REGRAS_PADRAO).sort()).toEqual([...TIPO_EVENTO].sort());
    for (const r of Object.values(REGRAS_PADRAO)) {
      expect(r.antecedencias.length).toBeGreaterThan(0);
      expect(r.antecedencias).toEqual([...r.antecedencias].sort((a, b) => b - a));
    }
  });

  it("seguem a sugestão da issue #65", () => {
    expect(REGRAS_PADRAO.FIM_INSCRICOES).toMatchObject({ ativo: true, antecedencias: [7, 1, 0] });
    expect(REGRAS_PADRAO.VENCIMENTO_BOLETO.antecedencias).toEqual([2, 0]);
    expect(REGRAS_PADRAO.PEDIDO_ISENCAO.antecedencias).toEqual([2, 0]);
    expect(REGRAS_PADRAO.PROVA_OBJETIVA.antecedencias).toEqual([7, 1]);
    expect(REGRAS_PADRAO.OUTRA_FASE.antecedencias).toEqual([7, 1]);
    expect(REGRAS_PADRAO.PRAZO_RECURSO.antecedencias).toEqual([1, 0]);
    expect(REGRAS_PADRAO.POSSE.antecedencias).toEqual([3, 0]);
    expect(REGRAS_PADRAO.VALIDADE.ativo).toBe(true);
    expect(REGRAS_PADRAO.OUTRO.ativo).toBe(false);
  });
});

describe("lerAntecedencias", () => {
  it("aceita vírgulas, espaços e ponto e vírgula; remove repetidas e ordena", () => {
    expect(lerAntecedencias("0, 7 1;7")).toEqual({ ok: true, dias: [7, 1, 0] });
    expect(lerAntecedencias(" 3 ")).toEqual({ ok: true, dias: [3] });
  });

  it("rejeita vazio, negativos, frações, texto e excesso", () => {
    expect(lerAntecedencias("")).toMatchObject({ ok: false });
    expect(lerAntecedencias("-1")).toMatchObject({ ok: false });
    expect(lerAntecedencias("1.5")).toMatchObject({ ok: false });
    expect(lerAntecedencias("sete")).toMatchObject({ ok: false });
    expect(lerAntecedencias(String(ANTECEDENCIA_MAXIMA + 1))).toMatchObject({ ok: false });
    const muitas = Array.from({ length: MAX_ANTECEDENCIAS + 1 }, (_, i) => i).join(",");
    expect(lerAntecedencias(muitas)).toMatchObject({ ok: false });
  });

  it("formata e descreve", () => {
    expect(formatarAntecedencias([7, 1, 0])).toBe("7, 1, 0");
    expect(descreverAntecedencia(0)).toBe("no dia");
    expect(descreverAntecedencia(1)).toBe("1 dia antes");
    expect(descreverAntecedencia(7)).toBe("7 dias antes");
  });
});

describe("mesclarRegras", () => {
  it("sem personalização, é o padrão", () => {
    expect(mesclarRegras()).toEqual(REGRAS_PADRAO);
  });

  it("sobrescreve só os tipos personalizados, normalizando as antecedências", () => {
    const regras = mesclarRegras([
      { tipo: "FIM_INSCRICOES", ativo: true, antecedencias: [0, 3, 3] },
      { tipo: "OUTRO", ativo: true, antecedencias: [1] },
      { tipo: "POSSE", ativo: false, antecedencias: [3, 0] },
    ]);
    expect(regras.FIM_INSCRICOES.antecedencias).toEqual([3, 0]);
    expect(regras.OUTRO).toEqual({ tipo: "OUTRO", ativo: true, antecedencias: [1] });
    expect(regras.POSSE.ativo).toBe(false);
    expect(regras.PROVA_OBJETIVA).toEqual(REGRAS_PADRAO.PROVA_OBJETIVA);
  });

  it("ignora itens inválidos (seguem o padrão)", () => {
    const regras = mesclarRegras([
      { tipo: "FIM_INSCRICOES", ativo: false, antecedencias: [] },
      { tipo: "POSSE", ativo: false, antecedencias: [-1] },
      // biome-ignore lint/suspicious/noExplicitAny: tipo desconhecido vindo do banco
      { tipo: "XYZ" as any, ativo: true, antecedencias: [1] },
    ]);
    expect(regras).toEqual(REGRAS_PADRAO);
  });

  it("ehRegraPadrao compara com o padrão do tipo", () => {
    expect(ehRegraPadrao({ tipo: "POSSE", ativo: true, antecedencias: [0, 3] })).toBe(true);
    expect(ehRegraPadrao({ tipo: "POSSE", ativo: true, antecedencias: [3] })).toBe(false);
    expect(ehRegraPadrao({ tipo: "POSSE", ativo: false, antecedencias: [3, 0] })).toBe(false);
  });
});

describe("antecedenciaVigente", () => {
  it("é a menor antecedência já alcançada", () => {
    expect(antecedenciaVigente([7, 1, 0], 8)).toBeNull();
    expect(antecedenciaVigente([7, 1, 0], 7)).toBe(7);
    expect(antecedenciaVigente([7, 1, 0], 5)).toBe(7);
    expect(antecedenciaVigente([7, 1, 0], 1)).toBe(1);
    expect(antecedenciaVigente([7, 1, 0], 0)).toBe(0);
    expect(antecedenciaVigente([7, 1], 0)).toBe(1);
  });
});

describe("chaves", () => {
  it("ida e volta", () => {
    expect(chaveNotificacao("evento-12", 7)).toBe("evento-12:7");
    expect(lerChaveNotificacao("evento-12:7")).toEqual({
      tipo: "evento",
      eventoId: 12,
      antecedencia: 7,
    });
    expect(lerChaveNotificacao("validade-3:90")).toEqual({
      tipo: "validade",
      concursoId: 3,
      antecedencia: 90,
    });
  });

  it("rejeita chaves inválidas", () => {
    for (const chave of ["evento-0:1", "evento-1", "evento-1:999", "prazo-1:1", "evento-1:-1", 5]) {
      expect(lerChaveNotificacao(chave)).toBeNull();
    }
  });
});

describe("notificacoesDisparadas", () => {
  it("antes da maior antecedência, nada; a partir dela, uma notificação por prazo", () => {
    const e = ev({ data: "2026-11-18" }); // 8 dias
    expect(disparadas([e])).toEqual([]);
    const [n, ...resto] = disparadas([e], [ativo], "2026-11-11"); // 7 dias
    expect(resto).toEqual([]);
    expect(n).toMatchObject({
      chave: `evento-${e.id}:7`,
      antecedencia: 7,
      dias: 7,
      disparadaEm: "2026-11-11",
      mensagem: "Fim das inscrições em 7 dias",
      lida: false,
    });
  });

  it("entre antecedências, continua valendo a última alcançada; troca na seguinte", () => {
    const e = ev({ data: "2026-11-15" });
    expect(disparadas([e], [ativo], "2026-11-12")[0]).toMatchObject({
      antecedencia: 7,
      mensagem: "Fim das inscrições em 3 dias",
    });
    expect(disparadas([e], [ativo], "2026-11-14")[0]).toMatchObject({
      chave: `evento-${e.id}:1`,
      mensagem: "Fim das inscrições é amanhã",
    });
  });

  it("antecedência 0: avisa no próprio dia", () => {
    const e = ev({ data: HOJE });
    expect(disparadas([e])[0]).toMatchObject({
      chave: `evento-${e.id}:0`,
      dias: 0,
      mensagem: "Fim das inscrições é hoje",
    });
  });

  it("depois da data, o aviso some", () => {
    expect(disparadas([ev({ data: "2026-11-09" })])).toEqual([]);
  });

  it("a chave não depende da data: retificação mantém a identidade (e o estado)", () => {
    const antes = ev({ data: "2026-11-15" });
    const depois = { ...antes, data: "2026-11-16" };
    const [a] = disparadas([antes]);
    const estados = new Map([[a?.chave as string, { lida: true, dispensada: false }]]);
    const [b] = notificacoesDisparadas([depois], [ativo], padrao, HOJE, estados);
    expect(b?.chave).toBe(a?.chave);
    expect(b).toMatchObject({ data: "2026-11-16", dias: 6, lida: true });
  });

  it("estado: lida marca, dispensada remove", () => {
    const e1 = ev({ data: "2026-11-12" });
    const e2 = ev({ data: "2026-11-13" });
    const estados = new Map([
      [`evento-${e1.id}:7`, { lida: true, dispensada: false }],
      [`evento-${e2.id}:7`, { lida: true, dispensada: true }],
    ]);
    const lista = notificacoesDisparadas([e1, e2], [ativo], padrao, HOJE, estados);
    expect(lista.map((n) => [n.chave, n.lida])).toEqual([[`evento-${e1.id}:7`, true]]);
    expect(contarNaoLidas(lista)).toBe(0);
  });

  it("dispensar uma antecedência não cala a próxima", () => {
    const e = ev({ data: "2026-11-11" });
    const estados = new Map([[`evento-${e.id}:7`, { lida: true, dispensada: true }]]);
    expect(notificacoesDisparadas([e], [ativo], padrao, HOJE, estados)[0]?.chave).toBe(
      `evento-${e.id}:1`,
    );
  });

  it("ignora concluídos, concursos encerrados, silenciados ou ausentes e tipos desligados", () => {
    const outros: ConcursoNotificavel[] = [
      ativo,
      { id: 2, status: "EMPOSSADO" },
      { id: 3, status: "INSCRITO", notificacoesSilenciadas: true },
    ];
    const eventos = [
      ev({ data: "2026-11-11", concluido: true }),
      ev({ data: "2026-11-11", concursoId: 2 }),
      ev({ data: "2026-11-11", concursoId: 3 }),
      ev({ data: "2026-11-11", concursoId: 9 }),
      ev({ data: "2026-11-11", tipo: "OUTRO" }),
      ev({ data: "data-ruim" }),
    ];
    expect(disparadas(eventos, outros)).toEqual([]);
  });

  it("concurso suspenso continua notificando (é acompanhado)", () => {
    expect(disparadas([ev({ data: HOJE })], [{ id: 1, status: "SUSPENSO" }])).toHaveLength(1);
  });

  it("regras personalizadas mudam os avisos", () => {
    const e = ev({ data: "2026-11-20", tipo: "OUTRO", titulo: "Entrega de títulos" });
    const regras = mesclarRegras([{ tipo: "OUTRO", ativo: true, antecedencias: [10] }]);
    expect(disparadas([e], [ativo], HOJE, regras)[0]).toMatchObject({
      nome: "Entrega de títulos",
      mensagem: "Entrega de títulos em 10 dias",
    });
    const desligadas = mesclarRegras([
      { tipo: "FIM_INSCRICOES", ativo: false, antecedencias: [7] },
    ]);
    expect(disparadas([ev({ data: HOJE })], [ativo], HOJE, desligadas)).toEqual([]);
  });

  it("fim da validade derivado (sem evento VALIDADE explícito)", () => {
    const comValidade: ConcursoNotificavel = {
      id: 5,
      status: "APROVADO",
      validadeFim: "2027-01-08",
    };
    const [n] = disparadas([], [comValidade]); // 59 dias
    expect(n).toMatchObject({
      chave: "validade-5:90",
      evento: null,
      tipo: "VALIDADE",
      nome: "Fim da validade do concurso",
      dias: 59,
    });
    const explicito = ev({ concursoId: 5, tipo: "VALIDADE", data: "2028-01-01" });
    expect(disparadas([explicito], [comValidade])).toEqual([]);
  });

  it("ordena das mais recentes para as mais antigas", () => {
    const longe = ev({ data: "2026-11-17", tipo: "PROVA_OBJETIVA" }); // disparou hoje (7)
    const perto = ev({ data: "2026-11-11", tipo: "PRAZO_RECURSO" }); // disparou hoje (1)
    const antiga = ev({ data: "2026-11-15" }); // disparou em 08/11 (7)
    expect(disparadas([antiga, longe, perto]).map((n) => n.evento?.id)).toEqual([
      perto.id,
      longe.id,
      antiga.id,
    ]);
  });

  it("rejeita hoje inválido", () => {
    expect(() => disparadas([], [ativo], "10/11/2026")).toThrow(RangeError);
  });
});
