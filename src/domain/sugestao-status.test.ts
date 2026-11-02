import { describe, expect, it } from "vitest";
import { STATUS, type TipoEvento } from "./enums";
import { podeTransicionar } from "./status";
import { type EventoSugestao, sugerirStatus } from "./sugestao-status";

const HOJE = "2026-11-10";

let proximoId = 1;
const ev = (tipo: TipoEvento, data: string, concluido = false): EventoSugestao => ({
  id: proximoId++,
  tipo,
  titulo: null,
  data,
  concluido,
});

describe("sugerirStatus", () => {
  it("prova passada → Prova realizada", () => {
    const prova = ev("PROVA_OBJETIVA", "2026-11-08");
    expect(sugerirStatus("PROVA_AGENDADA", [prova], HOJE)).toEqual({
      para: "PROVA_REALIZADA",
      motivo: "Prova objetiva em 08/11/2026 já passou.",
      eventoId: prova.id,
    });
    // Também a partir de "Inscrito" (pode pular etapas).
    expect(sugerirStatus("INSCRITO", [prova], HOJE)?.para).toBe("PROVA_REALIZADA");
  });

  it("prova de hoje ainda não passou, salvo se marcada como concluída", () => {
    expect(sugerirStatus("PROVA_AGENDADA", [ev("PROVA_OBJETIVA", HOJE)], HOJE)).toBeNull();
    expect(sugerirStatus("PROVA_AGENDADA", [ev("PROVA_OBJETIVA", HOJE, true)], HOJE)?.para).toBe(
      "PROVA_REALIZADA",
    );
  });

  it("recurso posterior à prova encerrado → Aguardando resultado", () => {
    const eventos = [ev("PROVA_OBJETIVA", "2026-10-20"), ev("PRAZO_RECURSO", "2026-10-25")];
    expect(sugerirStatus("PROVA_REALIZADA", eventos, HOJE)).toMatchObject({
      para: "AGUARDANDO_RESULTADO",
      motivo: "Prazo de recurso até 25/10/2026 já terminou.",
    });
    expect(sugerirStatus("PROVA_AGENDADA", eventos, HOJE)?.para).toBe("AGUARDANDO_RESULTADO");
  });

  it("recurso anterior à prova (ex.: contra a isenção) não conta", () => {
    const eventos = [ev("PRAZO_RECURSO", "2026-09-01"), ev("PROVA_OBJETIVA", "2026-10-20")];
    expect(sugerirStatus("PROVA_REALIZADA", eventos, HOJE)).toBeNull();
  });

  it("recurso ainda aberto: fica na Prova realizada", () => {
    const eventos = [ev("PROVA_OBJETIVA", "2026-11-01"), ev("PRAZO_RECURSO", "2026-11-12")];
    expect(sugerirStatus("PROVA_AGENDADA", eventos, HOJE)?.para).toBe("PROVA_REALIZADA");
    expect(sugerirStatus("PROVA_REALIZADA", eventos, HOJE)).toBeNull();
  });

  it("inscrito com prova marcada → Prova agendada", () => {
    expect(sugerirStatus("INSCRITO", [ev("PROVA_DISCURSIVA", "2026-12-06")], HOJE)).toMatchObject({
      para: "PROVA_AGENDADA",
      motivo: "Prova discursiva marcada para 06/12/2026.",
    });
    expect(sugerirStatus("PROVA_AGENDADA", [ev("PROVA_OBJETIVA", "2026-12-06")], HOJE)).toBeNull();
  });

  it("usa o título do evento no motivo", () => {
    const prova = { ...ev("PROVA_OBJETIVA", "2026-11-01"), titulo: "Prova TJ-SP" };
    expect(sugerirStatus("PROVA_AGENDADA", [prova], HOJE)?.motivo).toBe(
      "Prova TJ-SP em 01/11/2026 já passou.",
    );
  });

  it("não sugere antes da inscrição, fora da trilha ou sem eventos-chave", () => {
    const prova = [ev("PROVA_OBJETIVA", "2026-11-01")];
    for (const s of [
      "PREVISTO",
      "EDITAL_PUBLICADO",
      "APROVADO",
      "SUSPENSO",
      "CANCELADO",
    ] as const) {
      expect(sugerirStatus(s, prova, HOJE)).toBeNull();
    }
    expect(sugerirStatus("AGUARDANDO_RESULTADO", prova, HOJE)).toBeNull();
    expect(sugerirStatus("INSCRITO", [ev("FIM_INSCRICOES", "2026-11-01")], HOJE)).toBeNull();
    expect(sugerirStatus("INSCRITO", [ev("PROVA_OBJETIVA", "invalida")], HOJE)).toBeNull();
  });

  it("toda sugestão é uma transição permitida", () => {
    const eventos = [
      ev("PROVA_OBJETIVA", "2026-10-20"),
      ev("PRAZO_RECURSO", "2026-10-25"),
      ev("PROVA_DISCURSIVA", "2026-12-01"),
    ];
    for (const s of STATUS) {
      const sugestao = sugerirStatus(s, eventos, HOJE);
      if (sugestao) expect(podeTransicionar(s, sugestao.para)).toBe(true);
    }
  });

  it("rejeita hoje inválido", () => {
    expect(() => sugerirStatus("INSCRITO", [], "x")).toThrow(RangeError);
  });
});
