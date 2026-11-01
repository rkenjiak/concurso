/**
 * Configuração da autenticação (ARQUITETURA.md §7.1, #49), lida das variáveis de ambiente.
 *
 * Dois métodos de login, que podem coexistir fora de produção:
 * - **Google** (`GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`): multiusuário. Só entram e-mails da
 *   allowlist (`ALLOWED_EMAILS`) ou de `ADMIN_EMAILS` (obrigatório; o primeiro a entrar assume os
 *   dados do usuário inicial).
 * - **Senha única** (`APP_PASSWORD`): para uso local; entra sempre como o usuário inicial. Em
 *   produção não pode ser combinada com o login Google.
 *
 * Com algum método, exige `AUTH_SECRET` com pelo menos 32 bytes (assina a sessão). Sem nenhum:
 * autenticação desligada (uso local, tudo pertence ao usuário inicial); em produção, recusa,
 * salvo `ALLOW_NO_AUTH=true` explícito.
 *
 * Sem dependências do Next: usado pelo `proxy.ts`, pelas ações, pela inicialização e por testes.
 */

export const TAMANHO_MIN_SEGREDO = 32;

export interface ConfigGoogle {
  clientId: string;
  clientSecret: string;
}

export type ConfigAuth =
  | { habilitada: false }
  | {
      habilitada: true;
      segredo: Uint8Array;
      /** Senha única (`APP_PASSWORD`), ou `null` se o login por senha está desligado. */
      senha: string | null;
      /** Login Google, ou `null` se não configurado. */
      google: ConfigGoogle | null;
      /** E-mails (minúsculos) com papel de admin; também podem entrar. */
      emailsAdmin: ReadonlySet<string>;
      /** E-mails (minúsculos) autorizados a entrar com Google, além dos admins. */
      emailsPermitidos: ReadonlySet<string>;
    };

/** Variáveis de ambiente relevantes (subconjunto de `process.env`). */
export interface AmbienteAuth {
  NODE_ENV?: string;
  APP_PASSWORD?: string;
  AUTH_SECRET?: string;
  ALLOW_NO_AUTH?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ADMIN_EMAILS?: string;
  ALLOWED_EMAILS?: string;
}

/** Configuração inválida: o app não deve atender requisições. */
export class ErroConfigAuth extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroConfigAuth";
  }
}

/** Normaliza um e-mail para comparação (sem espaços, minúsculo). */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Lista de e-mails separados por vírgula, ponto e vírgula ou espaço. */
export function lerListaEmails(valor: string | undefined): Set<string> {
  return new Set(
    (valor ?? "")
      .split(/[\s,;]+/)
      .map(normalizarEmail)
      .filter((e) => e !== ""),
  );
}

function lerGoogle(env: AmbienteAuth): ConfigGoogle | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  if (clientId === "" && clientSecret === "") return null;
  if (clientId === "" || clientSecret === "") {
    throw new ErroConfigAuth(
      "Login Google incompleto: defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (ou nenhum dos dois).",
    );
  }
  return { clientId, clientSecret };
}

/** Lê e valida a configuração. Lança {@link ErroConfigAuth} se inválida. */
export function lerConfigAuth(env: AmbienteAuth = process.env): ConfigAuth {
  const producao = env.NODE_ENV === "production";
  const senha = env.APP_PASSWORD ?? "";
  const google = lerGoogle(env);

  if (senha === "" && google === null) {
    if (producao && env.ALLOW_NO_AUTH !== "true") {
      throw new ErroConfigAuth(
        "Autenticação não configurada em produção. Configure o login Google (GOOGLE_CLIENT_ID, " +
          "GOOGLE_CLIENT_SECRET, ADMIN_EMAILS e AUTH_SECRET) ou, se o app não estiver exposto, " +
          "ALLOW_NO_AUTH=true para rodar sem login.",
      );
    }
    return { habilitada: false };
  }
  if (producao && senha !== "" && google !== null) {
    throw new ErroConfigAuth(
      "APP_PASSWORD é só para uso local: remova-o em produção quando o login Google estiver " +
        "configurado.",
    );
  }

  const emailsAdmin = lerListaEmails(env.ADMIN_EMAILS);
  if (google !== null && emailsAdmin.size === 0) {
    throw new ErroConfigAuth(
      "ADMIN_EMAILS é obrigatório com o login Google: informe o e-mail do primeiro admin.",
    );
  }
  const segredo = new TextEncoder().encode(env.AUTH_SECRET ?? "");
  if (segredo.byteLength < TAMANHO_MIN_SEGREDO) {
    throw new ErroConfigAuth(
      `AUTH_SECRET deve ter pelo menos ${TAMANHO_MIN_SEGREDO} bytes quando o login está ligado ` +
        "(gere com: openssl rand -base64 32).",
    );
  }
  return {
    habilitada: true,
    segredo,
    senha: senha === "" ? null : senha,
    google,
    emailsAdmin,
    emailsPermitidos: lerListaEmails(env.ALLOWED_EMAILS),
  };
}

/** `true` se o e-mail pode entrar com Google (allowlist ou admin). */
export function emailPermitido(
  config: { emailsAdmin: ReadonlySet<string>; emailsPermitidos: ReadonlySet<string> },
  email: string,
): boolean {
  const e = normalizarEmail(email);
  return config.emailsAdmin.has(e) || config.emailsPermitidos.has(e);
}
