import { notFound, redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ErroDominio } from "@/domain/erros";
import { configurarLog } from "../log";
import { executar, falha, falhaValidacao, sucesso } from "./resultado";

afterEach(() => {
  vi.restoreAllMocks();
  configurarLog({});
});

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

  it("executar esconde erros inesperados e os registra com o contexto", async () => {
    configurarLog({ nivel: "error", formato: "json" });
    const saida = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await executar(
      async () => {
        throw new Error("detalhe interno");
      },
      { acao: "concursos.criar", usuarioId: 7 },
    );
    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.erros._form?.[0]).toMatch(/Não foi possível/);
    expect(saida).toHaveBeenCalledOnce();
    const linha = JSON.parse(String(saida.mock.calls[0]?.[0]));
    expect(linha).toMatchObject({
      nivel: "error",
      evento: "acao.erro",
      acao: "concursos.criar",
      usuarioId: 7,
      erro: { nome: "Error", mensagem: "detalhe interno" },
    });
  });

  it("executar não registra erro de domínio como falha", async () => {
    configurarLog({ nivel: "info" });
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    await executar(async () => {
      throw new ErroDominio("regra violada");
    });
    expect(erro).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("executar relança redirect e notFound sem registrar", async () => {
    configurarLog({ nivel: "debug" });
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(executar(async () => redirect("/x"))).rejects.toMatchObject({
      digest: expect.stringMatching(/^NEXT_REDIRECT/),
    });
    await expect(executar(async () => notFound())).rejects.toBeDefined();
    expect(erro).not.toHaveBeenCalled();
  });

  it("executar repassa o resultado", async () => {
    expect(await executar(async () => sucesso("x"))).toEqual({ ok: true, data: "x" });
  });
});
