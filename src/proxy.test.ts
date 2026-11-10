/**
 * Proteção das rotas pelo `proxy.ts` (ARQUITETURA.md §7.1): com o login ligado e sem sessão, as
 * rotas públicas passam (`/api/health`, `/api/versao`, #118) e as demais respondem 401 (APIs) ou
 * redirecionam para o login (páginas). Só a assinatura do cookie é conferida, sem banco.
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";
import { COOKIE_SESSAO, criarTokenSessao } from "./server/auth/sessao";

const SEGREDO = "segredo-somente-para-testes-0123456789";

function requisicao(caminho: string, cookie?: string): NextRequest {
  const headers = cookie ? { cookie: `${COOKIE_SESSAO}=${cookie}` } : undefined;
  return new NextRequest(new URL(caminho, "http://localhost:3000"), { headers });
}

/** `NextResponse.next()` marca a resposta com `x-middleware-next`. */
const passou = (r: Response) => r.headers.get("x-middleware-next") === "1";

beforeEach(() => {
  vi.stubEnv("APP_PASSWORD", "senha-de-teste");
  vi.stubEnv("AUTH_SECRET", SEGREDO);
  vi.stubEnv("GOOGLE_CLIENT_ID", "");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
  vi.stubEnv("ALLOW_NO_AUTH", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy (login ligado, sem sessão)", () => {
  it.each(["/api/versao", "/api/health", "/login"])("%s é público", async (caminho) => {
    expect(passou(await proxy(requisicao(caminho)))).toBe(true);
  });

  it("APIs protegidas respondem 401", async () => {
    const r = await proxy(requisicao("/api/export"));
    expect(passou(r)).toBe(false);
    expect(r.status).toBe(401);
  });

  it("páginas redirecionam para o login com o destino", async () => {
    const r = await proxy(requisicao("/configuracoes?x=1"));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe(
      "http://localhost:3000/login?para=%2Fconfiguracoes%3Fx%3D1",
    );
  });

  it("variações do caminho público não passam", async () => {
    expect((await proxy(requisicao("/api/versao/x"))).status).toBe(401);
  });

  it("com sessão válida, rotas protegidas passam", async () => {
    const token = await criarTokenSessao(new TextEncoder().encode(SEGREDO), {
      usuarioId: 1,
      metodo: "senha",
    });
    expect(passou(await proxy(requisicao("/api/export", token)))).toBe(true);
  });
});

describe("proxy (login desligado)", () => {
  it("tudo passa", async () => {
    vi.stubEnv("APP_PASSWORD", "");
    vi.stubEnv("AUTH_SECRET", "");
    expect(passou(await proxy(requisicao("/api/export")))).toBe(true);
  });
});
