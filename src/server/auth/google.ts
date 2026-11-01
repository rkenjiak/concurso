/**
 * Login com Google por OpenID Connect (#49): fluxo *authorization code* com PKCE, `state` e
 * `nonce`, sem biblioteca de autenticação — só `jose` (já usado na sessão).
 *
 * 1. `/api/auth/google` gera `state`, `nonce` e o verificador PKCE, guarda-os num cookie assinado
 *    de curta duração e redireciona para o Google ({@link urlAutorizacao}).
 * 2. `/api/auth/google/callback` confere o `state`, troca o `code` pelo `id_token`
 *    ({@link trocarCodigo}) e valida assinatura, emissor, público, `nonce` e e-mail verificado
 *    ({@link validarIdToken}).
 *
 * Sem dependências do Next (testável); a busca de rede é injetável.
 */
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify, SignJWT } from "jose";
import type { ConfigGoogle } from "./config";
import { normalizarEmail } from "./config";

export const URL_AUTORIZACAO = "https://accounts.google.com/o/oauth2/v2/auth";
export const URL_TOKEN = "https://oauth2.googleapis.com/token";
export const URL_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
const EMISSORES = ["https://accounts.google.com", "accounts.google.com"];

/** Caminho do callback (registre `<origem>/api/auth/google/callback` no Google Cloud). */
export const CAMINHO_CALLBACK = "/api/auth/google/callback";

/** Cookie com `state`, `nonce` e verificador PKCE entre o início do login e o callback. */
export const COOKIE_OAUTH = "concurso_oauth";
export const DURACAO_OAUTH_S = 10 * 60;
const EMISSOR_OAUTH = "concurso-oauth";

/** Valor aleatório em base64url (`state`, `nonce`, verificador PKCE). */
export function aleatorio(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** `code_challenge` S256 do verificador PKCE. */
export function desafioPkce(verificador: string): string {
  return createHash("sha256").update(verificador).digest("base64url");
}

export interface EstadoOAuth {
  state: string;
  nonce: string;
  verificador: string;
  /** Caminho interno para onde voltar após o login. */
  para: string;
}

export async function criarCookieOAuth(
  segredo: Uint8Array,
  estado: EstadoOAuth,
  agora = new Date(),
): Promise<string> {
  const iat = Math.floor(agora.getTime() / 1000);
  return new SignJWT({ ...estado })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(EMISSOR_OAUTH)
    .setIssuedAt(iat)
    .setExpirationTime(iat + DURACAO_OAUTH_S)
    .sign(segredo);
}

export async function lerCookieOAuth(
  token: string | undefined,
  segredo: Uint8Array,
  agora = new Date(),
): Promise<EstadoOAuth | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo, {
      algorithms: ["HS256"],
      issuer: EMISSOR_OAUTH,
      currentDate: agora,
    });
    const { state, nonce, verificador, para } = payload;
    if (
      typeof state !== "string" ||
      typeof nonce !== "string" ||
      typeof verificador !== "string" ||
      typeof para !== "string"
    ) {
      return null;
    }
    return { state, nonce, verificador, para };
  } catch {
    return null;
  }
}

/** URL de autorização do Google para o estado informado. */
export function urlAutorizacao(
  google: ConfigGoogle,
  redirectUri: string,
  estado: EstadoOAuth,
): string {
  const url = new URL(URL_AUTORIZACAO);
  url.search = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: estado.state,
    nonce: estado.nonce,
    code_challenge: desafioPkce(estado.verificador),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

/** Erro esperado do fluxo (resposta inválida do Google, token rejeitado etc.). */
export class ErroLoginGoogle extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroLoginGoogle";
  }
}

/** Troca o `code` pelo `id_token` no endpoint de token do Google. */
export async function trocarCodigo(
  google: ConfigGoogle,
  redirectUri: string,
  code: string,
  verificador: string,
  buscar: typeof fetch = fetch,
): Promise<string> {
  const resposta = await buscar(URL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: google.clientId,
      client_secret: google.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verificador,
    }),
    cache: "no-store",
  });
  const corpo = (await resposta.json().catch(() => null)) as { id_token?: unknown } | null;
  if (!resposta.ok || typeof corpo?.id_token !== "string") {
    throw new ErroLoginGoogle(`Falha ao trocar o código no Google (HTTP ${resposta.status}).`);
  }
  return corpo.id_token;
}

/** Perfil extraído do `id_token` validado. */
export interface PerfilGoogle {
  sub: string;
  email: string;
  nome: string | null;
  avatarUrl: string | null;
}

let jwksGoogle: JWTVerifyGetKey | undefined;
const chavesGoogle = () => {
  jwksGoogle ??= createRemoteJWKSet(new URL(URL_JWKS));
  return jwksGoogle;
};

/**
 * Valida o `id_token` (assinatura pelas chaves públicas do Google, emissor, público = client ID,
 * expiração, `nonce`) e exige e-mail verificado.
 */
export async function validarIdToken(
  idToken: string,
  google: ConfigGoogle,
  nonce: string,
  chaves: JWTVerifyGetKey | CryptoKey = chavesGoogle(),
  agora = new Date(),
): Promise<PerfilGoogle> {
  const opcoes = { issuer: EMISSORES, audience: google.clientId, currentDate: agora };
  let payload: Record<string, unknown>;
  try {
    ({ payload } =
      typeof chaves === "function"
        ? await jwtVerify(idToken, chaves, opcoes)
        : await jwtVerify(idToken, chaves, opcoes));
  } catch (erro) {
    throw new ErroLoginGoogle(`id_token inválido: ${(erro as Error).message}`);
  }
  if (payload.nonce !== nonce) throw new ErroLoginGoogle("nonce do id_token não confere.");
  const { sub, email, email_verified, name, picture } = payload;
  if (typeof sub !== "string" || sub === "") throw new ErroLoginGoogle("id_token sem sub.");
  if (typeof email !== "string" || email === "") throw new ErroLoginGoogle("id_token sem e-mail.");
  if (email_verified !== true) throw new ErroLoginGoogle("E-mail da conta Google não verificado.");
  return {
    sub,
    email: normalizarEmail(email),
    nome: typeof name === "string" && name !== "" ? name : null,
    avatarUrl: typeof picture === "string" && picture.startsWith("https://") ? picture : null,
  };
}
