import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type ConcursoDados,
  concursoSchema,
  VALORES_INICIAIS_CONCURSO,
} from "@/lib/schemas/concurso";
import { ID_USUARIO_INICIAL as U } from "@/server/db/schema";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { tag } from "../db/schema";
import { listarConcursos, obterConcurso } from "../queries/concursos";
import { listarTags, tagsPorConcurso } from "../queries/tags";
import { atualizarConcurso, criarConcurso, excluirConcurso } from "./concursos";
import { sincronizarTags } from "./tags";

let db: Db;
let client: Client;

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
});

afterEach(() => client.close());

function dados(tags: string[], orgao = "TRF"): ConcursoDados {
  return concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao, cargo: "Analista", tags });
}

describe("tags", () => {
  it("cria tags normalizadas e associa ao concurso", async () => {
    const id = await criarConcurso(db, U, dados(["  Prioridade ", "TRIBUNAIS", "prioridade"]));
    expect((await obterConcurso(db, U, id))?.tags).toEqual(["prioridade", "tribunais"]);
    expect(await listarTags(db, U)).toEqual(["prioridade", "tribunais"]);
  });

  it("reaproveita tags existentes entre concursos", async () => {
    const a = await criarConcurso(db, U, dados(["tribunais"], "A"));
    const b = await criarConcurso(db, U, dados(["Tribunais", "federal"], "B"));
    expect(await db.select().from(tag)).toHaveLength(2);
    const mapa = await tagsPorConcurso(db, [a, b]);
    expect(mapa.get(a)).toEqual(["tribunais"]);
    expect(mapa.get(b)).toEqual(["federal", "tribunais"]);
  });

  it("inclui as tags em busca_normalizada", async () => {
    const id = await criarConcurso(db, U, dados(["Área Fiscal"]));
    expect((await obterConcurso(db, U, id))?.buscaNormalizada).toBe("trf analista area fiscal");
  });

  it("ao editar, remove tags desassociadas e limpa órfãs", async () => {
    const a = await criarConcurso(db, U, dados(["tribunais", "prioridade"], "A"));
    await criarConcurso(db, U, dados(["tribunais"], "B"));
    await atualizarConcurso(db, U, a, dados(["federal"], "A"));
    expect((await obterConcurso(db, U, a))?.tags).toEqual(["federal"]);
    expect(await listarTags(db, U)).toEqual(["federal", "tribunais"]);
    expect((await obterConcurso(db, U, a))?.buscaNormalizada).toBe("a analista federal");
  });

  it("ao excluir o concurso, remove tags que ficaram órfãs", async () => {
    const a = await criarConcurso(db, U, dados(["exclusiva", "comum"], "A"));
    await criarConcurso(db, U, dados(["comum"], "B"));
    await excluirConcurso(db, U, a);
    expect(await listarTags(db, U)).toEqual(["comum"]);
  });

  it("sincronizarTags com lista vazia remove todas", async () => {
    const id = await criarConcurso(db, U, dados(["x"]));
    expect(await sincronizarTags(db, id, ["", "  "])).toEqual([]);
    expect(await listarTags(db, U)).toEqual([]);
  });

  it("listarConcursos traz as tags de cada concurso", async () => {
    await criarConcurso(db, U, dados(["b", "a"], "Com tags"));
    await criarConcurso(db, U, dados([], "Sem tags"));
    const lista = await listarConcursos(db, U);
    expect(lista.map((c) => [c.orgao, c.tags])).toEqual([
      ["Sem tags", []],
      ["Com tags", ["a", "b"]],
    ]);
  });

  it("tagsPorConcurso com lista vazia não consulta", async () => {
    expect((await tagsPorConcurso(db, [])).size).toBe(0);
  });
});

describe("tagsSchema (via concursoSchema)", () => {
  it("rejeita mais de 20 tags", () => {
    const r = concursoSchema.safeParse({
      ...VALORES_INICIAIS_CONCURSO,
      orgao: "X",
      cargo: "Y",
      tags: Array.from({ length: 21 }, (_, i) => `t${i}`),
    });
    expect(r.error?.issues[0]).toMatchObject({ path: ["tags"], message: "Use no máximo 20 tags." });
  });

  it("rejeita tag longa demais", () => {
    const r = concursoSchema.safeParse({
      ...VALORES_INICIAIS_CONCURSO,
      orgao: "X",
      cargo: "Y",
      tags: ["x".repeat(41)],
    });
    expect(r.error?.issues[0]?.path).toEqual(["tags"]);
  });
});
