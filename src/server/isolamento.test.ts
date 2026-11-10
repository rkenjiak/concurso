/**
 * Isolamento entre usuários (#49): um usuário não lê nem altera dados de outro por nenhuma das
 * leituras, escritas ou operações do MCP — nem conhecendo os IDs.
 */
import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErroDominio } from "@/domain/erros";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import { eventoSchema, VALORES_INICIAIS_EVENTO } from "@/lib/schemas/evento";
import { linkSchema } from "@/lib/schemas/link";
import { resultadoFaseSchema, VALORES_INICIAIS_RESULTADO_FASE } from "@/lib/schemas/resultado-fase";
import { criarBancoTeste, criarUsuarioTeste } from "./db/banco-teste";
import type { Db } from "./db/client";
import { ID_USUARIO_INICIAL } from "./db/schema";
import * as op from "./mcp/operacoes";
import { obterCalendario, obterCalendarioCompleto } from "./queries/calendario";
import { listarConcursos, obterConcurso } from "./queries/concursos";
import { contarPorStatus, obterDashboard } from "./queries/dashboard";
import { listarEventos } from "./queries/eventos";
import { exportarConcursosCsv, exportarDados } from "./queries/exportacao";
import { listarLinks } from "./queries/links";
import { listarTags } from "./queries/tags";
import * as concursos from "./repositories/concursos";
import { definirPrazoOculto } from "./repositories/dashboard";
import * as eventos from "./repositories/eventos";
import { criarFeedback, listarFeedbacks } from "./repositories/feedback";
import * as links from "./repositories/links";
import * as resultados from "./repositories/resultados";
import * as status from "./repositories/status";

let db: Db;
let client: Client;
const ANA = ID_USUARIO_INICIAL;
let bia: number;
let alvo: { concursoId: number; eventoId: number; linkId: number; resultadoId: number };

const HOJE = "2026-11-01";
const evento = (data = "2026-11-05") =>
  eventoSchema.parse({ ...VALORES_INICIAIS_EVENTO, tipo: "PROVA_OBJETIVA", data });
const link = linkSchema.parse({ tipo: "EDITAL_ABERTURA", rotulo: "", url: "https://ex.com/e" });
const resultado = resultadoFaseSchema.parse({ ...VALORES_INICIAIS_RESULTADO_FASE, nota: "80" });

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
  bia = await criarUsuarioTeste(db, "bia@exemplo.com");
  const concursoId = await concursos.criarConcurso(
    db,
    ANA,
    concursoSchema.parse({
      ...VALORES_INICIAIS_CONCURSO,
      orgao: "Tribunal da Ana",
      cargo: "Analista",
      status: "INSCRITO",
      tags: ["segredo-da-ana", "comum"],
    }),
  );
  alvo = {
    concursoId,
    eventoId: await eventos.criarEvento(db, ANA, concursoId, evento()),
    linkId: await links.criarLink(db, ANA, concursoId, link),
    resultadoId: await resultados.criarResultadoFase(db, ANA, concursoId, resultado),
  };
  await concursos.criarConcurso(
    db,
    bia,
    concursoSchema.parse({
      ...VALORES_INICIAIS_CONCURSO,
      orgao: "Prefeitura da Bia",
      cargo: "Técnico",
      tags: ["comum"],
    }),
  );
});

afterEach(() => client.close());

describe("leituras", () => {
  it("cada usuário só vê os próprios concursos, tags, prazos e exportação", async () => {
    expect((await listarConcursos(db, bia)).map((c) => c.orgao)).toEqual(["Prefeitura da Bia"]);
    expect((await listarConcursos(db, ANA)).map((c) => c.orgao)).toEqual(["Tribunal da Ana"]);
    expect(await listarConcursos(db, bia, { busca: "tribunal" })).toEqual([]);
    expect(await obterConcurso(db, bia, alvo.concursoId)).toBeNull();
    expect(await listarTags(db, bia)).toEqual(["comum"]);
    expect(await listarTags(db, ANA)).toEqual(["comum", "segredo-da-ana"]);
    expect(await contarPorStatus(db, bia)).toEqual([{ status: "PREVISTO", quantidade: 1 }]);

    const painel = await obterDashboard(db, bia, HOJE);
    expect(painel.totalConcursos).toBe(1);
    expect(painel.totalPrazos).toBe(0);
    expect((await obterDashboard(db, ANA, HOJE)).totalPrazos).toBe(1);
    expect(await obterCalendario(db, bia, "2026-11", HOJE)).toEqual([]);
    expect(await obterCalendario(db, ANA, "2026-11", HOJE)).toHaveLength(1);
    const calendarioBia = await obterCalendarioCompleto(db, bia, HOJE);
    expect(calendarioBia.itens).toEqual([]);
    expect(calendarioBia.concursos.map((c) => c.orgao)).toEqual(["Prefeitura da Bia"]);
    expect((await obterCalendarioCompleto(db, ANA, HOJE)).itens.length).toBeGreaterThan(0);

    const backup = await exportarDados(db, bia);
    expect(backup.dados.concursos.map((c) => c.orgao)).toEqual(["Prefeitura da Bia"]);
    expect(backup.dados.tags.map((t) => t.nome)).toEqual(["comum"]);
    expect(backup.dados.eventos).toEqual([]);
    expect(backup.dados.links).toEqual([]);
    expect(backup.dados.resultadosFase).toEqual([]);
    expect(backup.dados.statusHistorico).toHaveLength(1);
    expect(backup.dados.concursos[0]).not.toHaveProperty("usuarioId");
    expect(await exportarConcursosCsv(db, bia)).not.toContain("Ana");
  });

  it("feedback (#117) não aparece em nenhuma leitura do usuário, nem para quem enviou", async () => {
    const segredo = "Feedback confidencial da Bia sobre o app";
    await criarFeedback(
      db,
      { id: bia, email: "bia@exemplo.com", nome: null },
      { tipo: "BUG", mensagem: segredo, pagina: "/" },
      { versaoApp: "2.7.0", commitApp: "dev", userAgent: null },
    );
    for (const dono of [bia, ANA]) {
      expect(JSON.stringify(await exportarDados(db, dono))).not.toContain(segredo);
      expect(await exportarConcursosCsv(db, dono)).not.toContain(segredo);
      expect(JSON.stringify(await obterDashboard(db, dono, HOJE))).not.toContain(segredo);
      expect(JSON.stringify(await op.listar(db, dono))).not.toContain(segredo);
    }
    // Só a caixa de entrada do painel (que exige o papel ADMIN, ver actions/feedback.test.ts) lê.
    expect((await listarFeedbacks(db)).itens.map((f) => f.mensagem)).toEqual([segredo]);
  });
});

describe("escritas", () => {
  const recusa = async (promessa: Promise<unknown>) => {
    await expect(promessa).rejects.toThrow(ErroDominio);
  };

  it("nenhuma escrita alcança o concurso de outro usuário", async () => {
    const { concursoId, eventoId, linkId, resultadoId } = alvo;
    const edicao = concursoSchema.parse({
      ...VALORES_INICIAIS_CONCURSO,
      orgao: "Hack",
      cargo: "X",
    });
    expect(await concursos.atualizarConcurso(db, bia, concursoId, edicao)).toBe(false);
    expect(await concursos.excluirConcurso(db, bia, concursoId)).toBe(false);

    await recusa(eventos.criarEvento(db, bia, concursoId, evento()));
    await recusa(eventos.atualizarEvento(db, bia, concursoId, eventoId, evento("2030-01-01")));
    await recusa(eventos.salvarEventos(db, bia, concursoId, [{ id: null, dados: evento() }]));
    await recusa(eventos.definirConcluido(db, bia, concursoId, eventoId, true));
    await recusa(eventos.excluirEvento(db, bia, concursoId, eventoId));

    await recusa(links.criarLink(db, bia, concursoId, link));
    await recusa(links.atualizarLink(db, bia, concursoId, linkId, link));
    await recusa(links.salvarLinks(db, bia, concursoId, [{ id: null, dados: link }]));
    await recusa(links.excluirLink(db, bia, concursoId, linkId));
    await recusa(links.reordenarLinks(db, bia, concursoId, [linkId]));

    await recusa(resultados.criarResultadoFase(db, bia, concursoId, resultado));
    await recusa(resultados.atualizarResultadoFase(db, bia, concursoId, resultadoId, resultado));
    await recusa(resultados.excluirResultadoFase(db, bia, concursoId, resultadoId));

    await recusa(status.alterarStatus(db, bia, concursoId, "PROVA_AGENDADA"));
    await recusa(status.desfazerUltimoStatus(db, bia, concursoId));

    await recusa(definirPrazoOculto(db, bia, { tipo: "evento", eventoId }, true));
    await recusa(definirPrazoOculto(db, bia, { tipo: "validade", concursoId }, true));

    // Nada mudou para a dona.
    const c = await obterConcurso(db, ANA, concursoId);
    expect(c).toMatchObject({ orgao: "Tribunal da Ana", status: "INSCRITO" });
    expect(await listarEventos(db, concursoId)).toMatchObject([
      { id: eventoId, data: "2026-11-05", concluido: false, ocultoDashboard: false },
    ]);
    expect(await listarLinks(db, concursoId)).toHaveLength(1);
  });
});

describe("MCP", () => {
  it("as operações usam só os dados do usuário do token", async () => {
    expect((await op.listar(db, bia)).map((c) => c.orgao)).toEqual(["Prefeitura da Bia"]);
    expect(await op.obterFicha(db, bia, alvo.concursoId)).toBeNull();
    expect((await op.proximosPrazos(db, bia, 30, HOJE)).proximos).toEqual([]);
    expect(
      await op.verificarDuplicados(db, bia, { orgao: "Tribunal da Ana", cargo: "Analista" }),
    ).toEqual([]);
    for (const r of [
      await op.atualizar(db, bia, alvo.concursoId, { orgao: "Hack" }),
      await op.alterarStatus(db, bia, alvo.concursoId, { para: "PROVA_AGENDADA" }),
      await op.salvarEventos(db, bia, alvo.concursoId, [{ tipo: "OUTRO", data: "2030-01-01" }]),
      await op.salvarLinks(db, bia, alvo.concursoId, [{ tipo: "OUTRO", url: "https://x.com" }]),
      await op.registrarResultado(db, bia, alvo.concursoId, { fase: "OBJETIVA" }),
    ]) {
      expect(r.ok).toBe(false);
    }
    // Cadastrar um concurso igual ao da Ana não acusa duplicado para a Bia.
    const r = await op.cadastrar(db, bia, {
      concurso: { orgao: "Tribunal da Ana", cargo: "Analista" },
    });
    expect(r.ok).toBe(true);
    expect((await op.listar(db, ANA)).map((c) => c.orgao)).toEqual(["Tribunal da Ana"]);
  });
});
