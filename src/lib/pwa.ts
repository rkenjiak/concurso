/**
 * Constantes do PWA (#66), compartilhadas entre o manifest, o tema (`lib/tema.ts`) e o proxy.
 */

/**
 * Cores da barra de status/título do app instalado: iguais ao `--background` de cada tema
 * (`globals.css`), para a barra se fundir ao cabeçalho. `fundoSplash` é o fundo do ícone
 * (`scripts/icones.ts`), usado na tela de abertura do Android.
 */
export const COR_TEMA = {
  claro: "#ffffff",
  escuro: "#0a0a0a",
  fundoSplash: "#0f172a",
} as const;

/**
 * Caminhos públicos do PWA: o navegador busca o manifest e os ícones sem cookies de sessão (e
 * antes do login), então o proxy não pode redirecioná-los para `/login`.
 */
export const ARQUIVOS_PWA_PUBLICOS = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/apple-icon.png",
  "/favicon.ico",
] as const;

/** Prefixo dos ícones do manifest (`public/icons/`). */
export const PREFIXO_ICONES = "/icons/";

/** O caminho é um arquivo do PWA que deve ser servido sem sessão? */
export function ehArquivoPwaPublico(pathname: string): boolean {
  return (
    (ARQUIVOS_PWA_PUBLICOS as readonly string[]).includes(pathname) ||
    pathname.startsWith(PREFIXO_ICONES)
  );
}

/** Seletor da `<meta name="theme-color">` mantida pelo app (fora do metadata do Next). */
export const SELETOR_META_COR = 'meta[name="theme-color"]';

/** O mínimo do `document` usado aqui (um falso nos testes). */
interface DocMeta {
  querySelector(seletor: string): { content: string } | null;
  createElement(tag: "meta"): { name: string; content: string };
  head: { appendChild(no: unknown): unknown };
}

/**
 * Faz a barra de status do app instalado seguir o tema efetivo (inclusive o escolhido à mão no
 * app). A `<meta name="theme-color">` é do app, não do `viewport.themeColor` do Next: o Next recria
 * as próprias metas a cada navegação, o que desfaria a escolha. O script inline de tema
 * (`SCRIPT_TEMA`) cria a meta antes da primeira pintura; o seletor de tema a atualiza.
 */
export function sincronizarCorTema(doc: DocMeta, escuro: boolean): void {
  let meta = doc.querySelector(SELETOR_META_COR);
  if (!meta) {
    const nova = doc.createElement("meta");
    nova.name = "theme-color";
    doc.head.appendChild(nova);
    meta = nova;
  }
  meta.content = escuro ? COR_TEMA.escuro : COR_TEMA.claro;
}
