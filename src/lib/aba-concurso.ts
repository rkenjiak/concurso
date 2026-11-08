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

/** Evento destacado na aba Eventos (`?evento=<id>`, #100). */
export const PARAM_EVENTO = "evento";

/** Card destacado na Visão geral (`?foco=validade`, #100): destino da validade derivada. */
export const PARAM_FOCO = "foco";

/** Único valor aceito em `?foco=`. */
export const FOCO_VALIDADE = "validade";

/**
 * `?mudar=status` abre o controle "Mudar status" do cabeçalho (#100, D7): destino do link na
 * edição do concurso. É removido da URL quando o diálogo fecha.
 */
export const PARAM_MUDAR = "mudar";

/** Único valor aceito em `?mudar=`. */
export const MUDAR_STATUS = "status";

export function ehAbaConcurso(valor: unknown): valor is AbaConcurso {
  return typeof valor === "string" && (ABAS_CONCURSO as readonly string[]).includes(valor);
}

/**
 * Valor de `?aba=` → aba válida. Valor ausente, repetido (array, no `searchParams` da página) ou
 * desconhecido cai na aba padrão.
 */
export function normalizarAba(valor: string | string[] | undefined): AbaConcurso {
  return ehAbaConcurso(valor) ? valor : ABA_PADRAO;
}

/**
 * URL (caminho + busca + hash) com a aba aplicada, preservando os outros parâmetros (inclusive a
 * origem, `de`/`mes`/`concursos`). A aba padrão remove o parâmetro, para a URL do detalhe
 * continuar limpa. O destaque (`evento`/`foco`) pertence à aba de onde se sai e é removido (#100).
 */
export function urlComAba(atual: string, aba: AbaConcurso): string {
  const url = new URL(atual, "http://local");
  if (aba === ABA_PADRAO) url.searchParams.delete(PARAM_ABA);
  else url.searchParams.set(PARAM_ABA, aba);
  url.searchParams.delete(PARAM_EVENTO);
  url.searchParams.delete(PARAM_FOCO);
  return caminho(url);
}

/** URL (caminho + busca + hash) sem o parâmetro `nome`, preservando os demais (#100). */
export function urlSemParametro(atual: string, nome: string): string {
  const url = new URL(atual, "http://local");
  url.searchParams.delete(nome);
  return caminho(url);
}

/** Caminho + busca + hash, com vírgulas legíveis (`concursos=1,3`, não `1%2C3`). */
function caminho(url: URL): string {
  return `${url.pathname}${url.search.replaceAll("%2C", ",")}${url.hash}`;
}
