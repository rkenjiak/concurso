import { afterEach, describe, expect, it, vi } from "vitest";
import { configurarLog, log, mascararEmail, semSegredosNaUrl } from "./log";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  configurarLog({});
});

function capturar() {
  const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
  const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
  const linhas = () => [...stdout.mock.calls, ...stderr.mock.calls].map((c) => String(c[0]));
  return { stdout, stderr, linhas };
}

describe("log", () => {
  it("em teste fica silencioso por padrão", () => {
    const { linhas } = capturar();
    log.error("x");
    expect(linhas()).toEqual([]);
  });

  it("filtra pelo nível mínimo de LOG_LEVEL", () => {
    vi.stubEnv("LOG_LEVEL", "warn");
    const { linhas } = capturar();
    log.debug("a");
    log.info("b");
    log.warn("c");
    log.error("d");
    expect(linhas().map((l) => l.split(/\s+/)[2])).toEqual(["c", "d"]);
  });

  it("ignora LOG_LEVEL inválido", () => {
    vi.stubEnv("LOG_LEVEL", "verboso");
    const { linhas } = capturar();
    log.error("x");
    expect(linhas()).toEqual([]);
  });

  it("em produção usa JSON e nível info", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { stdout, linhas } = capturar();
    log.debug("oculto");
    log.info("auth.login_ok", { usuarioId: 3, metodo: "senha" });
    expect(stdout).toHaveBeenCalledOnce();
    expect(JSON.parse(linhas()[0] ?? "")).toEqual({
      ts: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      nivel: "info",
      evento: "auth.login_ok",
      usuarioId: 3,
      metodo: "senha",
    });
  });

  it("LOG_FORMAT sobrepõe o padrão do ambiente", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_FORMAT", "texto");
    const { linhas } = capturar();
    log.info("evento.x", { a: 1 });
    expect(linhas()[0]).toMatch(/^\S+ INFO {2}evento\.x a=1$/);
  });

  it("warn e error vão para stderr; debug e info para stdout", () => {
    configurarLog({ nivel: "debug" });
    const { stdout, stderr } = capturar();
    log.debug("a");
    log.info("b");
    log.warn("c");
    log.error("d");
    expect(stdout).toHaveBeenCalledTimes(2);
    expect(stderr).toHaveBeenCalledTimes(2);
  });

  it("saída stderr manda tudo para o stderr", () => {
    configurarLog({ nivel: "debug", saida: "stderr" });
    const { stdout, stderr } = capturar();
    log.info("a");
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledOnce();
  });

  it("serializa erros com nome, mensagem, stack, digest e causa", () => {
    configurarLog({ nivel: "error", formato: "json" });
    const { linhas } = capturar();
    const erro = Object.assign(new TypeError("falhou", { cause: new Error("raiz") }), {
      digest: "123",
    });
    log.error("acao.erro", { erro });
    const r = JSON.parse(linhas()[0] ?? "");
    expect(r.erro).toMatchObject({
      nome: "TypeError",
      mensagem: "falhou",
      digest: "123",
      causa: { nome: "Error", mensagem: "raiz" },
    });
    expect(r.erro.stack).toContain("falhou");
  });

  it("em texto, imprime a stack nas linhas seguintes", () => {
    configurarLog({ nivel: "error", formato: "texto" });
    const { linhas } = capturar();
    log.error("acao.erro", { erro: new Error("boom") });
    const [linha] = linhas();
    expect(linha?.split("\n")[0]).toMatch(
      /ERROR acao\.erro erro=\{"nome":"Error","mensagem":"boom"\}$/,
    );
    expect(linha).toContain("Error: boom\n");
  });

  it("não quebra com referência circular", () => {
    configurarLog({ nivel: "info", formato: "json" });
    const { linhas } = capturar();
    const a: Record<string, unknown> = {};
    a.a = a;
    log.info("x", { a });
    expect(JSON.parse(linhas()[0] ?? "").evento).toBe("x");
  });
});

describe("privacidade", () => {
  const SENTINELAS = {
    senha: "s3nh4-sentinela",
    token: "tok-sentinela",
    cookie: "cookie-sentinela",
    url: "/api/calendario.ics?token=ics-sentinela&x=1",
    callback: "/api/auth/google/callback?code=code-sentinela&state=state-sentinela",
  };

  it("omite campos com nome de segredo e parâmetros sensíveis de URL", () => {
    configurarLog({ nivel: "debug", formato: "json" });
    const { linhas } = capturar();
    log.info("x", {
      senha: SENTINELAS.senha,
      tokenMcp: SENTINELAS.token,
      headers: { Cookie: SENTINELAS.cookie, Authorization: `Bearer ${SENTINELAS.token}` },
      caminho: SENTINELAS.url,
      callback: SENTINELAS.callback,
      erro: new Error(`falhou em ${SENTINELAS.url}`),
    });
    const saida = linhas().join("\n");
    expect(saida).not.toMatch(/sentinela/);
    expect(saida).toContain("x=1");
    expect(saida).toContain("[removido]");
  });

  it("omite os params de query anexados pelo Drizzle à mensagem de erro", () => {
    configurarLog({ nivel: "error", formato: "json" });
    const { linhas } = capturar();
    const erro = new Error(
      'Failed query: select "id" from "usuario" where "email" = ?\nparams: fulano@sentinela.com',
    );
    log.error("acao.erro", { erro });
    const r = JSON.parse(linhas()[0] ?? "");
    expect(r.erro.mensagem).toBe(
      'Failed query: select "id" from "usuario" where "email" = ?\nparams: [removido]',
    );
    expect(JSON.stringify(r)).not.toMatch(/sentinela/);
  });

  it("remove params do Drizzle com várias linhas, na mensagem e na stack", () => {
    configurarLog({ nivel: "error", formato: "json" });
    const { linhas } = capturar();
    const erro = new Error(
      'Failed query: insert into "evento" ("obs") values (?)\nparams: linha1\nobs-sentinela,x',
    );
    log.error("acao.erro", { erro });
    const r = JSON.parse(linhas()[0] ?? "");
    expect(r.erro.mensagem).toBe(
      'Failed query: insert into "evento" ("obs") values (?)\nparams: [removido]',
    );
    expect(r.erro.stack).toMatch(/params: \[removido\]\n\s+at /);
    expect(JSON.stringify(r)).not.toMatch(/sentinela/);
  });

  it("mascara e-mails em qualquer texto, inclusive mensagens de erro", () => {
    configurarLog({ nivel: "info", formato: "json" });
    const { linhas } = capturar();
    log.info("x", {
      motivo: "fulano.sentinela@example.com já existe",
      erro: new Error("conflito com ciclana-sentinela@ex.com.br"),
    });
    const saida = linhas().join("\n");
    expect(saida).not.toMatch(/sentinela/);
    expect(saida).toContain("f***@example.com já existe");
    expect(saida).toContain("c***@ex.com.br");
  });

  it("campos não sobrescrevem o cabeçalho da linha", () => {
    configurarLog({ nivel: "info", formato: "json" });
    const { linhas } = capturar();
    log.info("real", { evento: "falso", nivel: "error", ts: "x", a: 1 });
    expect(JSON.parse(linhas()[0] ?? "")).toMatchObject({ evento: "real", nivel: "info", a: 1 });
  });

  it("log.fatal sai mesmo com LOG_LEVEL=silent", () => {
    configurarLog({ nivel: "silent" });
    const { stderr } = capturar();
    log.error("comum");
    log.fatal("inicio.config_invalida", { mensagem: "O app não pode iniciar" });
    expect(stderr).toHaveBeenCalledOnce();
    expect(String(stderr.mock.calls[0]?.[0])).toContain("inicio.config_invalida");
  });

  it("semSegredosNaUrl remove valores de parâmetros sensíveis e mantém os demais", () => {
    expect(semSegredosNaUrl(SENTINELAS.url)).toBe("/api/calendario.ics?token=[removido]&x=1");
    expect(semSegredosNaUrl(SENTINELAS.callback)).toBe(
      "/api/auth/google/callback?code=[removido]&state=[removido]",
    );
    expect(
      semSegredosNaUrl("/x?password=a&senha=b&email=c&api_key=d&access_token=e&sessionId=f&mes=1"),
    ).toBe(
      "/x?password=[removido]&senha=[removido]&email=[removido]&api_key=[removido]" +
        "&access_token=[removido]&sessionId=[removido]&mes=1",
    );
    expect(semSegredosNaUrl("/concursos?aba=links&para=/x&concursos=1,2")).toBe(
      "/concursos?aba=links&para=/x&concursos=1,2",
    );
  });

  it("mascararEmail mantém só a inicial e o domínio", () => {
    expect(mascararEmail("rodrigo@gmail.com")).toBe("r***@gmail.com");
    expect(mascararEmail("sem-arroba")).toBe("***");
    expect(mascararEmail(null)).toBeUndefined();
  });
});
