import { describe, expect, it } from "vitest";
import {
  compararContagens,
  contagemRegressiva,
  DIAS_CONTAGEM_PROXIMA,
  destaqueContagem,
  textoContagem,
  urgenciaContagem,
} from "./contagem";
import type { Status, TipoEvento } from "./enums";
import type { EventoChave } from "./eventos-chave";

const HOJE = "2026-11-02";

let proximoId = 1;
const ev = (tipo: TipoEvento, data: string, extra: Partial<EventoChave> = {}): EventoChave => ({
  id: proximoId++,
  tipo,
  titulo: null,
  data,
  concluido: false,
  ...extra,
});

describe("contagemRegressiva", () => {
  it("próxima prova com dias, texto e rótulo acessível", () => {
    const prova = ev("PROVA_OBJETIVA", "2026-11-14");
    expect(contagemRegressiva("INSCRITO", [prova], HOJE)).toEqual({
      evento: prova,
      dias: 12,
      destaque: "NORMAL",
      texto: "faltam 12 dias",
      rotulo: "Prova objetiva em 12 dias, 14/11/2026",
    });
  });

  it("hoje e amanhã", () => {
    expect(
      contagemRegressiva("PROVA_AGENDADA", [ev("PROVA_DISCURSIVA", HOJE)], HOJE),
    ).toMatchObject({
      dias: 0,
      destaque: "HOJE",
      texto: "é hoje",
      rotulo: "Prova discursiva hoje, 02/11/2026",
    });
    expect(
      contagemRegressiva(
        "PROVA_AGENDADA",
        [ev("OUTRA_FASE", "2026-11-03", { titulo: "TAF" })],
        HOJE,
      ),
    ).toMatchObject({
      dias: 1,
      destaque: "AMANHA",
      texto: "é amanhã",
      rotulo: "TAF amanhã, 03/11/2026",
    });
  });

  it("escolhe o evento mais próximo e ignora passados, concluídos e outros tipos", () => {
    const eventos = [
      ev("PROVA_OBJETIVA", "2026-11-01"),
      ev("PROVA_OBJETIVA", "2026-11-05", { concluido: true }),
      ev("FIM_INSCRICOES", "2026-11-04"),
      ev("PROVA_DISCURSIVA", "2026-12-20"),
      ev("PROVA_OBJETIVA", "2026-12-06"),
    ];
    expect(contagemRegressiva("INSCRITO", eventos, HOJE)?.evento.data).toBe("2026-12-06");
  });

  it("tipos configuráveis", () => {
    const eventos = [ev("RESULTADO_FINAL", "2026-11-04"), ev("PROVA_OBJETIVA", "2026-11-20")];
    expect(contagemRegressiva("INSCRITO", eventos, HOJE, ["RESULTADO_FINAL"])?.dias).toBe(2);
    expect(contagemRegressiva("INSCRITO", eventos, HOJE)?.dias).toBe(18);
  });

  it("sem contagem para encerrados, cancelados, desistência e suspensos", () => {
    const eventos = [ev("PROVA_OBJETIVA", "2026-11-14")];
    for (const s of [
      "CANCELADO",
      "DESISTIU",
      "NAO_INSCRITO",
      "EMPOSSADO",
      "REPROVADO",
      "SUSPENSO",
    ] as Status[]) {
      expect(contagemRegressiva(s, eventos, HOJE)).toBeNull();
    }
    expect(contagemRegressiva("PREVISTO", eventos, HOJE)).not.toBeNull();
  });

  it("sem prova futura → null; hoje inválido lança", () => {
    expect(contagemRegressiva("INSCRITO", [], HOJE)).toBeNull();
    expect(() => contagemRegressiva("INSCRITO", [], "02/11/2026")).toThrow(RangeError);
  });
});

describe("destaqueContagem / textoContagem", () => {
  it("limites", () => {
    expect(destaqueContagem(0)).toBe("HOJE");
    expect(destaqueContagem(1)).toBe("AMANHA");
    expect(destaqueContagem(2)).toBe("PROXIMA");
    expect(destaqueContagem(DIAS_CONTAGEM_PROXIMA)).toBe("PROXIMA");
    expect(destaqueContagem(DIAS_CONTAGEM_PROXIMA + 1)).toBe("NORMAL");
    expect(textoContagem(2)).toBe("faltam 2 dias");
  });
});

describe("compararContagens", () => {
  it("menos dias primeiro, depois hora e concurso", () => {
    const c = (concursoId: number, data: string, hora: string | null = null) => {
      const contagem = contagemRegressiva("INSCRITO", [ev("PROVA_OBJETIVA", data, { hora })], HOJE);
      if (!contagem) throw new Error("sem contagem");
      return { concursoId, contagem };
    };
    const a = c(3, "2026-11-10");
    const b = c(1, "2026-11-05", "14:00");
    const d = c(2, "2026-11-05", "08:00");
    const e = c(1, "2026-11-10");
    expect([a, b, d, e].sort(compararContagens)).toEqual([d, b, e, a]);
  });
});

describe("urgenciaContagem (#100)", () => {
  it("mapeia o destaque para o nível de urgência compartilhado com os prazos", () => {
    expect(urgenciaContagem("HOJE")).toBe("ALTA");
    expect(urgenciaContagem("AMANHA")).toBe("ALTA");
    expect(urgenciaContagem("PROXIMA")).toBe("MEDIA");
    expect(urgenciaContagem("NORMAL")).toBe("NORMAL");
  });
});
