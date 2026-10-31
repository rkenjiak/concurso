import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ErroDominio } from "@/domain/erros";
import { executar, falha, falhaValidacao, sucesso } from "./resultado";

afterEach(() => vi.restoreAllMocks());

describe("resultado de ações", () => {
  it("sucesso e falha", () => {
    expect(sucesso(1)).toEqual({ ok: true, data: 1 });
    expect(falha("erro")).toEqual({ ok: false, erros: { _form: ["erro"] } });
  });

  it("falhaValidacao agrupa erros por campo e gerais", () => {
    const schema = z
      .object({ nome: z.string().min(1, "obrigatório") })
      .refine(() => false, "geral");
    const r = schema.safeParse({ nome: "" });
    if (r.success) throw new Error("esperava falha");
    expect(falhaValidacao(r.error).erros.nome).toEqual(["obrigatório"]);
    const r2 = schema.safeParse({ nome: "x" });
    if (r2.success) throw new Error("esperava falha");
    expect(falhaValidacao(r2.error).erros._form).toEqual(["geral"]);
  });

  it("executar converte ErroDominio em mensagem", async () => {
    const r = await executar(async () => {
      throw new ErroDominio("regra violada");
    });
    expect(r).toEqual({ ok: false, erros: { _form: ["regra violada"] } });
  });

  it("executar esconde erros inesperados", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await executar(async () => {
      throw new Error("detalhe interno");
    });
    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.erros._form?.[0]).toMatch(/Não foi possível/);
    expect(log).toHaveBeenCalled();
  });

  it("executar repassa o resultado", async () => {
    expect(await executar(async () => sucesso("x"))).toEqual({ ok: true, data: "x" });
  });
});
