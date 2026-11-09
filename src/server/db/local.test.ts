import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Client, createClient } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarDb } from "./client";
import { ehArquivoLocal, FilaEscrita, protegerClienteLocal } from "./local";

let pasta: string;
const abertos: Client[] = [];

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), "concurso-local-"));
});

afterEach(() => {
  for (const c of abertos.splice(0)) c.close();
  try {
    rmSync(pasta, { recursive: true, force: true });
  } catch {
    // No Windows o libSQL pode manter o arquivo aberto após `close()`: limpeza best-effort.
  }
});

/** Client protegido num arquivo novo, com a tabela `t` e uma linha. */
async function banco(esperaMs?: number): Promise<{ client: Client; url: string }> {
  const url = `file:${join(pasta, "banco.db")}`;
  const client = protegerClienteLocal(createClient({ url }), { esperaMs });
  abertos.push(client);
  await client.execute("create table t (id integer primary key, v text)");
  await client.execute("insert into t (v) values ('x')");
  return { client, url };
}

const contar = async (c: Client) =>
  Number((await c.execute("select count(*) as n from t")).rows[0]?.n);

describe("ehArquivoLocal", () => {
  it.each([
    ["file:./data/concurso.db", true],
    ["file:/app/data/concurso.db", true],
    [":memory:", false],
    ["file::memory:", false],
    ["libsql://db.turso.io", false],
    ["https://db.turso.io", false],
  ])("%s → %s", (url, esperado) => {
    expect(ehArquivoLocal(url)).toBe(esperado);
  });
});

describe("FilaEscrita", () => {
  it("dá a vez em ordem de chegada, uma por vez", async () => {
    const fila = new FilaEscrita(1_000);
    const ordem: string[] = [];
    const tarefa = (nome: string, ms: number) =>
      fila.na(async () => {
        ordem.push(`${nome}:início`);
        await new Promise((r) => setTimeout(r, ms));
        ordem.push(`${nome}:fim`);
      });
    await Promise.all([tarefa("a", 20), tarefa("b", 0), tarefa("c", 0)]);
    expect(ordem).toEqual(["a:início", "a:fim", "b:início", "b:fim", "c:início", "c:fim"]);
  });

  it("quem desiste por tempo esgotado não trava a fila", async () => {
    const fila = new FilaEscrita(20);
    const liberarA = await fila.entrar();
    await expect(fila.entrar()).rejects.toMatchObject({ code: "SQLITE_BUSY" });
    const c = fila.entrar();
    liberarA();
    const liberarC = await c;
    liberarC();
    liberarC(); // liberar duas vezes não pula ninguém
    await expect(fila.na(async () => "ok")).resolves.toBe("ok");
  });
});

describe("protegerClienteLocal", () => {
  it("liga o WAL na primeira operação", async () => {
    const { client } = await banco();
    const modo = await client.execute("PRAGMA journal_mode");
    expect(modo.rows[0]?.journal_mode).toBe("wal");
  });

  it("escrita concorrente espera a transação em vez de levar SQLITE_BUSY (#112)", async () => {
    const { client } = await banco();
    const tx = await client.transaction("write");
    await tx.execute("insert into t (v) values ('a')");

    // Antes: o UPDATE falhava com SQLITE_BUSY e envenenava a conexão do pool.
    let atualizou = false;
    const update = client.execute("update t set v = 'z' where id = 1").then(() => {
      atualizou = true;
    });
    // Leitura não espera a transação (WAL) e não vê o que ela ainda não gravou.
    expect(await contar(client)).toBe(1);
    expect(atualizou).toBe(false);

    await tx.commit();
    await update;
    await client.execute("insert into t (v) values ('b')");
    // Todas as conexões do pool veem os dados novos (sem snapshot preso).
    const leituras = await Promise.all([contar(client), contar(client), contar(client)]);
    expect(leituras).toEqual([3, 3, 3]);
    expect((await client.execute("select v from t where id = 1")).rows[0]?.v).toBe("z");
  });

  it("preparo que falha não bloqueia as operações e é tentado de novo depois", async () => {
    const url = `file:${join(pasta, "preparo.db")}`;
    let tentativas = 0;
    const client = protegerClienteLocal(createClient({ url }), {
      novaTentativaMs: 10,
      preparar: async () => {
        tentativas++;
        if (tentativas === 1) throw new Error("ocupado");
      },
    });
    abertos.push(client);
    await client.execute("create table t (id integer primary key, v text)");
    expect(await contar(client)).toBe(0);
    expect(tentativas).toBe(1);
    await new Promise((r) => setTimeout(r, 30));
    await client.execute("insert into t (v) values ('h')");
    expect(tentativas).toBe(2);
    await client.execute("insert into t (v) values ('i')");
    expect(tentativas).toBe(2);
  });

  it("rollback e close também devolvem a vez", async () => {
    const { client } = await banco(200);
    const tx1 = await client.transaction("write");
    await tx1.rollback();
    const tx2 = await client.transaction();
    tx2.close();
    await client.execute("insert into t (v) values ('c')");
    expect(await contar(client)).toBe(2);
  });

  it("escrita pelo client de fora dentro de uma transação falha após a espera", async () => {
    const { client } = await banco(50);
    const tx = await client.transaction("write");
    await expect(client.execute("insert into t (v) values ('d')")).rejects.toMatchObject({
      code: "SQLITE_BUSY",
    });
    await tx.commit();
    await client.execute("insert into t (v) values ('e')");
    expect(await contar(client)).toBe(2);
  });

  it("transação do Drizzle com erro faz rollback e libera a vez", async () => {
    const { db, client } = criarDb({ url: `file:${join(pasta, "drizzle.db")}` });
    abertos.push(client);
    await client.execute("create table t (id integer primary key, v text)");
    await expect(
      db.transaction(async (tx) => {
        await tx.run("insert into t (v) values ('f')");
        throw new Error("falhou");
      }),
    ).rejects.toThrow("falhou");
    await db.transaction(async (tx) => {
      await tx.run("insert into t (v) values ('g')");
    });
    expect(await contar(client)).toBe(1);
  });
});
