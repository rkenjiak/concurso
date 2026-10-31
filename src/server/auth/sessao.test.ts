import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
  criarTokenSessao,
  DURACAO_SESSAO_S,
  destinoSeguro,
  opcoesCookieSessao,
  tokenSessaoValido,
} from "./sessao";

const segredo = new TextEncoder().encode("s".repeat(32));
const outro = new TextEncoder().encode("o".repeat(32));
const AGORA = new Date("2026-10-31T12:00:00Z");
const mais = (s: number) => new Date(AGORA.getTime() + s * 1000);

describe("token de sessão", () => {
  it("é válido com o mesmo segredo até expirar em 30 dias", async () => {
    const token = await criarTokenSessao(segredo, AGORA);
    expect(await tokenSessaoValido(token, segredo, AGORA)).toBe(true);
    expect(await tokenSessaoValido(token, segredo, mais(DURACAO_SESSAO_S - 60))).toBe(true);
    expect(await tokenSessaoValido(token, segredo, mais(DURACAO_SESSAO_S + 1))).toBe(false);
  });

  it("rejeita segredo diferente, token adulterado e ausente", async () => {
    const token = await criarTokenSessao(segredo, AGORA);
    expect(await tokenSessaoValido(token, outro, AGORA)).toBe(false);
    const [h, p, s] = token.split(".");
    const adulterado = `${h}.${p}.${s?.slice(0, -2)}xx`;
    expect(await tokenSessaoValido(adulterado, segredo, AGORA)).toBe(false);
    expect(await tokenSessaoValido("", segredo, AGORA)).toBe(false);
    expect(await tokenSessaoValido(undefined, segredo, AGORA)).toBe(false);
    expect(await tokenSessaoValido("lixo", segredo, AGORA)).toBe(false);
  });

  it("rejeita token sem emissor/assunto do app ou com outro algoritmo", async () => {
    const semClaims = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(segredo);
    expect(await tokenSessaoValido(semClaims, segredo)).toBe(false);
    const hs512 = await new SignJWT({})
      .setProtectedHeader({ alg: "HS512" })
      .setIssuer("concurso")
      .setSubject("dono")
      .setExpirationTime("1h")
      .sign(segredo);
    expect(await tokenSessaoValido(hs512, segredo)).toBe(false);
  });
});

describe("opcoesCookieSessao", () => {
  it("httpOnly, lax, 30 dias e secure só em produção", () => {
    expect(opcoesCookieSessao(true)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: DURACAO_SESSAO_S,
    });
    expect(opcoesCookieSessao(false).secure).toBe(false);
  });
});

describe("destinoSeguro", () => {
  it.each([
    ["/concursos?status=INSCRITO", "/concursos?status=INSCRITO"],
    ["/concursos/1", "/concursos/1"],
    ["", "/"],
    [undefined, "/"],
    [null, "/"],
    ["https://mal.com", "/"],
    ["//mal.com", "/"],
    ["/\\mal.com", "/"],
    ["/login", "/"],
    ["concursos", "/"],
  ])("%j → %j", (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado);
  });
});
