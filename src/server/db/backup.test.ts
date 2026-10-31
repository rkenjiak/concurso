import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import { listarConcursos } from "../queries/concursos";
import { criarConcurso } from "../repositories/concursos";
import { caminhoBackup, ehBancoLocal, fazerBackup, podarBackups } from "./backup";
import { criarDb } from "./client";
import { aplicarMigracoes } from "./migrate";

let pasta: string;

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), "concurso-backup-"));
});

afterEach(() => {
  try {
    rmSync(pasta, { recursive: true, force: true });
  } catch {
    // No Windows o libSQL pode manter o arquivo aberto após `close()`: limpeza best-effort.
  }
});

const AGORA = new Date("2026-10-31T15:04:00Z"); // 12:04 em Brasília

describe("ehBancoLocal", () => {
  it.each([
    ["file:./data/concurso.db", true],
    ["file:/app/data/concurso.db", true],
    [":memory:", false],
    ["file::memory:", false],
    ["libsql://db.turso.io", false],
    ["https://db.turso.io", false],
  ])("%s → %s", (url, esperado) => {
    expect(ehBancoLocal(url)).toBe(esperado);
  });
});

describe("fazerBackup", () => {
  it("gera uma cópia consistente e utilizável do banco", async () => {
    const origem = criarDb({ url: `file:${join(pasta, "origem.db")}` });
    await aplicarMigracoes(origem.db);
    await criarConcurso(
      origem.db,
      concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "Órgão", cargo: "Cargo" }),
    );

    const destino = await fazerBackup(origem.client, join(pasta, "backups"), AGORA);
    origem.client.close();
    expect(destino).toBe(join(pasta, "backups", "concurso-20261031-1204.db"));

    const copia = criarDb({ url: `file:${destino}` });
    expect((await listarConcursos(copia.db)).map((c) => c.orgao)).toEqual(["Órgão"]);
    copia.client.close();

    // Segundo backup no mesmo minuto não sobrescreve o primeiro.
    const outro = criarDb({ url: `file:${join(pasta, "origem.db")}` });
    expect(await fazerBackup(outro.client, join(pasta, "backups"), AGORA)).toBe(
      join(pasta, "backups", "concurso-20261031-1204-2.db"),
    );
    outro.client.close();
  });
});

describe("caminhoBackup / podarBackups", () => {
  const criar = (nome: string) => writeFileSync(join(pasta, nome), "");

  it("usa sufixos crescentes no mesmo minuto", () => {
    criar("concurso-20261031-1204.db");
    criar("concurso-20261031-1204-2.db");
    expect(caminhoBackup(pasta, AGORA)).toBe(join(pasta, "concurso-20261031-1204-3.db"));
  });

  it("mantém só os N mais recentes e ignora outros arquivos", () => {
    for (const nome of [
      "concurso-20261030-0900.db",
      "concurso-20261031-1204-10.db",
      "concurso-20261031-1204.db",
      "concurso-20261031-1204-2.db",
      "concurso-20261101-0000.db",
      "outro.db",
      "leia-me.txt",
    ]) {
      criar(nome);
    }
    expect(podarBackups(pasta, 2)).toEqual([
      "concurso-20261030-0900.db",
      "concurso-20261031-1204.db",
      "concurso-20261031-1204-2.db",
    ]);
    expect(readdirSync(pasta).sort()).toEqual([
      "concurso-20261031-1204-10.db",
      "concurso-20261101-0000.db",
      "leia-me.txt",
      "outro.db",
    ]);
  });

  it("não faz nada se a pasta não existe ou manter < 1", () => {
    expect(podarBackups(join(pasta, "nada"), 3)).toEqual([]);
    criar("concurso-20261030-0900.db");
    expect(podarBackups(pasta, 0)).toEqual([]);
  });
});
