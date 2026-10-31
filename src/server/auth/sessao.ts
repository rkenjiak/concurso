/**
 * Sessão em cookie com JWT assinado (HS256, `jose`) — ARQUITETURA.md §7.1. Sem dependências do
 * Next: usado pelo `proxy.ts`, pelas ações e pelos testes.
 */
import { jwtVerify, SignJWT } from "jose";

export const COOKIE_SESSAO = "concurso_sessao";
/** Duração da sessão: 30 dias. */
export const DURACAO_SESSAO_S = 30 * 24 * 60 * 60;

const ALG = "HS256";
const ASSUNTO = "dono";
const EMISSOR = "concurso";

/** Cria o token de sessão (expira em {@link DURACAO_SESSAO_S}). */
export async function criarTokenSessao(segredo: Uint8Array, agora = new Date()): Promise<string> {
  const iat = Math.floor(agora.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(ASSUNTO)
    .setIssuer(EMISSOR)
    .setIssuedAt(iat)
    .setExpirationTime(iat + DURACAO_SESSAO_S)
    .sign(segredo);
}

/** `true` se o token foi assinado com o segredo, é deste app e não expirou. */
export async function tokenSessaoValido(
  token: string | undefined | null,
  segredo: Uint8Array,
  agora = new Date(),
): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, segredo, {
      algorithms: [ALG],
      issuer: EMISSOR,
      subject: ASSUNTO,
      currentDate: agora,
    });
    return true;
  } catch {
    return false;
  }
}

/** Opções do cookie de sessão: `httpOnly`, `SameSite=Lax`, `secure` em produção, 30 dias. */
export function opcoesCookieSessao(producao: boolean) {
  return {
    httpOnly: true,
    secure: producao,
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_S,
  } as const;
}

/**
 * Destino seguro após o login: apenas caminhos internos (evita redirecionamento aberto para
 * outro domínio, como `//site` ou `/\site`).
 */
export function destinoSeguro(destino: unknown): string {
  if (typeof destino !== "string" || !destino.startsWith("/")) return "/";
  if (destino.startsWith("//") || destino.startsWith("/\\") || destino.startsWith("/login")) {
    return "/";
  }
  return destino;
}
