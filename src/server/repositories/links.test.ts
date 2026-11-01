import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErroDominio } from "@/domain/erros";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import { ehUrlHttp, type LinkDados, linkSchema, ordemLinksSchema } from "@/lib/schemas/link";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { listarLinks } from "../queries/links";
import { criarConcurso } from "./concursos";
import { atualizarLink, criarLink, excluirLink, reordenarLinks, salvarLinks } from "./links";

let db: Db;
let client: Client;
let concursoId: number;

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
  concursoId = await criarConcurso(
    db,
    concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "X", cargo: "Y" }),
  );
});

afterEach(() => client.close());

const dados = (url: string, rotulo = ""): LinkDados =>
  linkSchema.parse({ tipo: "EDITAL_ABERTURA", rotulo, url });

describe("links", () => {
  it("cria links no fim da lista", async () => {
    await criarLink(db, concursoId, dados("https://a.example", "Edital"));
    await criarLink(db, concursoId, dados("https://b.example"));
    const links = await listarLinks(db, concursoId);
    expect(links.map((l) => [l.url, l.rotulo, l.ordem])).toEqual([
      ["https://a.example", "Edital", 0],
      ["https://b.example", null, 1],
    ]);
  });

  it("rejeita link de concurso inexistente", async () => {
    await expect(criarLink(db, 999, dados("https://a.example"))).rejects.toThrow(ErroDominio);
  });

  it("atualiza e exclui apenas dentro do concurso", async () => {
    const id = await criarLink(db, concursoId, dados("https://a.example"));
    await atualizarLink(db, concursoId, id, {
      tipo: "GABARITO",
      rotulo: "Gabarito",
      url: "http://g.example",
    });
    expect((await listarLinks(db, concursoId))[0]).toMatchObject({
      tipo: "GABARITO",
      rotulo: "Gabarito",
      url: "http://g.example",
    });
    await expect(atualizarLink(db, 999, id, dados("https://x.example"))).rejects.toThrow(
      "Link não encontrado.",
    );
    await expect(excluirLink(db, 999, id)).rejects.toThrow("Link não encontrado.");
    await excluirLink(db, concursoId, id);
    expect(await listarLinks(db, concursoId)).toEqual([]);
  });

  it("reordena links", async () => {
    const a = await criarLink(db, concursoId, dados("https://a.example"));
    const b = await criarLink(db, concursoId, dados("https://b.example"));
    const c = await criarLink(db, concursoId, dados("https://c.example"));
    await reordenarLinks(db, concursoId, [c, a, b]);
    expect((await listarLinks(db, concursoId)).map((l) => l.id)).toEqual([c, a, b]);
  });

  it("rejeita reordenação com conjunto diferente", async () => {
    const a = await criarLink(db, concursoId, dados("https://a.example"));
    await criarLink(db, concursoId, dados("https://b.example"));
    await expect(reordenarLinks(db, concursoId, [a])).rejects.toThrow(ErroDominio);
    await expect(reordenarLinks(db, concursoId, [a, 999])).rejects.toThrow(ErroDominio);
  });
});

describe("linkSchema", () => {
  it.each([
    "https://www.cebraspe.org.br/concursos/x",
    "http://example.com",
    "  https://example.com/edital.pdf  ",
  ])("aceita %s", (url) => {
    expect(linkSchema.safeParse({ tipo: "OUTRO", rotulo: "", url }).success).toBe(true);
  });

  it.each(["javascript:alert(1)", "ftp://example.com", "example.com", "data:text/html,oi", ""])(
    "rejeita %j",
    (url) => {
      const r = linkSchema.safeParse({ tipo: "OUTRO", rotulo: "", url });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.path).toEqual(["url"]);
    },
  );

  it("normaliza rótulo vazio e faz trim da URL", () => {
    expect(linkSchema.parse({ tipo: "OUTRO", rotulo: " ", url: " https://a.b " })).toEqual({
      tipo: "OUTRO",
      rotulo: null,
      url: "https://a.b",
    });
  });

  it("rejeita tipo inválido", () => {
    expect(linkSchema.safeParse({ tipo: "X", rotulo: "", url: "https://a.b" }).success).toBe(false);
  });

  it("ehUrlHttp", () => {
    expect(ehUrlHttp("https://a.b")).toBe(true);
    expect(ehUrlHttp("mailto:a@b.c")).toBe(false);
  });

  it("ordemLinksSchema rejeita IDs repetidos", () => {
    expect(ordemLinksSchema.safeParse([1, 2]).success).toBe(true);
    expect(ordemLinksSchema.safeParse([1, 1]).success).toBe(false);
  });
});

describe("salvarLinks", () => {
  it("cria no fim da lista e atualiza, tudo ou nada", async () => {
    const a = await criarLink(db, concursoId, dados("https://a.example"));
    const ids = await salvarLinks(db, concursoId, [
      { id: null, dados: dados("https://b.example") },
      { id: a, dados: dados("https://a2.example", "Edital") },
    ]);
    expect(ids).toEqual([a + 1, a]);
    expect((await listarLinks(db, concursoId)).map((l) => [l.url, l.ordem])).toEqual([
      ["https://a2.example", 0],
      ["https://b.example", 1],
    ]);

    await expect(
      salvarLinks(db, concursoId, [
        { id: null, dados: dados("https://c.example") },
        { id: 999, dados: dados("https://d.example") },
      ]),
    ).rejects.toThrow(ErroDominio);
    expect(await listarLinks(db, concursoId)).toHaveLength(2);
  });
});
