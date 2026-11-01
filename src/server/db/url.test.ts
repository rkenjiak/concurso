import { describe, expect, it } from "vitest";
import { DATABASE_URL_PADRAO, tokenDoBanco, urlDoBanco } from "./url";

describe("urlDoBanco", () => {
  it("prioriza DATABASE_URL sobre TURSO_DATABASE_URL", () => {
    expect(
      urlDoBanco({ DATABASE_URL: "file:./outro.db", TURSO_DATABASE_URL: "libsql://x.turso.io" }),
    ).toBe("file:./outro.db");
  });

  it("usa TURSO_DATABASE_URL quando DATABASE_URL não está definida", () => {
    expect(urlDoBanco({ TURSO_DATABASE_URL: "libsql://x.turso.io" })).toBe("libsql://x.turso.io");
  });

  it("trata DATABASE_URL vazia como não definida", () => {
    expect(urlDoBanco({ DATABASE_URL: "", TURSO_DATABASE_URL: "libsql://x.turso.io" })).toBe(
      "libsql://x.turso.io",
    );
  });

  it("cai no SQLite local sem nenhuma das duas (ou com ambas vazias)", () => {
    expect(urlDoBanco({})).toBe(DATABASE_URL_PADRAO);
    expect(urlDoBanco({ DATABASE_URL: "", TURSO_DATABASE_URL: "" })).toBe(DATABASE_URL_PADRAO);
  });
});

describe("tokenDoBanco", () => {
  it("prioriza DATABASE_AUTH_TOKEN sobre TURSO_AUTH_TOKEN", () => {
    expect(tokenDoBanco({ DATABASE_AUTH_TOKEN: "a", TURSO_AUTH_TOKEN: "b" })).toBe("a");
  });

  it("usa TURSO_AUTH_TOKEN quando DATABASE_AUTH_TOKEN está ausente ou vazio", () => {
    expect(tokenDoBanco({ TURSO_AUTH_TOKEN: "b" })).toBe("b");
    expect(tokenDoBanco({ DATABASE_AUTH_TOKEN: "", TURSO_AUTH_TOKEN: "b" })).toBe("b");
  });

  it("retorna undefined sem token (ou com ambos vazios)", () => {
    expect(tokenDoBanco({})).toBeUndefined();
    expect(tokenDoBanco({ DATABASE_AUTH_TOKEN: "", TURSO_AUTH_TOKEN: "" })).toBeUndefined();
  });
});
