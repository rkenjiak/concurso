import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adicionar,
  agendarVencimento,
  DURACAO_LONGA_MS,
  DURACAO_PADRAO_MS,
  definirPausa,
  ESTADO_INICIAL,
  type EstadoAvisos,
  expirar,
  MAX_FILA,
  MAX_VISIVEIS,
  type NovoAviso,
  proximoVencimentoMs,
  remover,
  visiveis,
} from "./avisos";

function com(avisos: NovoAviso[], agora = 0): EstadoAvisos {
  return avisos.reduce((e, a) => adicionar(e, a, agora).estado, ESTADO_INICIAL);
}

const textos = (e: EstadoAvisos) => e.avisos.map((a) => a.texto);

describe("adicionar", () => {
  it("atribui ids crescentes e usa 'ok' como tipo padrão", () => {
    const r1 = adicionar(ESTADO_INICIAL, { texto: "A" }, 0);
    const r2 = adicionar(r1.estado, { texto: "B", tipo: "info" }, 0);
    expect([r1.id, r2.id]).toEqual([1, 2]);
    expect(r2.estado.avisos.map((a) => a.tipo)).toEqual(["ok", "info"]);
  });

  it("dura mais quando é erro ou tem ação; respeita duração explícita", () => {
    const acao = { rotulo: "Desfazer", executar: () => {} };
    const e = com([
      { texto: "ok" },
      { texto: "erro", tipo: "erro" },
      { texto: "acao", acao },
      { texto: "custom", duracaoMs: 1234 },
    ]);
    expect(e.avisos.map((a) => a.restanteMs)).toEqual([
      DURACAO_PADRAO_MS,
      DURACAO_LONGA_MS,
      DURACAO_LONGA_MS,
      1234,
    ]);
  });

  it("deduplica tipo + texto: o anterior sai e o novo vai para o fim com tempo cheio", () => {
    let e = com([{ texto: "Salvo." }, { texto: "Outro" }]);
    e = adicionar(e, { texto: "Salvo." }, 3000).estado;
    expect(textos(e)).toEqual(["Outro", "Salvo."]);
    expect(e.avisos[1]).toMatchObject({ id: 3, desde: 3000, restanteMs: DURACAO_PADRAO_MS });
  });

  it("mesmo texto com tipo diferente não é duplicata", () => {
    expect(com([{ texto: "X" }, { texto: "X", tipo: "erro" }]).avisos).toHaveLength(2);
  });

  it("deduplica pela chave quando informada", () => {
    const e = com([
      { texto: "“A” movido para “Inscrito”.", chave: "status-1" },
      { texto: "“A” movido para “Edital”.", chave: "status-1" },
      { texto: "“A” movido para “Edital”." },
    ]);
    expect(e.avisos.map((a) => a.chave)).toEqual(["status-1", undefined]);
  });

  it("mostra no máximo 3; os demais esperam sem contar tempo", () => {
    const e = com([{ texto: "1" }, { texto: "2" }, { texto: "3" }, { texto: "4" }]);
    expect(visiveis(e).map((a) => a.texto)).toEqual(["1", "2", "3"]);
    expect(e.avisos[MAX_VISIVEIS]?.desde).toBeNull();
  });

  it("limita a fila descartando os mais antigos", () => {
    const e = com(Array.from({ length: MAX_FILA + 2 }, (_, i) => ({ texto: String(i) })));
    expect(e.avisos).toHaveLength(MAX_FILA);
    expect(e.avisos[0]?.texto).toBe("2");
  });
});

describe("expiração", () => {
  it("expira no tempo certo e promove o próximo da fila", () => {
    let e = com([{ texto: "1" }, { texto: "2" }, { texto: "3" }, { texto: "4" }]);
    expect(proximoVencimentoMs(e, 1000)).toBe(DURACAO_PADRAO_MS - 1000);
    expect(expirar(e, DURACAO_PADRAO_MS - 1)).toBe(e);
    e = expirar(e, DURACAO_PADRAO_MS);
    expect(textos(e)).toEqual(["4"]);
    // O 4º só começou a contar ao aparecer.
    expect(e.avisos[0]).toMatchObject({ desde: DURACAO_PADRAO_MS, restanteMs: DURACAO_PADRAO_MS });
  });

  it("sem avisos ou com duração infinita não há vencimento", () => {
    expect(proximoVencimentoMs(ESTADO_INICIAL, 0)).toBeNull();
    const e = com([{ texto: "fixo", duracaoMs: Number.POSITIVE_INFINITY }]);
    expect(proximoVencimentoMs(e, 0)).toBeNull();
    expect(expirar(e, 1e12)).toBe(e);
  });

  it("vencimento atrasado devolve 0, nunca negativo", () => {
    expect(proximoVencimentoMs(com([{ texto: "a" }]), DURACAO_PADRAO_MS + 500)).toBe(0);
  });
});

describe("pausa", () => {
  it("pausar congela o tempo restante e retomar continua de onde parou", () => {
    let e = com([{ texto: "a" }]);
    const id = e.avisos[0]?.id ?? 0;
    e = definirPausa(e, id, true, 2000);
    expect(e.avisos[0]).toMatchObject({ pausado: true, desde: null, restanteMs: 4000 });
    expect(proximoVencimentoMs(e, 60_000)).toBeNull();
    expect(expirar(e, 60_000)).toBe(e);
    e = definirPausa(e, id, false, 60_000);
    expect(proximoVencimentoMs(e, 61_000)).toBe(3000);
    expect(expirar(e, 64_000).avisos).toHaveLength(0);
  });

  it("pausa repetida ou de id inexistente não muda o estado", () => {
    const e = definirPausa(com([{ texto: "a" }]), 1, true, 100);
    expect(definirPausa(e, 1, true, 500)).toBe(e);
    expect(definirPausa(e, 99, true, 500)).toBe(e);
  });

  it("aviso na fila pausado continua parado ao ser promovido", () => {
    let e = com([{ texto: "1" }, { texto: "2" }, { texto: "3" }, { texto: "4" }]);
    e = definirPausa(e, 4, true, 0);
    e = remover(e, 1, 100);
    expect(e.avisos[2]).toMatchObject({ texto: "4", pausado: true, desde: null });
  });
});

describe("remover", () => {
  it("fecha o aviso e promove o próximo", () => {
    let e = com([{ texto: "1" }, { texto: "2" }, { texto: "3" }, { texto: "4" }]);
    e = remover(e, 2, 500);
    expect(visiveis(e).map((a) => a.texto)).toEqual(["1", "3", "4"]);
    expect(e.avisos[2]?.desde).toBe(500);
  });

  it("id inexistente devolve o mesmo estado", () => {
    const e = com([{ texto: "1" }]);
    expect(remover(e, 42, 0)).toBe(e);
  });
});

describe("agendarVencimento", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("timer adiantado reagenda o que falta em vez de deixar o aviso preso", () => {
    vi.useFakeTimers();
    let relogio = 0;
    const aoVencer = vi.fn();
    const e = com([{ texto: "a" }]);
    agendarVencimento(e, aoVencer, () => relogio);

    // O timer dispara, mas o relógio ainda está 5 ms antes do prazo.
    relogio = DURACAO_PADRAO_MS - 5;
    vi.advanceTimersByTime(DURACAO_PADRAO_MS);
    expect(aoVencer).not.toHaveBeenCalled();

    relogio = DURACAO_PADRAO_MS;
    vi.advanceTimersByTime(5);
    expect(aoVencer).toHaveBeenCalledExactlyOnceWith(DURACAO_PADRAO_MS);
    expect(expirar(e, DURACAO_PADRAO_MS).avisos).toHaveLength(0);
  });

  it("chama no prazo, não agenda sem relógio correndo e pode ser cancelado", () => {
    vi.useFakeTimers();
    const aoVencer = vi.fn();
    agendarVencimento(ESTADO_INICIAL, aoVencer, () => 0);
    expect(vi.getTimerCount()).toBe(0);

    const cancelar = agendarVencimento(com([{ texto: "a" }]), aoVencer, () => 0);
    cancelar();
    vi.advanceTimersByTime(DURACAO_PADRAO_MS * 2);
    expect(aoVencer).not.toHaveBeenCalled();

    vi.setSystemTime(0);
    agendarVencimento(com([{ texto: "a" }]), aoVencer);
    vi.advanceTimersByTime(DURACAO_PADRAO_MS);
    expect(aoVencer).toHaveBeenCalledExactlyOnceWith(DURACAO_PADRAO_MS);
  });
});
