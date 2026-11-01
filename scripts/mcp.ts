/**
 * Servidor MCP por stdio para uso local (`pnpm --silent mcp`; issue #39). Usa o mesmo banco do
 * app (`DATABASE_URL` do `.env.local`/`.env`) e aplica as migrações pendentes ao iniciar.
 *
 * O stdout é o canal do protocolo: nada além dele pode ser escrito ali (logs vão para o stderr).
 * Por isso o `--silent` do pnpm, que omite o cabeçalho do script.
 */
import { fileURLToPath } from "node:url";

// Caminhos relativos (banco `file:./data/…`, `.env`, pasta `drizzle/`) partem da raiz do projeto,
// qualquer que seja a pasta de onde o cliente MCP iniciou o processo.
process.chdir(fileURLToPath(new URL("..", import.meta.url)));

const { carregarEnv } = await import("./env");
carregarEnv();

const { serveStdio } = await import("@modelcontextprotocol/server/stdio");
const { criarDb } = await import("../src/server/db/client");
const { aplicarMigracoes } = await import("../src/server/db/migrate");
const { criarServidorMcp } = await import("../src/server/mcp/servidor");

const { db } = criarDb();
await aplicarMigracoes(db);

serveStdio(() => criarServidorMcp({ db }), {
  onerror: (erro) => console.error("MCP:", erro),
});
console.error(
  `Servidor MCP "concurso" pronto (stdio, banco ${process.env.DATABASE_URL ?? "padrão"}).`,
);
