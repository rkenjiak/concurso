/**
 * Botão "Atualizar" (#77): no máximo um `router.refresh()` por minuto, para não gastar as
 * invocações do plano gratuito da hospedagem. A hora do último clique fica no `sessionStorage`,
 * para o limite valer também ao trocar de página. Sem dependências do Next.
 */

/** Intervalo mínimo entre duas atualizações. */
export const INTERVALO_ATUALIZAR_MS = 60_000;

/** Chave no `sessionStorage` com a hora (ms desde a época) do último clique. */
export const CHAVE_ATUALIZAR = "concurso:ultima-atualizacao";

/** Valor guardado → hora do último clique; ausente ou inválido = nunca. */
export function lerUltimaAtualizacao(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const ms = Number(valor);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/**
 * Segundos inteiros (arredondados para cima) até liberar o próximo clique; 0 = liberado.
 * Nunca passa do intervalo, mesmo se o relógio do aparelho tiver voltado.
 */
export function segundosRestantes(ultima: number | null, agora: number): number {
  if (ultima === null) return 0;
  const faltam = Math.min(ultima + INTERVALO_ATUALIZAR_MS - agora, INTERVALO_ATUALIZAR_MS);
  return faltam > 0 ? Math.ceil(faltam / 1000) : 0;
}

/** Rótulo (título e nome acessível) do botão. */
export function rotuloAtualizar(restantes: number): string {
  return restantes > 0 ? `Atualizar (disponível em ${restantes} s)` : "Atualizar";
}
