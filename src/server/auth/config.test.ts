import { describe, expect, it } from "vitest";
import { ErroConfigAuth, emailPermitido, lerConfigAuth, lerListaEmails } from "./config";

const SEGREDO = "x".repeat(32);
const GOOGLE = {
  GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "segredo-google",
  ADMIN_EMAILS: "Admin@Exemplo.com",
};

describe("lerConfigAuth", () => {
  it("desliga a autenticação sem APP_PASSWORD nem Google fora de produção", () => {
    expect(lerConfigAuth({ NODE_ENV: "development" })).toEqual({ habilitada: false });
    expect(lerConfigAuth({ NODE_ENV: "test", APP_PASSWORD: "" })).toEqual({ habilitada: false });
  });

  it("recusa produção sem login, salvo ALLOW_NO_AUTH=true", () => {
    expect(() => lerConfigAuth({ NODE_ENV: "production" })).toThrow(ErroConfigAuth);
    expect(() => lerConfigAuth({ NODE_ENV: "production", ALLOW_NO_AUTH: "1" })).toThrow(
      /Autenticação não configurada em produção/,
    );
    expect(lerConfigAuth({ NODE_ENV: "production", ALLOW_NO_AUTH: "true" })).toEqual({
      habilitada: false,
    });
  });

  it("liga o login por senha com segredo de 32 bytes ou mais", () => {
    const config = lerConfigAuth({
      NODE_ENV: "production",
      APP_PASSWORD: "senha",
      AUTH_SECRET: SEGREDO,
    });
    expect(config).toEqual({
      habilitada: true,
      senha: "senha",
      google: null,
      segredo: new TextEncoder().encode(SEGREDO),
      emailsAdmin: new Set(),
      emailsPermitidos: new Set(),
    });
  });

  it("exige AUTH_SECRET com pelo menos 32 bytes quando há login", () => {
    expect(() => lerConfigAuth({ APP_PASSWORD: "senha" })).toThrow(/AUTH_SECRET/);
    expect(() => lerConfigAuth({ ...GOOGLE })).toThrow(/AUTH_SECRET/);
    expect(() => lerConfigAuth({ APP_PASSWORD: "senha", AUTH_SECRET: "curto" })).toThrow(
      ErroConfigAuth,
    );
    // 16 caracteres de 2 bytes cada = 32 bytes.
    expect(lerConfigAuth({ APP_PASSWORD: "senha", AUTH_SECRET: "ç".repeat(16) }).habilitada).toBe(
      true,
    );
  });

  it("liga o login Google com admins e allowlist normalizados", () => {
    const config = lerConfigAuth({
      ...GOOGLE,
      NODE_ENV: "production",
      AUTH_SECRET: SEGREDO,
      ALLOWED_EMAILS: " Ana@Exemplo.com, bia@exemplo.com;carla@exemplo.com\n",
    });
    expect(config).toMatchObject({
      habilitada: true,
      senha: null,
      google: { clientId: GOOGLE.GOOGLE_CLIENT_ID, clientSecret: GOOGLE.GOOGLE_CLIENT_SECRET },
      emailsAdmin: new Set(["admin@exemplo.com"]),
      emailsPermitidos: new Set(["ana@exemplo.com", "bia@exemplo.com", "carla@exemplo.com"]),
    });
  });

  it("exige as duas credenciais do Google e ADMIN_EMAILS", () => {
    expect(() =>
      lerConfigAuth({ GOOGLE_CLIENT_ID: "id", ADMIN_EMAILS: "a@b.c", AUTH_SECRET: SEGREDO }),
    ).toThrow(/GOOGLE_CLIENT_SECRET/);
    expect(() => lerConfigAuth({ ...GOOGLE, ADMIN_EMAILS: " , ", AUTH_SECRET: SEGREDO })).toThrow(
      /ADMIN_EMAILS/,
    );
  });

  it("aceita senha e Google juntos só fora de produção", () => {
    const env = { ...GOOGLE, APP_PASSWORD: "senha", AUTH_SECRET: SEGREDO };
    expect(lerConfigAuth({ ...env, NODE_ENV: "development" })).toMatchObject({
      senha: "senha",
      google: { clientId: GOOGLE.GOOGLE_CLIENT_ID },
    });
    expect(() => lerConfigAuth({ ...env, NODE_ENV: "production" })).toThrow(
      /APP_PASSWORD é só para uso local/,
    );
  });
});

describe("e-mails autorizados", () => {
  it("lê listas separadas por vírgula, ponto e vírgula ou espaço", () => {
    expect(lerListaEmails(undefined)).toEqual(new Set());
    expect(lerListaEmails("A@x.com  b@x.com,,c@x.com;")).toEqual(
      new Set(["a@x.com", "b@x.com", "c@x.com"]),
    );
  });

  it("permite admins e a allowlist, sem diferenciar maiúsculas", () => {
    const config = {
      emailsAdmin: new Set(["admin@x.com"]),
      emailsPermitidos: new Set(["ana@x.com"]),
    };
    expect(emailPermitido(config, "ADMIN@x.com")).toBe(true);
    expect(emailPermitido(config, " ana@x.com ")).toBe(true);
    expect(emailPermitido(config, "outro@x.com")).toBe(false);
  });
});
