import type { Client as LibsqlClient } from "@libsql/client";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { ID_USUARIO_INICIAL } from "../db/schema";
import { configurarLog } from "../log";
import { listarEventos } from "../queries/eventos";
import { criarServidorMcp, textoDosErros } from "./servidor";

let db: Db;
let banco: LibsqlClient;
let cliente: Client;
let aoAlterar: ReturnType<typeof vi.fn<() => void>>;

beforeEach(async () => {
  ({ db, client: banco } = await criarBancoTeste());
  aoAlterar = vi.fn<() => void>();
  const servidor = criarServidorMcp({ db, usuarioId: ID_USUARIO_INICIAL, aoAlterar });
  const [ladoCliente, ladoServidor] = InMemoryTransport.createLinkedPair();
  await servidor.connect(ladoServidor);
  cliente = new Client({ name: "teste", version: "0.0.0" });
  await cliente.connect(ladoCliente);
});

afterEach(async () => {
  await cliente.close();
  banco.close();
});

type Texto = { type: "text"; text: string };

async function chamar(name: string, args: Record<string, unknown>) {
  const r = await cliente.callTool({ name, arguments: args });
  const texto = (r.content as Texto[]).map((c) => c.text).join("\n");
  return { erro: r.isError === true, texto };
}

const json = async (name: string, args: Record<string, unknown>) => {
  const r = await chamar(name, args);
  expect(r.erro, r.texto).toBe(false);
  return JSON.parse(r.texto);
};

const EDITAL = {
  concurso: {
    orgao: "Tribunal Regional Federal da 3ª Região",
    cargo: "Analista Judiciário – Área Judiciária",
    banca: "FCC",
    esfera: "FEDERAL",
    uf: "SP",
    escolaridade: "SUPERIOR",
    remuneracao: 13994.78,
    taxaInscricao: 85,
    vagasAmpla: 5,
    vagasCotas: 2,
    possuiCadastroReserva: true,
    tags: ["Tribunais"],
  },
  eventos: [
    { tipo: "INICIO_INSCRICOES", data: "2026-11-10", hora: "10:00" },
    { tipo: "FIM_INSCRICOES", data: "2026-12-08", hora: "14:00" },
    { tipo: "PROVA_OBJETIVA", data: "2027-02-14", hora: "08:00", local: "São Paulo" },
  ],
  links: [{ tipo: "EDITAL_ABERTURA", url: "https://www.example.com/edital.pdf" }],
};

describe("servidor MCP", () => {
  it("anuncia as ferramentas, sem nenhuma de exclusão", async () => {
    const { tools } = await cliente.listTools();
    const nomes = tools.map((t) => t.name).sort();
    expect(nomes).toEqual([
      "alterar_status",
      "atualizar_concurso",
      "cadastrar_concurso",
      "listar_concursos",
      "obter_concurso",
      "proximos_prazos",
      "registrar_resultado",
      "salvar_eventos",
      "salvar_links",
      "verificar_duplicado",
    ]);
    expect(nomes.filter((n) => /exclu|remov|apag|delet/.test(n))).toEqual([]);
    for (const t of tools) expect(t.annotations?.destructiveHint).toBe(false);
  });

  it("cadastra concurso + eventos + links de uma vez e avisa a alteração", async () => {
    const simulado = await json("cadastrar_concurso", { ...EDITAL, simular: true });
    expect(simulado).toMatchObject({ simulacao: true, possiveisDuplicados: [] });
    expect(aoAlterar).not.toHaveBeenCalled();

    const criado = await json("cadastrar_concurso", EDITAL);
    expect(criado).toMatchObject({ simulacao: false, eventos: 3, links: 1 });
    expect(aoAlterar).toHaveBeenCalledOnce();

    const ficha = await json("obter_concurso", { id: criado.id });
    expect(ficha).toMatchObject({
      status: "EDITAL_PUBLICADO",
      remuneracao: 13994.78,
      tags: ["tribunais"],
      links: [{ tipo: "EDITAL_ABERTURA" }],
    });
    expect(ficha.eventos).toHaveLength(3);
    expect(ficha.transicoesPermitidas).toContain("INSCRITO");
  });

  it("recusa duplicado e devolve erros de validação legíveis, sem gravar", async () => {
    await json("cadastrar_concurso", EDITAL);
    const dup = await chamar("cadastrar_concurso", EDITAL);
    expect(dup.erro).toBe(true);
    expect(dup.texto).toMatch(/Já existe concurso parecido: #1/);

    const invalido = await chamar("cadastrar_concurso", {
      concurso: { ...EDITAL.concurso, cargo: "Técnico", uf: "SP" },
      eventos: [{ tipo: "PROVA_OBJETIVA", data: "2027-02-30" }],
      links: [{ tipo: "OUTRO", url: "ftp://x" }],
    });
    expect(invalido.erro).toBe(true);
    expect(invalido.texto).toContain("Nada foi gravado.");
    expect(invalido.texto).toContain("- eventos[0].data: Data inválida.");
    expect(invalido.texto).toContain("- links[0].url:");
    expect(await listarEventos(db, 2)).toEqual([]);
  });

  it("aplica retificação: altera evento existente e cria o link, sem duplicar", async () => {
    const { id } = await json("cadastrar_concurso", EDITAL);
    const ficha = await json("obter_concurso", { id });
    const prova = ficha.eventos.find((e: { tipo: string }) => e.tipo === "PROVA_OBJETIVA");

    await json("salvar_eventos", {
      concursoId: id,
      eventos: [{ id: prova.id, data: "2027-03-07", observacao: "Retificação nº 1" }],
    });
    await json("salvar_links", {
      concursoId: id,
      links: [{ tipo: "RETIFICACAO", rotulo: "Retificação nº 1", url: "https://example.com/r1" }],
    });

    const depois = await json("obter_concurso", { id });
    expect(depois.eventos).toHaveLength(3);
    expect(depois.eventos.at(-1)).toMatchObject({
      id: prova.id,
      data: "2027-03-07",
      hora: "08:00",
      local: "São Paulo",
      observacao: "Retificação nº 1",
    });
    expect(depois.links.map((l: { tipo: string }) => l.tipo)).toEqual([
      "EDITAL_ABERTURA",
      "RETIFICACAO",
    ]);
  });

  it("muda o status com histórico e informa as transições quando recusa", async () => {
    const { id } = await json("cadastrar_concurso", EDITAL);
    await json("alterar_status", { id, para: "INSCRITO", observacao: "Boleto pago" });
    const ficha = await json("obter_concurso", { id });
    expect(ficha.historico.at(-1)).toMatchObject({
      de: "EDITAL_PUBLICADO",
      para: "INSCRITO",
      observacao: "Boleto pago",
    });

    const recusa = await chamar("alterar_status", { id, para: "EMPOSSADO" });
    expect(recusa.erro).toBe(true);
    expect(recusa.texto).toMatch(/Status atual: INSCRITO\. Permitidos: .*PROVA_AGENDADA/);
  });

  it("lista, consulta prazos, registra resultado e atualiza campos", async () => {
    const { id } = await json("cadastrar_concurso", EDITAL);
    expect(await json("listar_concursos", { busca: "analista trf" })).toEqual([]);
    expect(await json("listar_concursos", { busca: "analista judiciaria" })).toHaveLength(1);
    expect(await json("verificar_duplicado", EDITAL.concurso)).toHaveLength(1);
    expect(await json("proximos_prazos", { janelaDias: 365 })).toHaveProperty("proximos");

    const r = await json("registrar_resultado", {
      concursoId: id,
      fase: "OBJETIVA",
      nota: 72.5,
      notaMaxima: 100,
      situacao: "APROVADO",
    });
    await json("registrar_resultado", { concursoId: id, id: r.id, classificacaoGeral: 12 });
    await json("atualizar_concurso", { id, campos: { taxaInscricao: null, vagasAmpla: 6 } });

    const ficha = await json("obter_concurso", { id });
    expect(ficha).toMatchObject({ taxaInscricao: null, vagasAmpla: 6, remuneracao: 13994.78 });
    expect(ficha.resultados).toEqual([
      expect.objectContaining({ fase: "OBJETIVA", nota: 72.5, classificacaoGeral: 12 }),
    ]);
  });

  it("expõe a referência, a ficha como recurso e os prompts", async () => {
    const { id } = await json("cadastrar_concurso", EDITAL);
    const ref = await cliente.readResource({ uri: "concurso://referencia" });
    expect((ref.contents[0] as { text: string }).text).toContain("`PROVA_OBJETIVA`");

    const { resources } = await cliente.listResources();
    expect(resources.map((r) => r.uri)).toContain(`concurso://concursos/${id}`);
    const ficha = await cliente.readResource({ uri: `concurso://concursos/${id}` });
    expect(JSON.parse((ficha.contents[0] as { text: string }).text)).toMatchObject({ id });

    const { prompts } = await cliente.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual(["aplicar_retificacao", "cadastrar_edital"]);
    const guia = await cliente.getPrompt({
      name: "cadastrar_edital",
      arguments: { cargo: "Analista" },
    });
    expect(guia.messages[0]?.content).toMatchObject({
      type: "text",
      text: expect.stringContaining('cargo: "Analista"'),
    });
  });
});

describe("log das ferramentas (#91)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    configurarLog({});
  });

  it("registra nome, usuário, resultado e duração, sem os argumentos", async () => {
    configurarLog({ nivel: "info", formato: "json" });
    const saida = vi.spyOn(console, "log").mockImplementation(() => {});
    await chamar("listar_concursos", { busca: "segredo-do-usuario" });
    await chamar("obter_concurso", { id: 999 });
    const linhas = saida.mock.calls.map((c) => JSON.parse(String(c[0])));
    expect(linhas).toEqual([
      expect.objectContaining({
        evento: "mcp.ferramenta",
        ferramenta: "listar_concursos",
        usuarioId: ID_USUARIO_INICIAL,
        ok: true,
        duracaoMs: expect.any(Number),
      }),
      expect.objectContaining({ ferramenta: "obter_concurso", ok: false }),
    ]);
    expect(JSON.stringify(linhas)).not.toContain("segredo-do-usuario");
  });

  it("com saída em stderr (MCP stdio), nada vai para o stdout", async () => {
    configurarLog({ nivel: "debug", saida: "stderr" });
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    await chamar("listar_concursos", {});
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalled();
  });
});

describe("textoDosErros", () => {
  it("lista campos e erros gerais", () => {
    expect(textoDosErros({ _form: ["Geral."], "eventos[0].data": ["Data inválida."] })).toBe(
      "Nada foi gravado.\n- Geral.\n- eventos[0].data: Data inválida.",
    );
  });
});
