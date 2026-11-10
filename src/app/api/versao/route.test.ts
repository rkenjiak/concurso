/**
 * `GET /api/versao` (#118): público e só com versão, commit e ambiente. Os valores são lidos ao
 * carregar `lib/versao.ts`, então cada caso recarrega a rota com o ambiente simulado.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { version } from "../../../../package.json";

async function responder(env: Record<string, string> = {}) {
  for (const [nome, valor] of Object.entries(env)) vi.stubEnv(nome, valor);
  vi.resetModules();
  const { GET } = await import("./route");
  return GET();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("GET /api/versao (#118)", () => {
  it("responde só versão, commit e ambiente, sem cache nem outras variáveis", async () => {
    const resposta = await responder({
      DATABASE_URL: "libsql://banco-secreto.turso.io",
      AUTH_SECRET: "segredo-de-teste-0123456789abcdef",
    });
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("Cache-Control")).toBe("no-store");
    const texto = await resposta.text();
    expect(JSON.parse(texto)).toEqual({ versao: version, commit: "dev", ambiente: "development" });
    expect(texto).not.toMatch(/secret|segredo|turso|dataBuild/i);
  });

  it("preview da Vercel: commit e ambiente fixados no build", async () => {
    const resposta = await responder({ APP_COMMIT: "a1b2c3d", APP_AMBIENTE: "preview" });
    expect(await resposta.json()).toEqual({
      versao: version,
      commit: "a1b2c3d",
      ambiente: "preview",
    });
  });
});
