/**
 * Cabeçalhos de segurança de todas as respostas (#95), aplicados pelo `headers()` do
 * `next.config.ts` — valem na Vercel e na imagem Docker (`standalone`). Sem dependências do Next,
 * para o `next.config.ts` importar e os testes conferirem.
 *
 * CSP sem nonce: o Next injeta scripts inline (hidratação e o `SCRIPT_TEMA` do layout) e o nonce
 * exigiria renderizar tudo dinamicamente a partir do `proxy.ts` (que nem roda com o login
 * desligado). Por isso `script-src` aceita `'unsafe-inline'`; o ganho vem do resto: só scripts,
 * estilos, fontes e conexões da própria origem, nenhum `<object>`, `<base>` fixo, formulários só
 * para a própria origem e nenhuma página de fora pode embutir o app (clickjacking).
 *
 * - Imagens: a própria origem, `data:`/`blob:` e as fotos de perfil do Google
 *   (`*.googleusercontent.com`). Imagens externas no Markdown das observações não carregam, o que
 *   também impede que um texto colado (ou gravado pelo MCP) use imagens para rastrear a leitura.
 * - O login Google é uma navegação (link → `/api/auth/google` → redirecionamento), que a CSP não
 *   restringe; por isso `form-action 'self'` basta.
 * - Sem `upgrade-insecure-requests`: quebraria o app servido por HTTP na rede local (Docker). Na
 *   Vercel, o HSTS já força HTTPS.
 * - Em desenvolvimento, o React usa `eval` para reconstruir pilhas de erro (`'unsafe-eval'`) e o
 *   HMR usa WebSocket (`ws:`/`wss:` em `connect-src`): só ali.
 */

export interface CabecalhoHttp {
  key: string;
  value: string;
}

/** Diretivas da Content-Security-Policy. */
export function diretivasCsp(dev: boolean): Record<string, string[]> {
  return {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://*.googleusercontent.com"],
    "font-src": ["'self'"],
    // Em dev, o WebSocket do HMR (nem todo navegador inclui ws:/wss: em 'self').
    "connect-src": ["'self'", ...(dev ? ["ws:", "wss:"] : [])],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
}

/** Valor do cabeçalho `Content-Security-Policy`. */
export function valorCsp(dev: boolean): string {
  return Object.entries(diretivasCsp(dev))
    .map(([nome, fontes]) => `${nome} ${fontes.join(" ")}`)
    .join("; ");
}

/**
 * Recursos do navegador que o app não usa, desligados para a página e para qualquer conteúdo
 * embutido. Só nomes que o Chrome reconhece (nomes desconhecidos geram erro no console).
 */
export const RECURSOS_DESLIGADOS = [
  "camera",
  "microphone",
  "geolocation",
  "payment",
  "usb",
  "serial",
  "hid",
  "bluetooth",
  "display-capture",
  "browsing-topics",
] as const;

/** Cabeçalhos de segurança aplicados a todas as rotas. */
export function cabecalhosSeguranca(dev: boolean): CabecalhoHttp[] {
  return [
    { key: "Content-Security-Policy", value: valorCsp(dev) },
    // Equivalente antigo de `frame-ancestors 'none'`, para navegadores sem CSP nível 2.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: RECURSOS_DESLIGADOS.map((r) => `${r}=()`).join(", ") },
    // Isola a janela de páginas abertas por ela ou que a abriram (o login Google não usa pop-up).
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
