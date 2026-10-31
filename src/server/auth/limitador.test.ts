import { describe, expect, it } from "vitest";
import { LimitadorTentativas } from "./limitador";

const opcoes = {
  tentativasLivres: 3,
  bloqueioInicialMs: 1_000,
  bloqueioMaximoMs: 5_000,
  esquecerAposMs: 60_000,
  maxChaves: 2,
};

describe("LimitadorTentativas", () => {
  it("libera as primeiras falhas e depois bloqueia com atraso progressivo limitado", () => {
    const l = new LimitadorTentativas(opcoes);
    for (let i = 0; i < 3; i++) l.registrarFalha("ip", 0);
    expect(l.esperaMs("ip", 0)).toBe(0);
    l.registrarFalha("ip", 0);
    expect(l.esperaMs("ip", 0)).toBe(1_000);
    expect(l.esperaMs("ip", 400)).toBe(600);
    expect(l.esperaMs("ip", 1_000)).toBe(0);
    l.registrarFalha("ip", 1_000);
    expect(l.esperaMs("ip", 1_000)).toBe(2_000);
    l.registrarFalha("ip", 3_000);
    expect(l.esperaMs("ip", 3_000)).toBe(4_000);
    l.registrarFalha("ip", 7_000);
    expect(l.esperaMs("ip", 7_000)).toBe(5_000);
  });

  it("separa por chave e zera no sucesso", () => {
    const l = new LimitadorTentativas(opcoes);
    for (let i = 0; i < 4; i++) l.registrarFalha("a", 0);
    expect(l.esperaMs("a", 0)).toBeGreaterThan(0);
    expect(l.esperaMs("b", 0)).toBe(0);
    l.registrarSucesso("a");
    expect(l.esperaMs("a", 0)).toBe(0);
  });

  it("esquece falhas antigas", () => {
    const l = new LimitadorTentativas(opcoes);
    for (let i = 0; i < 4; i++) l.registrarFalha("a", 0);
    l.registrarFalha("a", 70_000);
    expect(l.esperaMs("a", 70_000)).toBe(0);
  });

  it("limita o número de chaves guardadas", () => {
    const l = new LimitadorTentativas(opcoes);
    for (const chave of ["a", "b", "c"]) {
      for (let i = 0; i < 4; i++) l.registrarFalha(chave, 0);
    }
    expect(l.esperaMs("a", 0)).toBe(0);
    expect(l.esperaMs("b", 0)).toBeGreaterThan(0);
    expect(l.esperaMs("c", 0)).toBeGreaterThan(0);
  });
});
