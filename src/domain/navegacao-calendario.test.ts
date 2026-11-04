import { describe, expect, it } from "vitest";
import type { Status, TipoEvento } from "./enums";
import type { EventoChave } from "./eventos-chave";
import {
  alternarConcurso,
  concursoVisivel,
  contarPorMes,
  filtrarPorSelecao,
  hrefCalendario,
  itensDoMes,
  lerSelecaoConcursos,
  mesesDoAno,
  normalizarSelecao,
  proximaProva,
  proximoMesComEventos,
  serializarSelecao,
  textoQuantidadeEventos,
} from "./navegacao-calendario";

const HOJE = "2026-11-02";

describe("lerSelecaoConcursos", () => {
  it("ausente = todos (null)", () => {
    expect(lerSelecaoConcursos(undefined)).toBeNull();
    expect(lerSelecaoConcursos(null)).toBeNull();
    expect(lerSelecaoConcursos(42)).toBeNull();
  });

  it("vazio = nenhum", () => {
    expect(lerSelecaoConcursos("")).toEqual([]);
    expect(lerSelecaoConcursos("  ")).toEqual([]);
  });

  it("IDs ordenados, sem repetição, ignorando os inválidos", () => {
    expect(lerSelecaoConcursos("3,1,3, 2")).toEqual([1, 2, 3]);
    expect(lerSelecaoConcursos("5,abc,-1,0,1.5,07,9")).toEqual([5, 9]);
  });

  it("nenhum ID válido num valor não vazio = todos", () => {
    expect(lerSelecaoConcursos("abc")).toBeNull();
    expect(lerSelecaoConcursos(",,")).toBeNull();
  });

  it("parâmetro repetido: vale o primeiro", () => {
    expect(lerSelecaoConcursos(["2", "1"])).toEqual([2]);
  });
});

describe("normalizarSelecao", () => {
  const todos = [1, 2, 3];

  it("todos selecionados volta a null", () => {
    expect(normalizarSelecao([3, 2, 1], todos)).toBeNull();
    expect(normalizarSelecao(null, todos)).toBeNull();
  });

  it("descarta IDs de outros usuários ou excluídos", () => {
    expect(normalizarSelecao([1, 99], todos)).toEqual([1]);
  });

  it("só IDs inexistentes = todos; vazio continua vazio", () => {
    expect(normalizarSelecao([99], todos)).toBeNull();
    expect(normalizarSelecao([], todos)).toEqual([]);
  });

  it("sem concursos = todos (null)", () => {
    expect(normalizarSelecao([], [])).toBeNull();
    expect(normalizarSelecao([1], [])).toBeNull();
  });
});

describe("serializarSelecao e hrefCalendario", () => {
  it("serializa em ordem; null = sem parâmetro", () => {
    expect(serializarSelecao([3, 1])).toBe("1,3");
    expect(serializarSelecao([])).toBe("");
    expect(serializarSelecao(null)).toBeNull();
  });

  it("link com o mês e a seleção, ida e volta", () => {
    expect(hrefCalendario("2026-11")).toBe("/calendario?mes=2026-11");
    expect(hrefCalendario("2026-11", [3, 1])).toBe("/calendario?mes=2026-11&concursos=1,3");
    expect(hrefCalendario("2027-01", [])).toBe("/calendario?mes=2027-01&concursos=");
    const url = new URL(hrefCalendario("2026-11", [4, 2]), "http://x");
    expect(lerSelecaoConcursos(url.searchParams.get("concursos"))).toEqual([2, 4]);
  });
});

describe("alternarConcurso", () => {
  const todos = [1, 2, 3];

  it("de todos, desligar um mostra os demais", () => {
    expect(alternarConcurso(null, 2, todos)).toEqual([1, 3]);
  });

  it("religar o último que faltava volta a todos", () => {
    expect(alternarConcurso([1, 3], 2, todos)).toBeNull();
  });

  it("desligar o único deixa nenhum; religar mostra só ele", () => {
    expect(alternarConcurso([2], 2, todos)).toEqual([]);
    expect(alternarConcurso([], 2, todos)).toEqual([2]);
  });
});

describe("visibilidade e filtro", () => {
  const itens = [1, 2, 3].map((id) => ({ concurso: { id } }));

  it("null mostra tudo; lista filtra", () => {
    expect(concursoVisivel(null, 7)).toBe(true);
    expect(concursoVisivel([1], 7)).toBe(false);
    expect(filtrarPorSelecao(itens, null)).toEqual(itens);
    expect(filtrarPorSelecao(itens, [1, 3]).map((i) => i.concurso.id)).toEqual([1, 3]);
    expect(filtrarPorSelecao(itens, [])).toEqual([]);
  });
});

describe("contagem por mês e próximo mês com eventos", () => {
  const datas = ["2026-11-05", "2026-11-20", "2027-02-01", "2025-12-31"].map((data) => ({ data }));

  it("conta por mês", () => {
    expect(Object.fromEntries(contarPorMes(datas))).toEqual({
      "2026-11": 2,
      "2027-02": 1,
      "2025-12": 1,
    });
  });

  it("próximo mês estritamente depois do exibido, atravessando o ano", () => {
    const contagens = contarPorMes(datas);
    expect(proximoMesComEventos(contagens, "2026-11")).toBe("2027-02");
    expect(proximoMesComEventos(contagens, "2026-10")).toBe("2026-11");
    expect(proximoMesComEventos(contagens, "2025-01")).toBe("2025-12");
    expect(proximoMesComEventos(contagens, "2027-02")).toBeNull();
    expect(proximoMesComEventos(new Map(), "2026-11")).toBeNull();
  });

  it("recorte do mês preserva a ordem", () => {
    expect(itensDoMes(datas, "2026-11")).toEqual([datas[0], datas[1]]);
  });
});

describe("proximaProva", () => {
  let id = 1;
  const item = (
    concursoId: number,
    tipo: TipoEvento,
    data: string,
    { status = "INSCRITO" as Status, concluido = false, derivado = false } = {},
  ) => {
    const evento: EventoChave = { id: id++, tipo, titulo: null, data, hora: null, concluido };
    return { evento: derivado ? null : evento, concurso: { id: concursoId, status }, data };
  };

  it("a mais próxima entre os concursos, pela regra da contagem regressiva", () => {
    const itens = [
      item(1, "PROVA_OBJETIVA", "2026-10-30"), // já passou
      item(1, "PROVA_OBJETIVA", "2027-03-01"),
      item(2, "PROVA_DISCURSIVA", "2026-12-10"),
      item(2, "RESULTADO_FINAL", "2026-11-05"), // não é prova
      item(3, "PROVA_OBJETIVA", "2026-11-10", { concluido: true }),
      item(4, "PROVA_OBJETIVA", "2026-11-03", { status: "CANCELADO" }),
    ];
    const prova = proximaProva(itens, HOJE);
    expect(prova?.item).toBe(itens[2]);
    expect(prova?.contagem).toMatchObject({ dias: 38, texto: "faltam 38 dias" });
  });

  it("outra fase conta; itens derivados (validade) não", () => {
    const fase = item(5, "OUTRA_FASE", "2026-11-04");
    expect(proximaProva([item(6, "VALIDADE", HOJE, { derivado: true }), fase], HOJE)?.item).toBe(
      fase,
    );
  });

  it("sem provas futuras = null", () => {
    expect(proximaProva([item(1, "OUTRO", "2026-12-01")], HOJE)).toBeNull();
    expect(proximaProva([], HOJE)).toBeNull();
  });
});

describe("seletor de mês", () => {
  it("12 meses do ano", () => {
    expect(mesesDoAno(2026)).toHaveLength(12);
    expect(mesesDoAno(2026)[0]).toBe("2026-01");
    expect(mesesDoAno(2026)[11]).toBe("2026-12");
  });

  it("texto da quantidade", () => {
    expect(textoQuantidadeEventos(0)).toBe("nenhum evento");
    expect(textoQuantidadeEventos(1)).toBe("1 evento");
    expect(textoQuantidadeEventos(4)).toBe("4 eventos");
  });
});
