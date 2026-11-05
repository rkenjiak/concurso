/**
 * Integração do MCP stdio real (`scripts/mcp.ts`, #91): o stdout é o canal JSON-RPC, então nada
 * além de mensagens do protocolo pode sair nele — nem logs da aplicação, nem avisos de startup.
 */
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const raiz = fileURLToPath(new URL("..", import.meta.url));
// Banco temporário em e2e/.tmp (ignorado pelo git), por caminho relativo à raiz como o app usa.
mkdirSync(join(raiz, "e2e", ".tmp"), { recursive: true });
const pasta = mkdtempSync(join(raiz, "e2e", ".tmp", "mcp-stdio-"));

let processo: ChildProcessWithoutNullStreams | undefined;

afterAll(async () => {
  // Espera o processo sair: no Windows o arquivo do banco fica travado até lá.
  if (processo && processo.exitCode === null) {
    const saiu = new Promise((r) => processo?.once("exit", r));
    processo.kill();
    await saiu;
  }
  rmSync(pasta, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

describe("pnpm mcp (stdio)", () => {
  it("escreve só JSON-RPC no stdout e os logs no stderr", async () => {
    processo = spawn(process.execPath, ["--import", "tsx", "scripts/mcp.ts"], {
      cwd: raiz,
      env: {
        ...process.env,
        DATABASE_URL: `file:./e2e/.tmp/${basename(pasta)}/mcp.db`,
        DATABASE_AUTH_TOKEN: "",
        NODE_ENV: "development",
        LOG_LEVEL: "debug",
      },
    });
    let stdout = "";
    let stderr = "";
    processo.stderr.on("data", (d) => {
      stderr += d;
    });
    const respostas = new Map<number, unknown>();
    processo.stdout.on("data", (d) => {
      stdout += d;
      for (const linha of stdout.split("\n").slice(0, -1)) {
        try {
          const m = JSON.parse(linha);
          if (typeof m.id === "number") respostas.set(m.id, m);
        } catch {}
      }
    });
    const enviar = (m: object) => processo?.stdin.write(`${JSON.stringify(m)}\n`);
    const aguardar = async (id: number) => {
      for (let i = 0; i < 300 && !respostas.has(id); i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(respostas.has(id), `sem resposta ${id}. stderr:\n${stderr}`).toBe(true);
    };

    enviar({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "teste", version: "0" },
      },
    });
    await aguardar(1);
    enviar({ jsonrpc: "2.0", method: "notifications/initialized" });
    enviar({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "listar_concursos", arguments: {} },
    });
    await aguardar(2);

    const linhas = stdout.split("\n").filter((l) => l.trim() !== "");
    for (const linha of linhas) {
      expect(JSON.parse(linha), linha).toMatchObject({ jsonrpc: "2.0" });
    }
    expect(stderr).toContain("mcp.ferramenta");
    expect(stderr).toContain('ferramenta="listar_concursos"');
  }, 60_000);
});
