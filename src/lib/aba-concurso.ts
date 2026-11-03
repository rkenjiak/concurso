/**
 * Aba aberta no detalhe do concurso (#77), guardada em `?aba=` para sobreviver ao recarregar a
 * página (F5, ou o PWA reaberto depois de encerrado pelo sistema). Sem dependências do Next.
 */
export const ABAS_CONCURSO = ["geral", "eventos", "links", "resultados", "historico"] as const;
export type AbaConcurso = (typeof ABAS_CONCURSO)[number];

/** Aba padrão: não aparece na URL. */
export const ABA_PADRAO: AbaConcurso = "geral";

/** Nome do parâmetro na URL. */
export const PARAM_ABA = "aba";

export function ehAbaConcurso(valor: unknown): valor is AbaConcurso {
  return typeof valor === "string" && (ABAS_CONCURSO as readonly string[]).includes(valor);
}

/**
 * Valor de `searchParams.aba` → aba válida. Valor ausente, repetido (`?aba=a&aba=b` chega como
 * array) ou desconhecido cai na aba padrão.
 */
export function normalizarAba(valor: string | string[] | undefined): AbaConcurso {
  return ehAbaConcurso(valor) ? valor : ABA_PADRAO;
}

/**
 * URL (caminho + busca + hash) com a aba aplicada, preservando os outros parâmetros. A aba padrão
 * remove o parâmetro, para a URL do detalhe continuar limpa.
 */
export function urlComAba(atual: string, aba: AbaConcurso): string {
  const url = new URL(atual, "http://local");
  if (aba === ABA_PADRAO) url.searchParams.delete(PARAM_ABA);
  else url.searchParams.set(PARAM_ABA, aba);
  return `${url.pathname}${url.search}${url.hash}`;
}
