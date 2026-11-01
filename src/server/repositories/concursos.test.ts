import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type ConcursoDados,
  concursoSchema,
  VALORES_INICIAIS_CONCURSO,
} from "@/lib/schemas/concurso";
import { eventoSchema, VALORES_INICIAIS_EVENTO } from "@/lib/schemas/evento";
import { linkSchema } from "@/lib/schemas/link";
import { ID_USUARIO_INICIAL as U } from "@/server/db/schema";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { concurso, link, statusHistorico } from "../db/schema";
import { listarConcursos, obterConcurso } from "../queries/concursos";
import { listarEventos } from "../queries/eventos";
import {
  atualizarConcurso,
  criarConcurso,
  criarConcursoCompleto,
  excluirConcurso,
} from "./concursos";

let db: Db;
let client: Client;

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
});

afterEach(() => client.close());

function dados(parcial: Partial<typeof VALORES_INICIAIS_CONCURSO> = {}): ConcursoDados {
  return concursoSchema.parse({
    ...VALORES_INICIAIS_CONCURSO,
    orgao: "Tribunal Regional Federal",
    cargo: "Técnico Judiciário",
    banca: "Fundação Carlos Chagas",
    remuneracao: "8.500,00",
    ...parcial,
  });
}

const AGORA = new Date("2026-03-01T15:00:00Z");

describe("criarConcurso", () => {
  it("persiste os dados e registra o status inicial no histórico", async () => {
    const id = await criarConcurso(db, U, dados({ status: "INSCRITO" }), AGORA);
    const c = await obterConcurso(db, U, id);
    expect(c).toMatchObject({
      orgao: "Tribunal Regional Federal",
      remuneracaoCentavos: 850_000,
      status: "INSCRITO",
      statusDesde: AGORA,
    });
    const hist = await db.select().from(statusHistorico).where(eq(statusHistorico.concursoId, id));
    expect(hist).toEqual([
      expect.objectContaining({ de: null, para: "INSCRITO", alteradoEm: AGORA }),
    ]);
  });

  it("preenche busca_normalizada sem acentos", async () => {
    const id = await criarConcurso(db, U, dados());
    const c = await obterConcurso(db, U, id);
    expect(c?.buscaNormalizada).toBe(
      "tribunal regional federal tecnico judiciario fundacao carlos chagas",
    );
  });
});

describe("atualizarConcurso", () => {
  it("atualiza campos e a busca, sem alterar o status", async () => {
    const id = await criarConcurso(db, U, dados({ status: "PREVISTO" }), AGORA);
    const ok = await atualizarConcurso(
      db,
      U,
      id,
      dados({ cargo: "Analista Judiciário", banca: "", status: "CANCELADO" }),
    );
    expect(ok).toBe(true);
    const c = await obterConcurso(db, U, id);
    expect(c).toMatchObject({ cargo: "Analista Judiciário", banca: null, status: "PREVISTO" });
    expect(c?.buscaNormalizada).toBe("tribunal regional federal analista judiciario");
  });

  it("retorna false para concurso inexistente", async () => {
    expect(await atualizarConcurso(db, U, 999, dados())).toBe(false);
  });

  it("grava, troca e limpa a cor e o ícone (#46)", async () => {
    const id = await criarConcurso(db, U, dados(), AGORA);
    expect(await obterConcurso(db, U, id)).toMatchObject({ cor: null, icone: null });
    await atualizarConcurso(db, U, id, dados({ cor: "VIOLETA", icone: "⚖️" }));
    expect(await obterConcurso(db, U, id)).toMatchObject({ cor: "VIOLETA", icone: "⚖️" });
    const [resumo] = await listarConcursos(db, U);
    expect(resumo).toMatchObject({ cor: "VIOLETA", icone: "⚖️" });
    await atualizarConcurso(db, U, id, dados({ cor: "", icone: "" }));
    expect(await obterConcurso(db, U, id)).toMatchObject({ cor: null, icone: null });
  });
});

describe("excluirConcurso", () => {
  it("remove o concurso e seus filhos", async () => {
    const id = await criarConcurso(db, U, dados());
    await db.insert(link).values({ concursoId: id, tipo: "OUTRO", url: "https://example.com" });
    expect(await excluirConcurso(db, U, id)).toBe(true);
    expect(await obterConcurso(db, U, id)).toBeNull();
    expect(await db.select().from(link)).toHaveLength(0);
    expect(await db.select().from(statusHistorico)).toHaveLength(0);
  });

  it("retorna false para concurso inexistente", async () => {
    expect(await excluirConcurso(db, U, 999)).toBe(false);
  });
});

describe("queries", () => {
  it("listarConcursos retorna os mais recentes primeiro", async () => {
    const a = await criarConcurso(db, U, dados({ orgao: "A" }));
    const b = await criarConcurso(db, U, dados({ orgao: "B" }));
    await db
      .update(concurso)
      .set({ createdAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(concurso.id, a));
    const lista = await listarConcursos(db, U);
    expect(lista.map((c) => c.id)).toEqual([b, a]);
    expect(lista[0]).toMatchObject({
      orgao: "B",
      status: "PREVISTO",
      remuneracaoCentavos: 850_000,
    });
  });

  it("obterConcurso retorna null quando não existe", async () => {
    expect(await obterConcurso(db, U, 42)).toBeNull();
  });
});

describe("criarConcursoCompleto", () => {
  const evento = eventoSchema.parse({ ...VALORES_INICIAIS_EVENTO, data: "2026-12-01" });
  const edital = linkSchema.parse({
    tipo: "EDITAL_ABERTURA",
    rotulo: "",
    url: "https://e.example",
  });

  it("grava concurso, histórico, eventos e links na mesma transação", async () => {
    const id = await criarConcursoCompleto(db, U, dados(), [evento, evento], [edital], AGORA);
    expect(await obterConcurso(db, U, id)).toMatchObject({ statusDesde: AGORA });
    expect(await listarEventos(db, id)).toHaveLength(2);
    expect(await db.select().from(link).where(eq(link.concursoId, id))).toHaveLength(1);
  });

  it("desfaz tudo se uma inserção falhar", async () => {
    const quebrado = { ...evento, data: null } as unknown as typeof evento;
    await expect(
      criarConcursoCompleto(db, U, dados(), [evento, quebrado], [edital]),
    ).rejects.toThrow();
    expect(await listarConcursos(db, U)).toEqual([]);
    expect(await db.select().from(statusHistorico)).toEqual([]);
  });
});
