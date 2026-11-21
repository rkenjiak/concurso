import { describe, expect, it } from "vitest";
import {
  caminhoCompartilhado,
  ehTokenCompartilhamentoValido,
  TAMANHO_TOKEN_COMPARTILHAMENTO,
  urlCompartilhada,
} from "./compartilhamento";

const TOKEN_VALIDO = "abcdefghijklmnopqrstuvwxyz0123_-";

describe("compartilhamento (utilitários)", () => {
  it("aceita apenas tokens base64url com tamanho exato", () => {
    expect(TOKEN_VALIDO).toHaveLength(TAMANHO_TOKEN_COMPARTILHAMENTO);
    expect(ehTokenCompartilhamentoValido(TOKEN_VALIDO)).toBe(true);
    expect(ehTokenCompartilhamentoValido("ABCDEFGHIJKLMNOPQRSTUVWXYZ012345")).toBe(true);
    expect(ehTokenCompartilhamentoValido("")).toBe(false);
    expect(ehTokenCompartilhamentoValido(TOKEN_VALIDO.slice(0, -1))).toBe(false);
    expect(ehTokenCompartilhamentoValido(`${TOKEN_VALIDO}a`)).toBe(false);
    expect(ehTokenCompartilhamentoValido(`${TOKEN_VALIDO.slice(0, -1)}+`)).toBe(false);
    expect(ehTokenCompartilhamentoValido(`${TOKEN_VALIDO.slice(0, -1)}/`)).toBe(false);
    expect(ehTokenCompartilhamentoValido(`${TOKEN_VALIDO.slice(0, -1)}=`)).toBe(false);
    expect(ehTokenCompartilhamentoValido(`${TOKEN_VALIDO.slice(0, -1)}.`)).toBe(false);
  });

  it("monta caminho e URL pública sem barra duplicada", () => {
    expect(caminhoCompartilhado(TOKEN_VALIDO)).toBe(`/compartilhado/${TOKEN_VALIDO}`);
    expect(urlCompartilhada("https://concursos.exemplo.com", TOKEN_VALIDO)).toBe(
      `https://concursos.exemplo.com/compartilhado/${TOKEN_VALIDO}`,
    );
    expect(urlCompartilhada("https://concursos.exemplo.com/", TOKEN_VALIDO)).toBe(
      `https://concursos.exemplo.com/compartilhado/${TOKEN_VALIDO}`,
    );
  });
});
