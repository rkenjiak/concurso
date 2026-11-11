/**
 * Servidor MCP por stdio para uso local (`pnpm --silent mcp`; issue #39). Usa o mesmo banco do
 * app (`DATABASE_URL` do `.env.local`/`.env`) e aplica as migrações pendentes ao iniciar. Acessa
 * os dados do usuário inicial (#49) — quem tem o processo local tem o banco inteiro mesmo.
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

// Versão e commit (#118) como o `next build` os fixaria, antes de qualquer import que os leia.
const { definirVersaoNoAmbiente } = await import("../src/lib/versao-build");
definirVersaoNoAmbiente();

// Logs da aplicação (#91) também só no stderr: o stdout é do protocolo.
const { configurarLog, log } = await import("../src/server/log");
configurarLog({ saida: "stderr" });

const { serveStdio } = await import("@modelcontextprotocol/server/stdio");
const { criarDb, urlDoBanco } = await import("../src/server/db/client");
const { aplicarMigracoes } = await import("../src/server/db/migrate");
const { criarServidorMcp } = await import("../src/server/mcp/servidor");
const { ID_USUARIO_INICIAL } = await import("../src/server/db/schema");

const { db } = criarDb();
await aplicarMigracoes(db);

serveStdio(() => criarServidorMcp({ db, usuarioId: ID_USUARIO_INICIAL }), {
  onerror: (erro) => log.error("mcp.erro", { erro }),
});
console.error(`Servidor MCP "concurso" pronto (stdio, banco ${urlDoBanco()}).`);
