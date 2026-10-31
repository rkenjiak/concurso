import { existsSync } from "node:fs";

/**
 * Carrega `.env.local` e `.env` (nessa ordem de prioridade) para scripts executados fora do
 * Next.js. Variáveis já definidas no ambiente não são sobrescritas.
 */
export function carregarEnv(): void {
  for (const arquivo of [".env.local", ".env"]) {
    if (existsSync(arquivo)) process.loadEnvFile(arquivo);
  }
}
