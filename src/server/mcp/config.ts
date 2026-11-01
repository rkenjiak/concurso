/**
 * Autenticação do endpoint MCP por HTTP (`/api/mcp`). Desde o multiusuário (#49) não há mais
 * `MCP_TOKEN` global: cada usuário gera o próprio token em Configurações (o banco guarda só o
 * resumo SHA-256; ver `repositories/usuarios.ts`).
 */

/** Token do header `Authorization: Bearer <token>`, ou `null`. */
export function tokenBearer(authorization: string | null): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? "");
  return m?.[1] ?? null;
}
