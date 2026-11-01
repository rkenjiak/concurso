import { describe, expect, it } from "vitest";
import { tokenBearer } from "./config";

const TOKEN = "t".repeat(32);

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
