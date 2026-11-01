import { generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
  criarCookieOAuth,
  desafioPkce,
  ErroLoginGoogle,
  lerCookieOAuth,
  trocarCodigo,
  URL_TOKEN,
  urlAutorizacao,
  validarIdToken,
} from "./google";

const GOOGLE = { clientId: "cliente.apps.googleusercontent.com", clientSecret: "segredo" };
const REDIRECT = "http://localhost:3000/api/auth/google/callback";
const segredo = new TextEncoder().encode("s".repeat(32));
const ESTADO = { state: "st", nonce: "nn", verificador: "vv".repeat(22), para: "/concursos" };

describe("PKCE e URL de autorização", () => {
  it("calcula o desafio S256 (RFC 7636, apêndice B)", () => {
    expect(desafioPkce("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("monta a URL com client, callback, escopos, state, nonce e PKCE", () => {
    const url = new URL(urlAutorizacao(GOOGLE, REDIRECT, ESTADO));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: GOOGLE.clientId,
      redirect_uri: REDIRECT,
      response_type: "code",
      scope: "openid email profile",
      state: "st",
      nonce: "nn",
      code_challenge: desafioPkce(ESTADO.verificador),
      code_challenge_method: "S256",
      prompt: "select_account",
    });
  });
});

describe("cookie do fluxo OAuth", () => {
  const AGORA = new Date("2026-11-01T12:00:00Z");

  it("guarda o estado por 10 minutos, assinado", async () => {
    const token = await criarCookieOAuth(segredo, ESTADO, AGORA);
    expect(await lerCookieOAuth(token, segredo, AGORA)).toEqual(ESTADO);
    expect(await lerCookieOAuth(token, segredo, new Date(AGORA.getTime() + 11 * 60_000))).toBe(
      null,
    );
    const outro = new TextEncoder().encode("o".repeat(32));
    expect(await lerCookieOAuth(token, outro, AGORA)).toBeNull();
    expect(await lerCookieOAuth(undefined, segredo, AGORA)).toBeNull();
  });
});

describe("trocarCodigo", () => {
  it("envia code, credenciais e verificador e devolve o id_token", async () => {
    let enviado: { url: string; corpo: URLSearchParams } | undefined;
    const buscar = (async (url: string, init: RequestInit) => {
      enviado = { url, corpo: init.body as URLSearchParams };
      return Response.json({ id_token: "token", access_token: "x" });
    }) as unknown as typeof fetch;
    expect(await trocarCodigo(GOOGLE, REDIRECT, "codigo", "verif", buscar)).toBe("token");
    expect(enviado?.url).toBe(URL_TOKEN);
    expect(Object.fromEntries(enviado?.corpo ?? [])).toEqual({
      code: "codigo",
      client_id: GOOGLE.clientId,
      client_secret: GOOGLE.clientSecret,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
      code_verifier: "verif",
    });
  });

  it("falha com resposta de erro ou sem id_token", async () => {
    const erro = (async () =>
      Response.json({ error: "invalid_grant" }, { status: 400 })) as unknown as typeof fetch;
    await expect(trocarCodigo(GOOGLE, REDIRECT, "c", "v", erro)).rejects.toThrow(ErroLoginGoogle);
    const vazio = (async () => Response.json({})) as unknown as typeof fetch;
    await expect(trocarCodigo(GOOGLE, REDIRECT, "c", "v", vazio)).rejects.toThrow(ErroLoginGoogle);
  });
});

describe("validarIdToken", () => {
  let chaves: Awaited<ReturnType<typeof generateKeyPair>>;
  beforeAll(async () => {
    chaves = await generateKeyPair("RS256");
  });

  const emitir = (claims: Record<string, unknown>, aud = GOOGLE.clientId) =>
    new SignJWT({
      email: "Pessoa@Gmail.com",
      email_verified: true,
      nonce: "nn",
      name: "Pessoa Teste",
      picture: "https://lh3.googleusercontent.com/foto",
      ...claims,
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("https://accounts.google.com")
      .setAudience(aud)
      .setSubject("1234567890")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(chaves.privateKey);

  it("devolve o perfil com e-mail normalizado", async () => {
    expect(await validarIdToken(await emitir({}), GOOGLE, "nn", chaves.publicKey)).toEqual({
      sub: "1234567890",
      email: "pessoa@gmail.com",
      nome: "Pessoa Teste",
      avatarUrl: "https://lh3.googleusercontent.com/foto",
    });
  });

  it("rejeita outro público, nonce diferente e e-mail não verificado", async () => {
    const validar = async (token: Promise<string>) =>
      validarIdToken(await token, GOOGLE, "nn", chaves.publicKey);
    await expect(validar(emitir({}, "outro-cliente"))).rejects.toThrow(ErroLoginGoogle);
    await expect(validar(emitir({ nonce: "outro" }))).rejects.toThrow(/nonce/);
    await expect(validar(emitir({ email_verified: false }))).rejects.toThrow(/não verificado/);
    await expect(validar(emitir({ email: undefined }))).rejects.toThrow(/sem e-mail/);
  });

  it("rejeita assinatura de outra chave", async () => {
    const outra = await generateKeyPair("RS256");
    await expect(validarIdToken(await emitir({}), GOOGLE, "nn", outra.publicKey)).rejects.toThrow(
      ErroLoginGoogle,
    );
  });

  it("ignora nome vazio e foto sem https", async () => {
    const perfil = await validarIdToken(
      await emitir({ name: "", picture: "http://x/foto" }),
      GOOGLE,
      "nn",
      chaves.publicKey,
    );
    expect(perfil).toMatchObject({ nome: null, avatarUrl: null });
  });
});
