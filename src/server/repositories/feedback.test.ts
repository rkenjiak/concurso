import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TipoFeedback } from "@/domain/enums";
import { normalizarPagina, normalizarUserAgent } from "@/domain/feedback";
import { criarBancoTeste, criarUsuarioTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { ID_USUARIO_INICIAL } from "../db/schema";
import {
  contarFeedbacksNovos,
  criarFeedback,
  descartarFeedbacks,
  exportarFeedbacks,
  listarFeedbacks,
} from "./feedback";

let db: Db;
let client: Client;
let bia: number;
const ADMIN = { id: ID_USUARIO_INICIAL, email: "ana@x.com", nome: "Ana" };
const CONTEXTO = { versaoApp: "2.7.0", commitApp: "a1b2c3d", userAgent: null };

async function criar(mensagem: string, tipo: TipoFeedback = "BUG", minuto = 0) {
  return criarFeedback(
    db,
    { id: bia, email: "bia@x.com", nome: null },
    { tipo, mensagem, pagina: "/" },
    CONTEXTO,
    new Date(Date.UTC(2026, 10, 9, 12, minuto)),
  );
}

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
  bia = await criarUsuarioTeste(db, "bia@x.com");
});

afterEach(() => client.close());

describe("listarFeedbacks", () => {
  it("mais recentes primeiro; padrão só os novos; filtros por status, tipo e texto", async () => {
    const a = await criar("Primeiro: 100% quebrado", "BUG", 1);
    const b = await criar("Segundo, uma sugestão_boa", "SUGESTAO", 2);
    const c = await criar("Terceiro feedback", "OUTRO", 3);
    await exportarFeedbacks(db, ADMIN, [a]);
    await descartarFeedbacks(db, ADMIN, [b]);

    const ids = async (f: Parameters<typeof listarFeedbacks>[1]) =>
      (await listarFeedbacks(db, f)).itens.map((i) => i.id);
    expect(await ids({})).toEqual([c]);
    expect(await ids({ status: "TODOS" })).toEqual([c, b, a]);
    expect(await ids({ status: "EXPORTADO" })).toEqual([a]);
    expect(await ids({ status: "DESCARTADO" })).toEqual([b]);
    expect(await ids({ status: "TODOS", tipo: "SUGESTAO" })).toEqual([b]);
    expect(await ids({ status: "TODOS", busca: "TERCEIRO" })).toEqual([c]);
    // `%` e `_` são literais na busca.
    expect(await ids({ status: "TODOS", busca: "100%" })).toEqual([a]);
    expect(await ids({ status: "TODOS", busca: "o_b" })).toEqual([b]);
    // Sem escape, `nd_` casaria com "ndo" e `o%b` com "o, uma sugestão_b".
    expect(await ids({ status: "TODOS", busca: "nd_" })).toEqual([]);
    expect(await ids({ status: "TODOS", busca: "o%b" })).toEqual([]);
    expect(await contarFeedbacksNovos(db)).toBe(1);
  });

  it("pagina e corrige páginas fora do intervalo", async () => {
    for (let i = 0; i < 5; i++) await criar(`Feedback número ${i}`, "BUG", i);
    const p2 = await listarFeedbacks(db, { porPagina: 2, pagina: 2 });
    expect(p2).toMatchObject({ total: 5, pagina: 2, totalPaginas: 3 });
    expect(p2.itens.map((i) => i.mensagem)).toEqual(["Feedback número 2", "Feedback número 1"]);
    expect((await listarFeedbacks(db, { porPagina: 2, pagina: 99 })).pagina).toBe(3);
    expect((await listarFeedbacks(db, { porPagina: 2, pagina: -1 })).pagina).toBe(1);
  });
});

describe("normalização", () => {
  it("página: só o caminho, sem query nem fragmento, com IDs genéricos", () => {
    expect(normalizarPagina("/concursos/12?aba=links#x")).toBe("/concursos/[id]");
    expect(normalizarPagina("/concursos/12/editar")).toBe("/concursos/[id]/editar");
    expect(normalizarPagina("/admin/usuarios/3")).toBe("/admin/usuarios/[id]");
    expect(normalizarPagina("/")).toBe("/");
    expect(normalizarPagina("https://x.com/a")).toBeNull();
    expect(normalizarPagina("//x.com/a")).toBeNull();
    expect(normalizarPagina("/a b")).toBeNull();
    expect(normalizarPagina(null)).toBeNull();
    expect(normalizarPagina(`/${"a".repeat(300)}`)).toHaveLength(200);
  });

  it("user agent sem caracteres de controle e cortado", () => {
    expect(normalizarUserAgent("Mozilla\u0000/5.0\n")).toBe("Mozilla /5.0");
    expect(normalizarUserAgent("  ")).toBeNull();
    expect(normalizarUserAgent("x".repeat(400))).toHaveLength(300);
  });
});
