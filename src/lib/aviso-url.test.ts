import { describe, expect, it } from "vitest";
import { textoAvisoUrl, urlComAviso } from "./aviso-url";

describe("textoAvisoUrl", () => {
  it("traduz as chaves conhecidas", () => {
    expect(textoAvisoUrl("concurso-criado")).toBe("Concurso cadastrado.");
    expect(textoAvisoUrl("concurso-excluido")).toBe("Concurso excluído.");
  });

  it("ignora valor ausente, desconhecido, herdado ou repetido", () => {
    expect(textoAvisoUrl(null)).toBeNull();
    expect(textoAvisoUrl("")).toBeNull();
    expect(textoAvisoUrl("<script>")).toBeNull();
    expect(textoAvisoUrl("toString")).toBeNull();
    expect(textoAvisoUrl(["concurso-criado"])).toBeNull();
  });
});

describe("urlComAviso", () => {
  it("acrescenta o parâmetro preservando os demais", () => {
    expect(urlComAviso("/concursos/4?aba=eventos", "concurso-criado")).toBe(
      "/concursos/4?aba=eventos&aviso=concurso-criado",
    );
    expect(urlComAviso("/concursos", "concurso-excluido")).toBe(
      "/concursos?aviso=concurso-excluido",
    );
  });

  it("substitui um aviso anterior", () => {
    expect(urlComAviso("/concursos/4?aviso=concurso-criado", "concurso-salvo")).toBe(
      "/concursos/4?aviso=concurso-salvo",
    );
  });
});
