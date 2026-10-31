/**
 * Sobe o build de produção (`next start`) para os testes e2e com um banco SQLite temporário
 * recriado do zero: `tsx e2e/servidor.ts <porta> <nome-do-banco>`.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { criarDb } from "../src/server/db/client";
import { aplicarMigracoes } from "../src/server/db/migrate";

const [porta, nome] = process.argv.slice(2);
if (!porta || !nome) throw new Error("Uso: tsx e2e/servidor.ts <porta> <nome-do-banco>");

const arquivo = `e2e/.tmp/${nome}.db`;
mkdirSync("e2e/.tmp", { recursive: true });
for (const sufixo of ["", "-wal", "-shm", "-journal"])
  rmSync(`${arquivo}${sufixo}`, { force: true });

process.env.DATABASE_URL = `file:./${arquivo}`;
process.env.DATABASE_AUTH_TOKEN = "";
const { db, client } = criarDb();
await aplicarMigracoes(db);
client.close();

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const filho = spawn(process.execPath, [next, "start", "-p", porta], {
  stdio: "inherit",
  env: process.env,
});
filho.on("exit", (codigo) => process.exit(codigo ?? 0));
for (const sinal of ["SIGINT", "SIGTERM"] as const) process.on(sinal, () => filho.kill(sinal));
