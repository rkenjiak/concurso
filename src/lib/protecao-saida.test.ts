import { describe, expect, it } from "vitest";
import { type AncoraLink, type CliqueLink, destinoInterceptavel } from "./protecao-saida";

const ATUAL = "http://app.local/concursos/4/editar";
const clique = (parcial: Partial<CliqueLink> = {}): CliqueLink => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  ...parcial,
});
const ancora = (href: string | null, parcial: Partial<AncoraLink> = {}): AncoraLink => ({
  href,
  target: "",
  download: false,
  ...parcial,
});

describe("destinoInterceptavel", () => {
  it("intercepta links internos para outra página", () => {
    expect(destinoInterceptavel(clique(), ancora("/concursos"), ATUAL)).toBe("/concursos");
    expect(destinoInterceptavel(clique(), ancora("/calendario?mes=2026-11#x"), ATUAL)).toBe(
      "/calendario?mes=2026-11#x",
    );
    expect(destinoInterceptavel(clique(), ancora("http://app.local/"), ATUAL)).toBe("/");
    expect(destinoInterceptavel(clique(), ancora("../4"), ATUAL)).toBe("/concursos/4");
    expect(destinoInterceptavel(clique(), ancora("/concursos", { target: "_self" }), ATUAL)).toBe(
      "/concursos",
    );
  });

  it("não intercepta nova aba/janela nem clique já tratado", () => {
    for (const p of [
      { button: 1 },
      { button: 2 },
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { defaultPrevented: true },
    ]) {
      expect(destinoInterceptavel(clique(p), ancora("/concursos"), ATUAL)).toBeNull();
    }
  });

  it("não intercepta target, download, sem href, outra origem ou protocolo", () => {
    expect(destinoInterceptavel(clique(), ancora("/x", { target: "_blank" }), ATUAL)).toBeNull();
    expect(destinoInterceptavel(clique(), ancora("/api/export", { download: true }), ATUAL)).toBe(
      null,
    );
    expect(destinoInterceptavel(clique(), ancora(null), ATUAL)).toBeNull();
    expect(destinoInterceptavel(clique(), ancora("https://outro.site/"), ATUAL)).toBeNull();
    expect(destinoInterceptavel(clique(), ancora("mailto:a@b.c"), ATUAL)).toBeNull();
    expect(destinoInterceptavel(clique(), ancora("javascript:void(0)"), ATUAL)).toBeNull();
    expect(destinoInterceptavel(clique(), ancora("http://[invalido"), ATUAL)).toBeNull();
  });

  it("não intercepta âncoras ou a mesma URL", () => {
    expect(destinoInterceptavel(clique(), ancora("#observacoes"), ATUAL)).toBeNull();
    expect(destinoInterceptavel(clique(), ancora("/concursos/4/editar"), ATUAL)).toBeNull();
    expect(destinoInterceptavel(clique(), ancora("/concursos/4/editar?x=1"), ATUAL)).toBe(
      "/concursos/4/editar?x=1",
    );
  });
});
