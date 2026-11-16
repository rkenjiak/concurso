// @vitest-environment happy-dom
import { act, type ComponentProps, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LinkSobDemanda } from "./link-sob-demanda";

/**
 * `next/link` falso: registra o `prefetch` recebido (em `data-prefetch`) e devolve o estado
 * pendente controlado pelo teste. O que se testa é o `LinkSobDemanda`, não o roteador do Next.
 */
const link = vi.hoisted(() => ({ pendente: false }));

vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: ComponentProps<"a"> & { prefetch?: unknown }) => (
    <a {...props} data-prefetch={String(prefetch)} />
  ),
  useLinkStatus: () => ({ pending: link.pendente }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const naoNavegar = (e: Event) => e.preventDefault();
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  link.pendente = false;
  // Sem roteador: o clique não navega (o happy-dom seguiria o href).
  document.addEventListener("click", naoNavegar);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.removeEventListener("click", naoNavegar);
});

function renderizar(elemento: React.ReactNode): HTMLAnchorElement {
  act(() => root.render(elemento));
  const a = container.querySelector("a");
  if (!a) throw new Error("Link não renderizado.");
  return a;
}

const disparar = (alvo: Element, evento: Event) => act(() => void alvo.dispatchEvent(evento));

describe("LinkSobDemanda (#124)", () => {
  it("começa sem prefetch e repassa as props ao <Link>", () => {
    const a = renderizar(
      <LinkSobDemanda
        href="/concursos/1"
        className="block p-4"
        draggable={false}
        data-destaque="URGENTE"
        aria-label="Concurso 1"
      >
        Concurso
      </LinkSobDemanda>,
    );
    expect(a.dataset.prefetch).toBe("false");
    expect(a.getAttribute("href")).toBe("/concursos/1");
    expect(a.getAttribute("draggable")).toBe("false");
    expect(a.dataset.destaque).toBe("URGENTE");
    expect(a.getAttribute("aria-label")).toBe("Concurso 1");
    expect(a.className).toBe("relative block p-4");
    expect(a.textContent).toBe("Concurso");
  });

  it.each([
    ["mouse", "onMouseEnter", () => new MouseEvent("mouseover", { bubbles: true })],
    ["foco", "onFocus", () => new FocusEvent("focusin", { bubbles: true })],
    ["toque", "onTouchStart", () => new Event("touchstart", { bubbles: true })],
  ] as const)(
    "ativa o prefetch padrão por intenção (%s) e chama o %s de quem usa",
    (_, prop, evento) => {
      const handler = vi.fn();
      const a = renderizar(
        <LinkSobDemanda href="/concursos/1" {...{ [prop]: handler }}>
          Concurso
        </LinkSobDemanda>,
      );
      disparar(a, evento());
      expect(handler).toHaveBeenCalledOnce();
      // `null` = prefetch padrão do Next.
      expect(a.dataset.prefetch).toBe("null");
    },
  );

  it("continua ativo depois que o mouse sai", () => {
    const a = renderizar(<LinkSobDemanda href="/concursos/1">Concurso</LinkSobDemanda>);
    disparar(a, new MouseEvent("mouseover", { bubbles: true }));
    disparar(a, new MouseEvent("mouseout", { bubbles: true }));
    expect(a.dataset.prefetch).toBe("null");
  });

  it("mantém o onClick de quem usa", () => {
    const onClick = vi.fn();
    const a = renderizar(
      <LinkSobDemanda href="/concursos/1" onClick={onClick}>
        Concurso
      </LinkSobDemanda>,
    );
    act(() => a.click());
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("não deixa quem usa definir o prefetch", () => {
    const props = { href: "/concursos/1", prefetch: true } as ComponentProps<typeof LinkSobDemanda>;
    const a = renderizar(<LinkSobDemanda {...props}>Concurso</LinkSobDemanda>);
    expect(a.dataset.prefetch).toBe("false");
  });

  it("repassa o ref ao link", () => {
    const ref = createRef<HTMLAnchorElement>();
    const a = renderizar(
      <LinkSobDemanda href="/concursos/1" ref={ref}>
        Concurso
      </LinkSobDemanda>,
    );
    expect(ref.current).toBe(a);
  });

  it("mostra o indicador decorativo só enquanto a navegação está pendente", () => {
    const a = renderizar(<LinkSobDemanda href="/concursos/1">Concurso</LinkSobDemanda>);
    const indicador = a.querySelector('[data-slot="link-pendente"]');
    expect(indicador?.getAttribute("aria-hidden")).toBe("true");
    expect(indicador?.hasAttribute("data-pendente")).toBe(false);
    expect(indicador?.className).toContain("opacity-0");

    link.pendente = true;
    renderizar(<LinkSobDemanda href="/concursos/1">Concurso</LinkSobDemanda>);
    expect(indicador?.hasAttribute("data-pendente")).toBe(true);
    expect(indicador?.className).toContain("opacity-100");
  });
});
