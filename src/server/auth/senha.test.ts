import { describe, expect, it } from "vitest";
import { senhaConfere } from "./senha";

describe("senhaConfere", () => {
  it("compara exatamente, inclusive acentos, maiúsculas e tamanhos diferentes", () => {
    expect(senhaConfere("correta", "correta")).toBe(true);
    expect(senhaConfere("Correta", "correta")).toBe(false);
    expect(senhaConfere("corret", "correta")).toBe(false);
    expect(senhaConfere("", "correta")).toBe(false);
    expect(senhaConfere("ação", "ação")).toBe(true);
    expect(senhaConfere("acao", "ação")).toBe(false);
    expect(senhaConfere("x".repeat(5000), "correta")).toBe(false);
  });
});
