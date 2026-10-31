/**
 * Executado uma vez ao iniciar o servidor (antes de atender requisições): valida a configuração
 * de autenticação (ARQUITETURA.md §7.1) e, se pedido, aplica as migrações (§9.2).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { migrarAoIniciar, verificarAmbienteAoIniciar } = await import("./server/inicializacao");
  verificarAmbienteAoIniciar();
  await migrarAoIniciar();
}
