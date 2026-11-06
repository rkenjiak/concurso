import type { Instrumentation } from "next";

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

/** Erros de servidor capturados pelo Next viram uma linha de log estruturada (§9.4, #91). */
export const onRequestError: Instrumentation.onRequestError = async (erro, request, context) => {
  const { registrarErroRequisicao } = await import("./server/erro-requisicao");
  registrarErroRequisicao(erro, request, context);
};
