/**
 * Aviso de uma ação que termina em outra página (#100, item 12): a Server Action redireciona com
 * `?aviso=<chave>` e a página de destino mostra o texto e remove o parâmetro da URL (recarregar não
 * repete o aviso). Só chaves da lista viram texto: a URL nunca injeta conteúdo arbitrário.
 */

/** Nome do parâmetro na URL. */
export const PARAM_AVISO = "aviso";

const TEXTOS = {
  "concurso-criado": "Concurso cadastrado.",
  "concurso-salvo": "Alterações do concurso salvas.",
  "concurso-excluido": "Concurso excluído.",
} as const satisfies Record<string, string>;

export type AvisoUrl = keyof typeof TEXTOS;

/** Texto do aviso; valor ausente, repetido ou desconhecido = `null`. */
export function textoAvisoUrl(valor: unknown): string | null {
  return typeof valor === "string" && Object.hasOwn(TEXTOS, valor)
    ? TEXTOS[valor as AvisoUrl]
    : null;
}

/** URL (caminho + busca + hash) com `?aviso=`, preservando os demais parâmetros. */
export function urlComAviso(atual: string, aviso: AvisoUrl): string {
  const url = new URL(atual, "http://local");
  url.searchParams.set(PARAM_AVISO, aviso);
  return `${url.pathname}${url.search.replaceAll("%2C", ",")}${url.hash}`;
}
