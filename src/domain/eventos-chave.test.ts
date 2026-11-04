import { describe, expect, it } from "vitest";
import type { Status, TipoEvento } from "./enums";
import {
  compararEventos,
  concursoEmAndamento,
  dataBr,
  type EventoChave,
  eventoChegou,
  eventoPassou,
  nomeEvento,
  proximoEvento,
  TIPOS_PROVA,
  ultimoEvento,
} from "./eventos-chave";

const HOJE = "2026-11-10";

let proximoId = 1;
const ev = (tipo: TipoEvento, data: string, extra: Partial<EventoChave> = {}): EventoChave => ({
  id: proximoId++,
  tipo,
  titulo: null,
  data,
  concluido: false,
  ...extra,
});

describe("concursoEmAndamento", () => {
  it("exclui terminais e suspenso", () => {
    for (const s of [
      "EMPOSSADO",
      "DESISTIU",
      "NAO_INSCRITO",
      "CANCELADO",
      "REPROVADO",
      "SUSPENSO",
    ] as Status[]) {
      expect(concursoEmAndamento(s)).toBe(false);
    }
    for (const s of ["PREVISTO", "INSCRITO", "APROVADO", "NOMEADO"] as Status[]) {
      expect(concursoEmAndamento(s)).toBe(true);
    }
  });
});

describe("eventoPassou / eventoChegou", () => {
  it("hoje chegou mas não passou; concluído sempre conta", () => {
    expect(eventoPassou(ev("OUTRO", HOJE), HOJE)).toBe(false);
    expect(eventoChegou(ev("OUTRO", HOJE), HOJE)).toBe(true);
    expect(eventoPassou(ev("OUTRO", "2026-11-09"), HOJE)).toBe(true);
    expect(eventoChegou(ev("OUTRO", "2026-11-11"), HOJE)).toBe(false);
    expect(eventoPassou(ev("OUTRO", "2026-12-01", { concluido: true }), HOJE)).toBe(true);
  });
});

describe("compararEventos", () => {
  it("data, depois dia inteiro antes de hora, depois id", () => {
    const a = ev("OUTRO", HOJE, { hora: "09:00" });
    const b = ev("OUTRO", HOJE, { hora: null });
    const c = ev("OUTRO", "2026-11-09", { hora: "23:00" });
    const d = ev("OUTRO", HOJE, { hora: "09:00" });
    expect([a, b, c, d].sort(compararEventos)).toEqual([c, b, a, d]);
  });
});

describe("proximoEvento", () => {
  it("próximo não concluído a partir de hoje, só dos tipos pedidos", () => {
    const eventos = [
      ev("PROVA_OBJETIVA", "2026-11-09"),
      ev("PROVA_OBJETIVA", "2026-11-12", { concluido: true }),
      ev("FIM_INSCRICOES", "2026-11-11"),
      ev("PROVA_DISCURSIVA", "2026-11-20"),
      ev("PROVA_OBJETIVA", "2026-11-15"),
      ev("PROVA_OBJETIVA", "invalida"),
    ];
    const r = proximoEvento(eventos, TIPOS_PROVA, HOJE);
    expect(r?.evento.data).toBe("2026-11-15");
    expect(r?.dias).toBe(5);
  });

  it("evento de hoje conta (0 dias); sem eventos → null", () => {
    expect(proximoEvento([ev("PROVA_OBJETIVA", HOJE)], TIPOS_PROVA, HOJE)?.dias).toBe(0);
    expect(proximoEvento([], TIPOS_PROVA, HOJE)).toBeNull();
  });

  it("rejeita hoje inválido", () => {
    expect(() => proximoEvento([], TIPOS_PROVA, "x")).toThrow(RangeError);
  });
});

describe("ultimoEvento", () => {
  it("mais recente que chegou (inclui hoje e concluídos futuros)", () => {
    const passado = ev("PROVA_OBJETIVA", "2026-11-01");
    const deHoje = ev("PROVA_DISCURSIVA", HOJE);
    const futuro = ev("PROVA_OBJETIVA", "2026-12-01");
    expect(ultimoEvento([passado, deHoje, futuro], TIPOS_PROVA, HOJE)?.evento).toBe(deHoje);
    expect(
      ultimoEvento([passado, deHoje, futuro], TIPOS_PROVA, HOJE, { incluirHoje: false })?.evento,
    ).toBe(passado);
    const concluido = ev("PROVA_OBJETIVA", "2026-12-05", { concluido: true });
    expect(ultimoEvento([passado, concluido], TIPOS_PROVA, HOJE)).toEqual({
      evento: concluido,
      dias: 25,
    });
    expect(ultimoEvento([futuro], TIPOS_PROVA, HOJE)).toBeNull();
  });
});

describe("nomeEvento / dataBr", () => {
  it("título ou rótulo; data em pt-BR", () => {
    expect(nomeEvento({ tipo: "PROVA_OBJETIVA", titulo: null })).toBe("Prova objetiva");
    expect(nomeEvento({ tipo: "PROVA_OBJETIVA", titulo: "Prova TJ" })).toBe("Prova TJ");
    expect(dataBr("2026-11-14")).toBe("14/11/2026");
  });
});
