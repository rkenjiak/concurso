/**
 * Proteção de alterações não salvas (#100, D10): decide se um clique num link deve ser
 * interceptado (para pedir confirmação) enquanto um formulário está sujo. Sem dependências do DOM
 * nem do Next, para ser testável.
 */

/** O que importa do clique (`MouseEvent`). */
export interface CliqueLink {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

/** O que importa do `<a>` clicado. */
export interface AncoraLink {
  /** `href` como escrito no atributo (relativo ou absoluto); `null` = sem `href`. */
  href: string | null;
  /** Atributo `target` (vazio = mesma aba). */
  target: string;
  /** Tem o atributo `download`. */
  download: boolean;
}

/**
 * Destino interno (caminho + busca + hash) de um clique que sairia da página atual pelo roteador
 * do app; `null` quando o clique não deve ser interceptado: botão do meio/direito ou tecla
 * modificadora (nova aba/janela), outro `target`, `download`, outra origem ou protocolo, âncora na
 * própria página, link para a mesma URL ou clique já tratado por outro código.
 */
export function destinoInterceptavel(
  clique: CliqueLink,
  ancora: AncoraLink,
  atual: string,
): string | null {
  if (clique.defaultPrevented || clique.button !== 0) return null;
  if (clique.metaKey || clique.ctrlKey || clique.shiftKey || clique.altKey) return null;
  const target = ancora.target.trim().toLowerCase();
  if ((target && target !== "_self") || ancora.download || ancora.href === null) return null;
  let aqui: URL;
  let destino: URL;
  try {
    aqui = new URL(atual);
    destino = new URL(ancora.href, aqui);
  } catch {
    return null;
  }
  if (destino.origin !== aqui.origin) return null;
  if (destino.protocol !== "http:" && destino.protocol !== "https:") return null;
  // Mesma página (com ou sem âncora): o formulário continua montado.
  if (destino.pathname === aqui.pathname && destino.search === aqui.search) return null;
  return `${destino.pathname}${destino.search}${destino.hash}`;
}
