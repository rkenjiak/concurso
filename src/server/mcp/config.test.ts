import { describe, expect, it } from "vitest";
import { ErroConfigMcp, lerConfigMcp, TAMANHO_MIN_TOKEN, tokenBearer } from "./config";

const TOKEN = "t".repeat(TAMANHO_MIN_TOKEN);

describe("lerConfigMcp", () => {
  it("fica desligado sem MCP_TOKEN", () => {
    expect(lerConfigMcp({})).toEqual({ habilitado: false });
    expect(lerConfigMcp({ MCP_TOKEN: "  " })).toEqual({ habilitado: false });
  });

  it("liga com token longo o bastante", () => {
    expect(lerConfigMcp({ MCP_TOKEN: ` ${TOKEN} ` })).toEqual({ habilitado: true, token: TOKEN });
  });

  it("recusa token curto", () => {
    expect(() => lerConfigMcp({ MCP_TOKEN: TOKEN.slice(1) })).toThrow(ErroConfigMcp);
  });
});

describe("tokenBearer", () => {
  it("extrai o token do header Authorization", () => {
    expect(tokenBearer(`Bearer ${TOKEN}`)).toBe(TOKEN);
    expect(tokenBearer(`bearer   ${TOKEN} `)).toBe(TOKEN);
  });

  it("devolve null sem esquema Bearer", () => {
    expect(tokenBearer(null)).toBeNull();
    expect(tokenBearer("")).toBeNull();
    expect(tokenBearer(`Basic ${TOKEN}`)).toBeNull();
    expect(tokenBearer("Bearer a b")).toBeNull();
  });
});
