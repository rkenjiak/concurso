import { describe, expect, it } from "vitest";
import { ErroConfigAuth, lerConfigAuth } from "./config";

const SEGREDO = "x".repeat(32);

describe("lerConfigAuth", () => {
  it("desliga a autenticação sem APP_PASSWORD fora de produção", () => {
    expect(lerConfigAuth({ NODE_ENV: "development" })).toEqual({ habilitada: false });
    expect(lerConfigAuth({ NODE_ENV: "test", APP_PASSWORD: "" })).toEqual({ habilitada: false });
  });

  it("recusa produção sem APP_PASSWORD, salvo ALLOW_NO_AUTH=true", () => {
    expect(() => lerConfigAuth({ NODE_ENV: "production" })).toThrow(ErroConfigAuth);
    expect(() => lerConfigAuth({ NODE_ENV: "production", ALLOW_NO_AUTH: "1" })).toThrow(
      /APP_PASSWORD não definido em produção/,
    );
    expect(lerConfigAuth({ NODE_ENV: "production", ALLOW_NO_AUTH: "true" })).toEqual({
      habilitada: false,
    });
  });

  it("liga a autenticação com senha e segredo de 32 bytes ou mais", () => {
    const config = lerConfigAuth({
      NODE_ENV: "production",
      APP_PASSWORD: "senha",
      AUTH_SECRET: SEGREDO,
    });
    expect(config).toEqual({
      habilitada: true,
      senha: "senha",
      segredo: new TextEncoder().encode(SEGREDO),
    });
  });

  it("exige AUTH_SECRET com pelo menos 32 bytes quando há senha", () => {
    expect(() => lerConfigAuth({ APP_PASSWORD: "senha" })).toThrow(/AUTH_SECRET/);
    expect(() => lerConfigAuth({ APP_PASSWORD: "senha", AUTH_SECRET: "curto" })).toThrow(
      ErroConfigAuth,
    );
    // 16 caracteres de 2 bytes cada = 32 bytes.
    expect(lerConfigAuth({ APP_PASSWORD: "senha", AUTH_SECRET: "ç".repeat(16) }).habilitada).toBe(
      true,
    );
  });
});
