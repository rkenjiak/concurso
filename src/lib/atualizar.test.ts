import { describe, expect, it } from "vitest";
import {
  INTERVALO_ATUALIZAR_MS,
  lerUltimaAtualizacao,
  rotuloAtualizar,
  segundosRestantes,
} from "./atualizar";

describe("lerUltimaAtualizacao", () => {
  it("lê o número guardado", () => {
    expect(lerUltimaAtualizacao("1700000000000")).toBe(1_700_000_000_000);
  });

  it("ignora valor ausente ou inválido", () => {
    expect(lerUltimaAtualizacao(null)).toBeNull();
    expect(lerUltimaAtualizacao(undefined)).toBeNull();
    expect(lerUltimaAtualizacao("")).toBeNull();
    expect(lerUltimaAtualizacao("abc")).toBeNull();
    expect(lerUltimaAtualizacao("-5")).toBeNull();
    expect(lerUltimaAtualizacao("Infinity")).toBeNull();
  });
});

describe("segundosRestantes", () => {
  const t = 1_700_000_000_000;

  it("liberado quando nunca atualizou", () => {
    expect(segundosRestantes(null, t)).toBe(0);
  });

  it("conta o tempo que falta, arredondando para cima", () => {
    expect(segundosRestantes(t, t)).toBe(60);
    expect(segundosRestantes(t, t + 1)).toBe(60);
    expect(segundosRestantes(t, t + 18_000)).toBe(42);
    expect(segundosRestantes(t, t + 59_001)).toBe(1);
  });

  it("libera ao completar o intervalo", () => {
    expect(segundosRestantes(t, t + INTERVALO_ATUALIZAR_MS)).toBe(0);
    expect(segundosRestantes(t, t + 3_600_000)).toBe(0);
  });

  it("não passa do intervalo se o relógio voltou", () => {
    expect(segundosRestantes(t, t - 3_600_000)).toBe(60);
  });
});

describe("rotuloAtualizar", () => {
  it("mostra o tempo restante só durante a espera", () => {
    expect(rotuloAtualizar(0)).toBe("Atualizar");
    expect(rotuloAtualizar(42)).toBe("Atualizar (disponível em 42 s)");
  });
});
