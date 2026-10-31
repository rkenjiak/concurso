/**
 * Configuração da autenticação (ARQUITETURA.md §7.1), lida das variáveis de ambiente.
 *
 * - Sem `APP_PASSWORD`: autenticação desligada (uso local).
 * - Com `APP_PASSWORD`: exige `AUTH_SECRET` com pelo menos 32 bytes (assina a sessão).
 * - Em produção sem `APP_PASSWORD`: recusa, salvo `ALLOW_NO_AUTH=true` explícito.
 *
 * Sem dependências do Next: usado pelo `proxy.ts`, pelas ações, pela inicialização e por testes.
 */

export const TAMANHO_MIN_SEGREDO = 32;

export type ConfigAuth =
  | { habilitada: false }
  | { habilitada: true; senha: string; segredo: Uint8Array };

/** Variáveis de ambiente relevantes (subconjunto de `process.env`). */
export interface AmbienteAuth {
  NODE_ENV?: string;
  APP_PASSWORD?: string;
  AUTH_SECRET?: string;
  ALLOW_NO_AUTH?: string;
}

/** Configuração inválida: o app não deve atender requisições. */
export class ErroConfigAuth extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroConfigAuth";
  }
}

/** Lê e valida a configuração. Lança {@link ErroConfigAuth} se inválida. */
export function lerConfigAuth(env: AmbienteAuth = process.env): ConfigAuth {
  const senha = env.APP_PASSWORD ?? "";
  if (senha === "") {
    if (env.NODE_ENV === "production" && env.ALLOW_NO_AUTH !== "true") {
      throw new ErroConfigAuth(
        "APP_PASSWORD não definido em produção. Defina APP_PASSWORD e AUTH_SECRET para exigir " +
          "login ou, se o app não estiver exposto, ALLOW_NO_AUTH=true para rodar sem senha.",
      );
    }
    return { habilitada: false };
  }
  const segredo = new TextEncoder().encode(env.AUTH_SECRET ?? "");
  if (segredo.byteLength < TAMANHO_MIN_SEGREDO) {
    throw new ErroConfigAuth(
      `AUTH_SECRET deve ter pelo menos ${TAMANHO_MIN_SEGREDO} bytes quando APP_PASSWORD está ` +
        "definido (gere com: openssl rand -base64 32).",
    );
  }
  return { habilitada: true, senha, segredo };
}
