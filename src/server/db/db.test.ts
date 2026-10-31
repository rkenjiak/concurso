import type { Client } from "@libsql/client";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarDb, type Db } from "./client";
import { aplicarMigracoes } from "./migrate";
import {
  anexo,
  concurso,
  concursoTag,
  evento,
  link,
  resultadoFase,
  statusHistorico,
  tag,
} from "./schema";

let db: Db;
let client: Client;

beforeEach(async () => {
  ({ db, client } = criarDb({ url: ":memory:" }));
  await aplicarMigracoes(db);
});

afterEach(() => {
  client.close();
});

async function inserirConcurso(): Promise<number> {
  const [linha] = await db
    .insert(concurso)
    .values({
      orgao: "TRF 3ª Região",
      cargo: "Analista Judiciário",
      status: "PREVISTO",
      statusDesde: new Date("2026-01-10T12:00:00Z"),
    })
    .returning({ id: concurso.id });
  if (!linha) throw new Error("insert sem retorno");
  return linha.id;
}

describe("migrações", () => {
  it("criam todas as tabelas do schema", async () => {
    const resultado = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' ORDER BY name",
    );
    expect(resultado.rows.map((r) => r.name)).toEqual([
      "anexo",
      "concurso",
      "concurso_tag",
      "evento",
      "link",
      "resultado_fase",
      "status_historico",
      "tag",
    ]);
  });

  it("são idempotentes", async () => {
    await expect(aplicarMigracoes(db)).resolves.toBeUndefined();
  });

  it("criam o índice (data, concluido) em evento", async () => {
    const resultado = await client.execute("PRAGMA index_info('evento_data_concluido_idx')");
    expect(resultado.rows.map((r) => r.name)).toEqual(["data", "concluido"]);
  });
});

describe("schema", () => {
  it("aplica defaults de concurso", async () => {
    const id = await inserirConcurso();
    const [c] = await db.select().from(concurso).where(eq(concurso.id, id));
    expect(c).toMatchObject({
      possuiCadastroReserva: false,
      validadeProrrogada: false,
      buscaNormalizada: "",
      banca: null,
      status: "PREVISTO",
    });
    expect(c?.createdAt).toBeInstanceOf(Date);
    expect(c?.statusDesde.toISOString()).toBe("2026-01-10T12:00:00.000Z");
  });

  it("guarda timestamps em epoch ms (UTC)", async () => {
    const id = await inserirConcurso();
    const r = await client.execute({
      sql: "SELECT status_desde, typeof(created_at) AS tipo FROM concurso WHERE id = ?",
      args: [id],
    });
    expect(Number(r.rows[0]?.status_desde)).toBe(Date.UTC(2026, 0, 10, 12));
    expect(r.rows[0]?.tipo).toBe("integer");
  });

  it("usa default de banco para created_at quando inserido via SQL puro", async () => {
    await client.execute(
      "INSERT INTO concurso (orgao, cargo, status, status_desde) VALUES ('X', 'Y', 'PREVISTO', 0)",
    );
    const r = await client.execute("SELECT created_at FROM concurso");
    expect(Number(r.rows[0]?.created_at)).toBeGreaterThan(Date.UTC(2020, 0, 1));
  });

  it("resultado_fase começa como PENDENTE e evento não concluído", async () => {
    const id = await inserirConcurso();
    const [rf] = await db
      .insert(resultadoFase)
      .values({ concursoId: id, fase: "OBJETIVA", nota: 72.5 })
      .returning();
    const [ev] = await db
      .insert(evento)
      .values({ concursoId: id, tipo: "PROVA_OBJETIVA", data: "2026-03-15", hora: "13:00" })
      .returning();
    expect(rf?.situacao).toBe("PENDENTE");
    expect(rf?.nota).toBe(72.5);
    expect(ev?.concluido).toBe(false);
    expect(ev?.data).toBe("2026-03-15");
  });

  it("tag.nome é único", async () => {
    await db.insert(tag).values({ nome: "tribunais" });
    await expect(db.insert(tag).values({ nome: "tribunais" })).rejects.toThrow();
  });

  it("concurso_tag tem PK composta", async () => {
    const id = await inserirConcurso();
    const [t] = await db.insert(tag).values({ nome: "prioridade" }).returning();
    if (!t) throw new Error("tag sem retorno");
    await db.insert(concursoTag).values({ concursoId: id, tagId: t.id });
    await expect(db.insert(concursoTag).values({ concursoId: id, tagId: t.id })).rejects.toThrow();
  });

  it("rejeita FK inexistente", async () => {
    await expect(
      db.insert(link).values({ concursoId: 999, tipo: "OUTRO", url: "https://example.com" }),
    ).rejects.toThrow();
  });

  it("exclusão de concurso remove filhos em cascata", async () => {
    const id = await inserirConcurso();
    const [t] = await db.insert(tag).values({ nome: "tribunais" }).returning();
    if (!t) throw new Error("tag sem retorno");
    await db.insert(link).values({ concursoId: id, tipo: "EDITAL_ABERTURA", url: "https://a.b" });
    await db.insert(evento).values({ concursoId: id, tipo: "FIM_INSCRICOES", data: "2026-02-01" });
    await db
      .insert(statusHistorico)
      .values({ concursoId: id, de: null, para: "PREVISTO", alteradoEm: new Date() });
    await db.insert(resultadoFase).values({ concursoId: id, fase: "DISCURSIVA" });
    await db.insert(concursoTag).values({ concursoId: id, tagId: t.id });
    await db.insert(anexo).values({
      concursoId: id,
      nomeArquivo: "edital.pdf",
      mime: "application/pdf",
      tamanhoBytes: 1024,
      chaveStorage: "anexos/1/edital.pdf",
    });

    await db.delete(concurso).where(eq(concurso.id, id));

    for (const tabela of [link, evento, statusHistorico, resultadoFase, concursoTag, anexo]) {
      const [r] = await db.select({ n: sql<number>`count(*)` }).from(tabela);
      expect(r?.n).toBe(0);
    }
    // a tag em si não é filha do concurso (órfãs são limpas pela aplicação)
    expect(await db.select().from(tag)).toHaveLength(1);
  });

  it("transações fazem rollback em caso de erro", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(concurso).values({
          orgao: "A",
          cargo: "B",
          status: "PREVISTO",
          statusDesde: new Date(),
        });
        throw new Error("falha proposital");
      }),
    ).rejects.toThrow("falha proposital");
    expect(await db.select().from(concurso)).toHaveLength(0);
  });
});
