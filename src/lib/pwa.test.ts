import { describe, expect, it } from "vitest";
import { COR_TEMA, ehArquivoPwaPublico, sincronizarCorTema } from "./pwa";

describe("ehArquivoPwaPublico", () => {
  it("libera o manifest e os ícones (o navegador os busca sem sessão)", () => {
    for (const caminho of [
      "/manifest.webmanifest",
      "/icon.svg",
      "/apple-icon.png",
      "/favicon.ico",
      "/icons/icon-192.png",
      "/icons/icon-maskable-512.png",
    ]) {
      expect(ehArquivoPwaPublico(caminho), caminho).toBe(true);
    }
  });

  it("não libera páginas nem APIs", () => {
    for (const caminho of [
      "/",
      "/concursos",
      "/api/export",
      "/icons",
      "/manifest.json",
      "/x/icon.svg",
    ]) {
      expect(ehArquivoPwaPublico(caminho), caminho).toBe(false);
    }
  });
});

describe("sincronizarCorTema", () => {
  function docFalso() {
    const head: { name: string; content: string }[] = [];
    return {
      head: { appendChild: (no: { name: string; content: string }) => head.push(no) },
      querySelector: () => head.find((m) => m.name === "theme-color") ?? null,
      createElement: () => ({ name: "", content: "" }),
      metas: head,
    };
  }

  it("cria a meta theme-color uma vez e a atualiza com a cor do tema efetivo", () => {
    const doc = docFalso();
    sincronizarCorTema(doc, true);
    expect(doc.metas).toEqual([{ name: "theme-color", content: COR_TEMA.escuro }]);
    sincronizarCorTema(doc, false);
    expect(doc.metas).toEqual([{ name: "theme-color", content: COR_TEMA.claro }]);
  });
});
