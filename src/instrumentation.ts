/**
 * Executado uma vez ao iniciar o servidor: recusa iniciar com a autenticação mal configurada —
 * por exemplo, em produção sem `APP_PASSWORD` e sem `ALLOW_NO_AUTH=true` (ARQUITETURA.md §7.1).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { verificarAmbienteAoIniciar } = await import("./server/auth/inicializacao");
  verificarAmbienteAoIniciar();
}
