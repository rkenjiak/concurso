/**
 * Tarefas executadas uma vez ao iniciar o servidor (via `src/instrumentation.ts`).
 */
import { ErroConfigAuth, lerConfigAuth } from "./auth/config";
import { log } from "./log";

/** Durante `next build` o app não atende requisições: as checagens valem para a execução. */
const emBuild = () => process.env.NEXT_PHASE === "phase-production-build";

/**
 * Recusa iniciar com a autenticação mal configurada — por exemplo, em produção sem login e sem
 * `ALLOW_NO_AUTH=true`, ou com o login Google sem `ADMIN_EMAILS` (ARQUITETURA.md §7.1).
 */
export function verificarAmbienteAoIniciar(): void {
  if (emBuild()) return;
  try {
    const config = lerConfigAuth();
    if (!config.habilitada && process.env.NODE_ENV === "production") {
      log.warn("inicio.auth_desligada", {
        mensagem: "Atenção: autenticação desligada (ALLOW_NO_AUTH=true).",
      });
    }
    if (process.env.MCP_TOKEN) {
      log.warn("inicio.mcp_token_obsoleto", {
        mensagem:
          "Atenção: MCP_TOKEN não é mais usado. Gere um token pessoal em Configurações (#49).",
      });
    }
  } catch (erro) {
    if (!(erro instanceof ErroConfigAuth)) throw erro;
    log.fatal("inicio.config_invalida", { mensagem: `O app não pode iniciar: ${erro.message}` });
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
    log.info("inicio.migracoes", { mensagem: "Migrações aplicadas." });
  } catch (erro) {
    log.fatal("inicio.migracoes_erro", {
      mensagem: "O app não pode iniciar: falha ao aplicar as migrações.",
      erro,
    });
    process.exit(1);
  }
}
