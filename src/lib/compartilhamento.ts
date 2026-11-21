/**
 * Utilitários compartilhados (cliente e servidor) para links públicos de concursos (#129).
 *
 * Tokens têm 192 bits aleatórios (`randomBytes(24)` em `base64url`, 32 caracteres). A validação de
 * formato rejeita entradas malformadas na página pública antes de qualquer consulta ao banco.
 */

/** Comprimento exato do token de compartilhamento (24 bytes em base64url). */
export const TAMANHO_TOKEN_COMPARTILHAMENTO = 32;

const RE_TOKEN_COMPARTILHAMENTO = new RegExp(`^[A-Za-z0-9_-]{${TAMANHO_TOKEN_COMPARTILHAMENTO}}$`);

/** `true` se o token segue o formato fixo gerado pelo servidor (32 chars `base64url`). */
export function ehTokenCompartilhamentoValido(token: string): boolean {
  return RE_TOKEN_COMPARTILHAMENTO.test(token);
}

/** Caminho da página pública somente leitura (`/compartilhado/<token>`). */
export function caminhoCompartilhado(token: string): string {
  return `/compartilhado/${token}`;
}

/** URL completa da página pública para copiar ou exibir ao dono. */
export function urlCompartilhada(origem: string, token: string): string {
  return `${origem.replace(/\/+$/, "")}${caminhoCompartilhado(token)}`;
}
