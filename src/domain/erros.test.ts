import { describe, expect, it } from "vitest";
import { ErroDominio } from "./erros";

describe("ErroDominio", () => {
  it("é um Error identificável", () => {
    const e = new ErroDominio("mensagem");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("ErroDominio");
    expect(e.message).toBe("mensagem");
  });
});
