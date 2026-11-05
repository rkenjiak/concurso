import { notFound, redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registrarErroRequisicao } from "./erro-requisicao";
import { configurarLog } from "./log";

afterEach(() => {
  vi.restoreAllMocks();
  configurarLog({});
});

const contexto = {
  routePath: "/(app)/concursos/[id]",
  routeType: "render",
  renderSource: "react-server-components",
};

function capturar() {
  configurarLog({ nivel: "debug", formato: "json" });
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

function lancado(fn: () => never): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error("esperava exceção");
}

describe("registrarErroRequisicao", () => {
  it("registra rota, método, tipo e digest, sem headers nem token na URL", () => {
    const saida = capturar();
    const erro = Object.assign(new Error("falhou"), { digest: "999" });
    const requisicao = {
      path: "/api/calendario.ics?token=ics-sentinela",
      method: "GET",
      headers: { cookie: "cookie-sentinela" },
    };
    registrarErroRequisicao(erro, requisicao, contexto);
    expect(saida).toHaveBeenCalledOnce();
    const texto = String(saida.mock.calls[0]?.[0]);
    expect(JSON.parse(texto)).toMatchObject({
      nivel: "error",
      evento: "requisicao.erro",
      metodo: "GET",
      caminho: "/api/calendario.ics",
      parametros: ["token"],
      rota: "/(app)/concursos/[id]",
      tipo: "render",
      origem: "react-server-components",
      digest: "999",
      erro: { mensagem: "falhou" },
    });
    expect(texto).not.toMatch(/sentinela/);
  });

  it("ignora redirect e notFound", () => {
    const saida = capturar();
    const req = { path: "/", method: "GET" };
    registrarErroRequisicao(
      lancado(() => redirect("/login")),
      req,
      contexto,
    );
    registrarErroRequisicao(
      lancado(() => notFound()),
      req,
      contexto,
    );
    expect(saida).not.toHaveBeenCalled();
  });

  it("registra o mesmo objeto de erro uma vez por janela de 2 s", () => {
    const saida = capturar();
    const erro = new Error("repetido");
    const req = { path: "/", method: "GET" };
    registrarErroRequisicao(erro, req, contexto, 0);
    registrarErroRequisicao(erro, req, contexto, 500);
    registrarErroRequisicao(new Error("repetido"), req, contexto, 500);
    expect(saida).toHaveBeenCalledTimes(2);
    // Relançado numa requisição posterior: volta a aparecer.
    registrarErroRequisicao(erro, req, contexto, 5_000);
    expect(saida).toHaveBeenCalledTimes(3);
  });

  it("não registra valores da query, só os nomes dos parâmetros", () => {
    const saida = capturar();
    registrarErroRequisicao(
      new Error("x"),
      {
        path: "/concursos?password=senha-sentinela&email=fulano@sentinela.com&aba=links&aba=x",
        method: "GET",
      },
      contexto,
    );
    const texto = String(saida.mock.calls[0]?.[0]);
    expect(JSON.parse(texto)).toMatchObject({
      caminho: "/concursos",
      parametros: ["password", "email", "aba"],
    });
    expect(texto).not.toMatch(/sentinela/);
  });

  it("aceita valores que não são Error", () => {
    const saida = capturar();
    registrarErroRequisicao("texto", { path: "/", method: "POST" }, contexto);
    expect(JSON.parse(String(saida.mock.calls[0]?.[0])).erro).toBe("texto");
  });
});
