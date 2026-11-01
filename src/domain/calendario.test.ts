import { describe, expect, it } from "vitest";
import {
  agruparPorData,
  DIAS_SEMANA,
  deslocarMes,
  diaDaSemana,
  diasNoMes,
  ehMesISO,
  itensCalendario,
  lerMes,
  mesDaData,
  montarGradeMes,
  primeiroDia,
  ultimoDia,
} from "./calendario";
import type { Status, TipoEvento } from "./enums";
import type { ConcursoPrazo, EventoPrazo } from "./prazos";

const HOJE = "2026-10-31";

describe("meses", () => {
  it("ehMesISO", () => {
    expect(ehMesISO("2026-10")).toBe(true);
    expect(ehMesISO("2026-1")).toBe(false);
    expect(ehMesISO("2026-13")).toBe(false);
    expect(ehMesISO("2026-00")).toBe(false);
    expect(ehMesISO("0999-12")).toBe(false);
    expect(ehMesISO("2026-10-01")).toBe(false);
  });

  it("mesDaData e lerMes (padrão = mês de hoje)", () => {
    expect(mesDaData("2026-02-28")).toBe("2026-02");
    expect(() => mesDaData("2026-02-30")).toThrow(RangeError);
    expect(lerMes("2027-01", HOJE)).toBe("2027-01");
    expect(lerMes(["2025-12", "x"], HOJE)).toBe("2025-12");
    expect(lerMes(undefined, HOJE)).toBe("2026-10");
    expect(lerMes("2026-13", HOJE)).toBe("2026-10");
    expect(lerMes(42, HOJE)).toBe("2026-10");
  });

  it("deslocarMes atravessa anos", () => {
    expect(deslocarMes("2026-10", 1)).toBe("2026-11");
    expect(deslocarMes("2026-12", 1)).toBe("2027-01");
    expect(deslocarMes("2026-01", -1)).toBe("2025-12");
    expect(deslocarMes("2026-03", -15)).toBe("2024-12");
    expect(deslocarMes("2026-03", 0)).toBe("2026-03");
    expect(() => deslocarMes("2026-3", 1)).toThrow(RangeError);
  });

  it("diasNoMes considera bissextos", () => {
    expect(diasNoMes("2026-01")).toBe(31);
    expect(diasNoMes("2026-04")).toBe(30);
    expect(diasNoMes("2026-02")).toBe(28);
    expect(diasNoMes("2024-02")).toBe(29);
    expect(diasNoMes("2000-02")).toBe(29);
    expect(diasNoMes("2100-02")).toBe(28);
    expect(primeiroDia("2024-02")).toBe("2024-02-01");
    expect(ultimoDia("2024-02")).toBe("2024-02-29");
    expect(() => primeiroDia("x")).toThrow(RangeError);
  });

  it("diaDaSemana (0 = domingo) sem depender de fuso", () => {
    expect(diaDaSemana("2026-10-31")).toBe(6);
    expect(diaDaSemana("2026-02-01")).toBe(0);
    expect(diaDaSemana("2024-02-29")).toBe(4);
    expect(diaDaSemana("0099-01-01")).toBe(new Date("0099-01-01T00:00:00Z").getUTCDay());
    expect(() => diaDaSemana("2026-02-30")).toThrow(RangeError);
    expect(DIAS_SEMANA[diaDaSemana("2026-11-02")]).toBe("seg");
  });
});

describe("montarGradeMes", () => {
  const datas = (g: ReturnType<typeof montarGradeMes>) => g.map((s) => s.map((d) => d.data));

  it("mês que começa no domingo e cabe em 4 semanas (fev/2026)", () => {
    const g = montarGradeMes("2026-02", HOJE);
    expect(g).toHaveLength(4);
    expect(g[0]?.[0]).toEqual({ data: "2026-02-01", dia: 1, doMes: true, hoje: false });
    expect(g[3]?.[6]?.data).toBe("2026-02-28");
    expect(g.flat().every((d) => d.doMes)).toBe(true);
  });

  it("completa com dias dos meses vizinhos e marca hoje (out/2026)", () => {
    const g = montarGradeMes("2026-10", HOJE);
    // 01/10/2026 é quinta: domingo anterior é 27/09.
    expect(g).toHaveLength(5);
    expect(datas(g)[0]).toEqual([
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
    expect(g[0]?.[0]).toMatchObject({ dia: 27, doMes: false });
    expect(g[4]?.[6]).toEqual({ data: "2026-10-31", dia: 31, doMes: true, hoje: true });
    expect(g.flat().filter((d) => d.hoje)).toHaveLength(1);
  });

  it("6 semanas quando o mês começa no sábado; vira o ano (jan/2028)", () => {
    // 01/01/2028 é sábado; 31 dias.
    const g = montarGradeMes("2028-01", HOJE);
    expect(g).toHaveLength(6);
    expect(g[0]?.[0]?.data).toBe("2027-12-26");
    expect(g[0]?.[6]?.data).toBe("2028-01-01");
    expect(g[5]?.[6]?.data).toBe("2028-02-05");
    expect(g.flat().some((d) => d.hoje)).toBe(false);
  });

  it("fevereiro bissexto (2024) termina em 29 e cada semana tem 7 dias", () => {
    const g = montarGradeMes("2024-02", "2024-02-29");
    expect(g.every((s) => s.length === 7)).toBe(true);
    const doMes = g.flat().filter((d) => d.doMes);
    expect(doMes).toHaveLength(29);
    expect(doMes.at(-1)).toMatchObject({ data: "2024-02-29", hoje: true });
    expect(g[0]?.[0]?.data).toBe("2024-01-28");
  });

  it("dezembro completa com janeiro do ano seguinte", () => {
    const g = montarGradeMes("2026-12", HOJE);
    expect(g.at(-1)?.at(-1)?.data).toBe("2027-01-02");
  });
});

describe("itensCalendario", () => {
  const concurso = (id: number, status: Status, validadeFim: string | null = null) =>
    ({ id, status, validadeFim }) satisfies ConcursoPrazo;
  let proximoId = 1;
  const evento = (
    concursoId: number,
    data: string,
    tipo: TipoEvento = "OUTRO",
    extra: Partial<EventoPrazo> = {},
  ): EventoPrazo => ({
    id: proximoId++,
    concursoId,
    tipo,
    titulo: null,
    data,
    hora: null,
    concluido: false,
    ...extra,
  });
  const INICIO = "2026-11-01";
  const FIM = "2026-11-30";

  it("filtra pelo período, ordena e destaca como o painel", () => {
    const concursos = [concurso(1, "INSCRITO")];
    const itens = itensCalendario(
      [
        evento(1, "2026-10-31"),
        evento(1, "2026-11-10", "OUTRO", { hora: "08:00" }),
        evento(1, "2026-11-02", "PROVA_OBJETIVA"),
        evento(1, "2026-11-10", "OUTRO"),
        evento(1, "2026-12-01"),
        evento(1, "2026-11-31"),
        evento(99, "2026-11-05"),
      ],
      concursos,
      INICIO,
      FIM,
      HOJE,
    );
    expect(itens.map((i) => [i.data, i.hora])).toEqual([
      ["2026-11-02", null],
      ["2026-11-10", null],
      ["2026-11-10", "08:00"],
    ]);
    expect(itens[0]).toMatchObject({
      critico: true,
      criticidade: "ALTA",
      dias: 2,
      esmaecido: false,
      derivado: false,
      concluido: false,
    });
  });

  it("esmaece concluídos e eventos de concursos encerrados (sem destaque)", () => {
    const itens = itensCalendario(
      [
        evento(1, "2026-11-01", "FIM_INSCRICOES", { concluido: true }),
        evento(2, "2026-11-02", "PROVA_OBJETIVA"),
      ],
      [concurso(1, "INSCRITO"), concurso(2, "DESISTIU")],
      INICIO,
      FIM,
      HOJE,
    );
    expect(itens.map((i) => [i.esmaecido, i.criticidade, i.concluido])).toEqual([
      [true, "NORMAL", true],
      [true, "NORMAL", false],
    ]);
  });

  it("vencidos pendentes críticos continuam em destaque", () => {
    const [item] = itensCalendario(
      [evento(1, "2026-10-20", "PRAZO_RECURSO")],
      [concurso(1, "AGUARDANDO_RESULTADO")],
      "2026-10-01",
      "2026-10-31",
      HOJE,
    );
    expect(item).toMatchObject({ dias: -11, criticidade: "ALTA" });
  });

  it("inclui o fim de validade calculado de concursos acompanhados sem evento VALIDADE", () => {
    const itens = itensCalendario(
      [evento(3, "2026-11-20", "VALIDADE")],
      [
        concurso(1, "CLASSIFICADO", "2026-11-15"),
        concurso(2, "EMPOSSADO", "2026-11-15"),
        concurso(3, "APROVADO", "2026-11-16"),
        concurso(4, "APROVADO", "2027-01-01"),
        concurso(5, "APROVADO", null),
      ],
      INICIO,
      FIM,
      HOJE,
    );
    expect(itens.map((i) => i.chave)).toEqual(["validade-1", `evento-${proximoId - 1}`]);
    expect(itens[0]).toMatchObject({
      tipo: "VALIDADE",
      derivado: true,
      evento: null,
      esmaecido: false,
      dias: 15,
    });
  });

  it("rejeita datas inválidas", () => {
    expect(() => itensCalendario([], [], "2026-11-31", FIM, HOJE)).toThrow(RangeError);
  });
});

describe("agruparPorData", () => {
  it("agrupa preservando a ordem", () => {
    const grupos = agruparPorData([
      { data: "2026-11-01", n: 1 },
      { data: "2026-11-01", n: 2 },
      { data: "2026-11-03", n: 3 },
    ]);
    expect([...grupos.keys()]).toEqual(["2026-11-01", "2026-11-03"]);
    expect(grupos.get("2026-11-01")?.map((i) => i.n)).toEqual([1, 2]);
  });
});
