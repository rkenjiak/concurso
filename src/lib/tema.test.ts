import { afterEach, describe, expect, it, vi } from "vitest";
import { COR_TEMA } from "./pwa";
import {
  aplicarTema,
  CHAVE_TEMA,
  normalizarTema,
  resolverTema,
  SCRIPT_TEMA,
  TEMA_PADRAO,
} from "./tema";

describe("normalizarTema", () => {
  it("aceita os três temas", () => {
    expect(normalizarTema("claro")).toBe("claro");
    expect(normalizarTema("escuro")).toBe("escuro");
    expect(normalizarTema("sistema")).toBe("sistema");
  });

  it("usa o padrão (sistema) para valores ausentes ou inválidos", () => {
    expect(TEMA_PADRAO).toBe("sistema");
    expect(normalizarTema(null)).toBe("sistema");
    expect(normalizarTema("dark")).toBe("sistema");
    expect(normalizarTema(1)).toBe("sistema");
  });
});

describe("resolverTema", () => {
  it("claro e escuro ignoram o sistema", () => {
    expect(resolverTema("claro", true)).toBe("claro");
    expect(resolverTema("escuro", false)).toBe("escuro");
  });

  it("sistema segue prefers-color-scheme", () => {
    expect(resolverTema("sistema", true)).toBe("escuro");
    expect(resolverTema("sistema", false)).toBe("claro");
  });
});

/** `<html>` mínimo, suficiente para `aplicarTema` e o script inline. */
function raizFalsa() {
  const classes = new Set<string>();
  return {
    classList: {
      toggle: (c: string, ligar: boolean) => (ligar ? classes.add(c) : classes.delete(c)),
      contains: (c: string) => classes.has(c),
    },
    style: { colorScheme: "" },
  };
}

describe("aplicarTema", () => {
  it("liga e desliga a classe dark e o color-scheme", () => {
    const raiz = raizFalsa();
    aplicarTema(raiz as unknown as HTMLElement, "escuro");
    expect(raiz.classList.contains("dark")).toBe(true);
    expect(raiz.style.colorScheme).toBe("dark");
    aplicarTema(raiz as unknown as HTMLElement, "claro");
    expect(raiz.classList.contains("dark")).toBe(false);
    expect(raiz.style.colorScheme).toBe("light");
  });
});

describe("SCRIPT_TEMA", () => {
  afterEach(() => vi.unstubAllGlobals());

  function rodar(salvo: string | null, sistemaEscuro: boolean) {
    const raiz = raizFalsa();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k === CHAVE_TEMA ? salvo : null),
    });
    vi.stubGlobal("matchMedia", () => ({ matches: sistemaEscuro }));
    const head: { name: string; content: string }[] = [];
    vi.stubGlobal("document", {
      documentElement: raiz,
      head: { appendChild: (no: { name: string; content: string }) => head.push(no) },
      querySelector: () => head.find((m) => m.name === "theme-color") ?? null,
      createElement: () => ({ name: "", content: "" }),
    });
    new Function(SCRIPT_TEMA)();
    return Object.assign(raiz, { metas: head });
  }

  it.each([
    [null, true, true],
    [null, false, false],
    ["sistema", true, true],
    ["claro", true, false],
    ["escuro", false, true],
    ["lixo", false, false],
  ])("salvo=%s, sistema escuro=%s → dark=%s", (salvo, sistemaEscuro, dark) => {
    const raiz = rodar(salvo, sistemaEscuro);
    expect(raiz.classList.contains("dark")).toBe(dark);
    expect(raiz.style.colorScheme).toBe(dark ? "dark" : "light");
    // Cria a meta da barra de status do PWA (#66) na cor do tema efetivo.
    expect(raiz.metas).toEqual([
      { name: "theme-color", content: dark ? COR_TEMA.escuro : COR_TEMA.claro },
    ]);
  });

  it("não quebra se o localStorage estiver indisponível", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
    });
    vi.stubGlobal("document", { documentElement: raizFalsa() });
    expect(() => new Function(SCRIPT_TEMA)()).not.toThrow();
  });
});
