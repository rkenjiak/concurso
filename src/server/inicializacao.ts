/**
 * Tarefas executadas uma vez ao iniciar o servidor (via `src/instrumentation.ts`).
 */
import { ErroConfigAuth, lerConfigAuth } from "./auth/config";
import { ErroConfigMcp, lerConfigMcp } from "./mcp/config";

/** Durante `next build` o app não atende requisições: as checagens valem para a execução. */
const emBuild = () => process.env.NEXT_PHASE === "phase-production-build";

/**
 * Recusa iniciar com a autenticação mal configurada — por exemplo, em produção sem
 * `APP_PASSWORD` e sem `ALLOW_NO_AUTH=true` (ARQUITETURA.md §7.1) — ou com `MCP_TOKEN` curto.
 */
export function verificarAmbienteAoIniciar(): void {
  if (emBuild()) return;
  try {
    const config = lerConfigAuth();
    if (!config.habilitada && process.env.NODE_ENV === "production") {
      console.warn("Atenção: autenticação desligada (ALLOW_NO_AUTH=true).");
    }
    lerConfigMcp();
  } catch (erro) {
    if (!(erro instanceof ErroConfigAuth) && !(erro instanceof ErroConfigMcp)) throw erro;
    console.error(`\nO app não pode iniciar: ${erro.message}\n`);
    process.exit(1);
  }
}

/**
 * Com `MIGRATE_ON_START=true`, aplica as migrações pendentes antes de atender requisições
 * (imagem Docker, onde não há `pnpm db:migrate`). Na Vercel e localmente elas rodam no build.
 */
export async function migrarAoIniciar(): Promise<void> {
  if (emBuild() || process.env.MIGRATE_ON_START !== "true") return;
  const { getDb } = await import("./db/client");
  const { aplicarMigracoes } = await import("./db/migrate");
  try {
    await aplicarMigracoes(getDb());
    console.log("Migrações aplicadas.");
  } catch (erro) {
    console.error("\nO app não pode iniciar: falha ao aplicar as migrações.\n", erro);
    process.exit(1);
  }
}
