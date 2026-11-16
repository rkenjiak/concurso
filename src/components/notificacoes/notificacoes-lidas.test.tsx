// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ItemNotificacao, ListaNotificacoes } from "./lista-notificacoes";
import { NotificacoesLidasProvider, useNaoLidas, useNotificacoesLidas } from "./notificacoes-lidas";

const acoes = vi.hoisted(() => ({
  abrirNotificacaoAcao: vi.fn(async () => ({ ok: true as const, data: null })),
  marcarNotificacaoLidaAcao: vi.fn(async () => ({ ok: true as const, data: null })),
  dispensarNotificacaoAcao: vi.fn(async () => ({ ok: true as const, data: null })),
  marcarTodasLidasAcao: vi.fn(async () => ({ ok: true as const, data: { marcadas: 0 } })),
}));
vi.mock("@/server/actions/notificacoes", () => acoes);

// `next/link` falso: registra o `prefetch` recebido (em `data-prefetch`), sem roteador.
vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: ComponentProps<"a"> & { prefetch?: unknown }) => (
    <a {...props} data-prefetch={String(prefetch)} />
  ),
  useLinkStatus: () => ({ pending: false }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const naoNavegar = (e: Event) => e.preventDefault();
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
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

const renderizar = (elemento: React.ReactNode) => act(() => root.render(elemento));

/** Mostra o contador descontado e expõe `marcarLida` num botão por chave. */
function Contador({ doServidor, chaves = [] }: { doServidor: number; chaves?: string[] }) {
  const naoLidas = useNaoLidas(doServidor);
  const { marcarLida } = useNotificacoesLidas();
  return (
    <>
      <output>{naoLidas}</output>
      {chaves.map((c) => (
        <button key={c} type="button" data-chave={c} onClick={() => marcarLida(c)} />
      ))}
    </>
  );
}

const contador = () => container.querySelector("output")?.textContent;
const marcar = (chave: string) =>
  act(() => container.querySelector<HTMLButtonElement>(`[data-chave="${chave}"]`)?.click());

describe("NotificacoesLidasProvider (#124)", () => {
  it("desconta do contador as chaves abertas no cliente, uma vez cada", () => {
    renderizar(
      <NotificacoesLidasProvider versao="v1">
        <Contador doServidor={3} chaves={["a", "b"]} />
      </NotificacoesLidasProvider>,
    );
    expect(contador()).toBe("3");
    marcar("a");
    expect(contador()).toBe("2");
    marcar("a");
    expect(contador()).toBe("2");
    marcar("b");
    expect(contador()).toBe("1");
  });

  it("nunca fica negativo", () => {
    renderizar(
      <NotificacoesLidasProvider versao="v1">
        <Contador doServidor={1} chaves={["a", "b"]} />
      </NotificacoesLidasProvider>,
    );
    marcar("a");
    marcar("b");
    expect(contador()).toBe("0");
  });

  const telaVersao = (n: number, versao: string) => (
    <NotificacoesLidasProvider versao={versao}>
      <Contador doServidor={n} chaves={["a"]} />
    </NotificacoesLidasProvider>
  );

  it("volta a usar o valor do servidor quando o layout é renderizado de novo", () => {
    renderizar(telaVersao(3, "v1"));
    marcar("a");
    expect(contador()).toBe("2");
    // Resposta de uma action com `refresh()`: o layout já conta a leitura.
    renderizar(telaVersao(2, "v2"));
    expect(contador()).toBe("2");
  });

  it("zera o desconto com versão nova mesmo se o total do servidor não mudou", () => {
    // Abriu "a" (3 → 2 no cliente), mas outra notificação virou elegível, ou a action falhou: o
    // servidor devolve 3 de novo. Vale o servidor.
    renderizar(telaVersao(3, "v1"));
    marcar("a");
    expect(contador()).toBe("2");
    renderizar(telaVersao(3, "v2"));
    expect(contador()).toBe("3");
  });

  it("mantém o desconto enquanto o layout não muda (navegação)", () => {
    renderizar(telaVersao(3, "v1"));
    marcar("a");
    renderizar(telaVersao(3, "v1"));
    expect(contador()).toBe("2");
  });

  it("sem provider, o contador é o do servidor", () => {
    renderizar(<Contador doServidor={4} />);
    expect(contador()).toBe("4");
  });
});

const item = (chave: string, lida: boolean): ItemNotificacao => ({
  chave,
  eventoId: 10,
  mensagem: `Aviso ${chave}`,
  data: "2026-11-17",
  hora: null,
  dias: 1,
  lida,
  concurso: { id: 1, orgao: "TRF", cargo: "Analista", cor: "AZUL", icone: null },
});

describe("ListaNotificacoes: abrir uma notificação (#124)", () => {
  const tela = (itens: ItemNotificacao[], versao = "v1") => (
    <NotificacoesLidasProvider versao={versao}>
      <Contador doServidor={2} />
      <ListaNotificacoes itens={itens} />
    </NotificacoesLidasProvider>
  );
  const linha = (chave: string) =>
    [...container.querySelectorAll("li")].find((li) => li.textContent?.includes(`Aviso ${chave}`));

  it("marca como lida sem refresh e desconta no cliente", () => {
    renderizar(tela([item("evento-10:1", false), item("evento-11:1", false)]));
    act(() => linha("evento-10:1")?.querySelector("a")?.click());

    expect(acoes.abrirNotificacaoAcao).toHaveBeenCalledExactlyOnceWith("evento-10:1");
    expect(acoes.marcarNotificacaoLidaAcao).not.toHaveBeenCalled();
    expect(linha("evento-10:1")?.dataset.lida).toBe("true");
    expect(linha("evento-11:1")?.dataset.lida).toBeUndefined();
    expect(contador()).toBe("1");
  });

  it("falha da action não quebra a tela; o próximo layout do servidor desfaz o desconto", async () => {
    // A rejeição precisa ser tratada no clique (sem "unhandled rejection").
    const falhou = Promise.reject(new Error("rede"));
    const tratar = vi.spyOn(falhou, "catch");
    acoes.abrirNotificacaoAcao.mockReturnValueOnce(falhou);
    const itens = [item("evento-10:1", false), item("evento-11:1", false)];
    renderizar(tela(itens));
    act(() => linha("evento-10:1")?.querySelector("a")?.click());
    expect(tratar).toHaveBeenCalledOnce();
    await act(() => falhou.catch(() => {}));
    expect(contador()).toBe("1");
    // Refresh seguinte: o servidor ainda conta a notificação como não lida.
    renderizar(tela(itens, "v2"));
    expect(contador()).toBe("2");
    expect(linha("evento-10:1")?.dataset.lida).toBeUndefined();
  });

  it("notificação já lida não chama a action nem desconta de novo", () => {
    renderizar(tela([item("evento-10:1", true), item("evento-11:1", false)]));
    act(() => linha("evento-10:1")?.querySelector("a")?.click());
    expect(acoes.abrirNotificacaoAcao).not.toHaveBeenCalled();
    expect(contador()).toBe("2");
  });

  it("o link da notificação só pré-carrega por intenção", () => {
    renderizar(tela([item("evento-10:1", false)]));
    expect(linha("evento-10:1")?.querySelector("a")?.dataset.prefetch).toBe("false");
  });
});
