/**
 * Configuração do endpoint MCP por HTTP (`/api/mcp`), lida das variáveis de ambiente.
 *
 * - Sem `MCP_TOKEN`: endpoint desligado (404). O uso local é pelo `pnpm mcp` (stdio).
 * - Com `MCP_TOKEN`: exige `Authorization: Bearer <token>`; o token precisa de pelo menos 32
 *   caracteres (gere com `openssl rand -base64 32`).
 *
 * Independente do login por senha: clientes MCP não têm o cookie de sessão.
 */

export const TAMANHO_MIN_TOKEN = 32;

export type ConfigMcp = { habilitado: false } | { habilitado: true; token: string };

export interface AmbienteMcp {
  MCP_TOKEN?: string;
}

/** Configuração inválida: o app não deve atender requisições. */
export class ErroConfigMcp extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroConfigMcp";
  }
}

/** Lê e valida a configuração. Lança {@link ErroConfigMcp} se inválida. */
export function lerConfigMcp(env: AmbienteMcp = process.env as AmbienteMcp): ConfigMcp {
  const token = env.MCP_TOKEN?.trim() ?? "";
  if (token === "") return { habilitado: false };
  if (token.length < TAMANHO_MIN_TOKEN) {
    throw new ErroConfigMcp(
      `MCP_TOKEN deve ter pelo menos ${TAMANHO_MIN_TOKEN} caracteres (gere com: openssl rand ` +
        "-base64 32).",
    );
  }
  return { habilitado: true, token };
}

/** Token do header `Authorization: Bearer <token>`, ou `null`. */
export function tokenBearer(authorization: string | null): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? "");
  return m?.[1] ?? null;
}
