import { ErroConfigAuth, lerConfigAuth } from "./config";

/** Valida a configuração de autenticação e encerra o processo se inválida. */
export function verificarAmbienteAoIniciar(): void {
  // Durante `next build` o app não atende requisições: a checagem vale para a execução.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const config = lerConfigAuth();
    if (!config.habilitada && process.env.NODE_ENV === "production") {
      console.warn("Atenção: autenticação desligada (ALLOW_NO_AUTH=true).");
    }
  } catch (erro) {
    if (!(erro instanceof ErroConfigAuth)) throw erro;
    console.error(`\nO app não pode iniciar: ${erro.message}\n`);
    process.exit(1);
  }
}
