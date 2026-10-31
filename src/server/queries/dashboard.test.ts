import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Status } from "@/domain/enums";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import {
  type EventoFormValores,
  eventoSchema,
  VALORES_INICIAIS_EVENTO,
} from "@/lib/schemas/evento";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { criarConcurso } from "../repositories/concursos";
import { criarEvento } from "../repositories/eventos";
import { listarConcursos } from "./concursos";
import { contarPorStatus, obterDashboard } from "./dashboard";

let db: Db;
let client: Client;

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
});

afterEach(() => client.close());

const HOJE = "2026-10-31";

const novoConcurso = (orgao: string, status: Status) =>
  criarConcurso(
    db,
    concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao, cargo: "Analista", status }),
  );

const novoEvento = (concursoId: number, parcial: Partial<EventoFormValores>) =>
  criarEvento(
    db,
    concursoId,
    eventoSchema.parse({ ...VALORES_INICIAIS_EVENTO, data: HOJE, ...parcial }),
  );

describe("obterDashboard", () => {
  it("banco vazio", async () => {
    expect(await obterDashboard(db, HOJE)).toEqual({
      prazos: { vencidos: [], hoje: [], proximos: [] },
      totalPrazos: 0,
      porStatus: [],
      totalConcursos: 0,
    });
  });

  it("agrupa prazos de concursos ativos com dados do concurso e do evento", async () => {
    const trf = await novoConcurso("TRF", "INSCRITO");
    const encerrado = await novoConcurso("TJ", "EMPOSSADO");
    await novoEvento(trf, { tipo: "VENCIMENTO_BOLETO", data: "2026-10-29" });
    await novoEvento(trf, { tipo: "PUBLICACAO_EDITAL", data: "2026-10-29" });
    await novoEvento(trf, { tipo: "PROVA_OBJETIVA", hora: "13:00", local: "Escola X" });
    await novoEvento(trf, { tipo: "FIM_INSCRICOES", data: "2026-11-05" });
    await novoEvento(trf, { tipo: "RESULTADO_FINAL", data: "2026-12-15" });
    await novoEvento(trf, { tipo: "PRAZO_RECURSO", data: "2026-11-02", concluido: true });
    await novoEvento(encerrado, { tipo: "POSSE", data: "2026-11-02" });

    const d = await obterDashboard(db, HOJE);
    expect(d.totalPrazos).toBe(3);
    expect(d.prazos.vencidos.map((p) => [p.tipo, p.dias, p.concurso.orgao])).toEqual([
      ["VENCIMENTO_BOLETO", -2, "TRF"],
    ]);
    expect(d.prazos.hoje[0]).toMatchObject({
      tipo: "PROVA_OBJETIVA",
      hora: "13:00",
      criticidade: "ALTA",
      evento: { local: "Escola X" },
      concurso: { id: trf, orgao: "TRF", cargo: "Analista", status: "INSCRITO" },
    });
    expect(d.prazos.proximos.map((p) => [p.tipo, p.dias, p.criticidade])).toEqual([
      ["FIM_INSCRICOES", 5, "MEDIA"],
    ]);
  });

  it("inclui o fim da validade calculado como pseudo-evento", async () => {
    const comValidade = (orgao: string, parcial: Record<string, unknown>) =>
      criarConcurso(
        db,
        concursoSchema.parse({
          ...VALORES_INICIAIS_CONCURSO,
          orgao,
          cargo: "Analista",
          status: "CLASSIFICADO",
          ...parcial,
        }),
      );
    // 2025-11-20 + 12 meses = 2026-11-20 (em 20 dias).
    const calc = await comValidade("Calculada", {
      homologacaoData: "2025-11-20",
      validadeMeses: "12",
    });
    // Prorrogada: 2024-11-10 + 12 + 12 = 2026-11-10.
    const prorrogada = await comValidade("Prorrogada", {
      homologacaoData: "2024-11-10",
      validadeMeses: "12",
      validadeProrrogada: true,
    });
    const manual = await comValidade("Manual", {
      homologacaoData: "2020-01-01",
      validadeMeses: "24",
      validadeFimManual: HOJE,
    });
    await comValidade("Fora da janela", { homologacaoData: "2026-10-01", validadeMeses: "24" });
    await comValidade("Sem homologação", { validadeMeses: "24" });
    const comEvento = await comValidade("Com evento", {
      homologacaoData: "2025-11-15",
      validadeMeses: "12",
    });
    await novoEvento(comEvento, { tipo: "VALIDADE", data: "2026-11-25" });

    const d = await obterDashboard(db, HOJE);
    expect(d.prazos.hoje.map((p) => [p.concurso.id, p.tipo, p.derivado])).toEqual([
      [manual, "VALIDADE", true],
    ]);
    expect(
      d.prazos.proximos.map((p) => [p.concurso.orgao, p.data, p.derivado, p.concurso.validadeFim]),
    ).toEqual([
      ["Prorrogada", "2026-11-10", true, "2026-11-10"],
      ["Calculada", "2026-11-20", true, "2026-11-20"],
      ["Com evento", "2026-11-25", false, "2026-11-15"],
    ]);
    expect(d.prazos.proximos.slice(0, 2).map((p) => p.concurso.id)).toEqual([prorrogada, calc]);
  });

  it("respeita a janela informada", async () => {
    const id = await novoConcurso("TRF", "INSCRITO");
    await novoEvento(id, { data: "2026-11-10" });
    expect((await obterDashboard(db, HOJE, 7)).totalPrazos).toBe(0);
    expect((await obterDashboard(db, HOJE, 10)).totalPrazos).toBe(1);
  });

  it("conta concursos por status na ordem do enum", async () => {
    await novoConcurso("A", "INSCRITO");
    await novoConcurso("B", "PREVISTO");
    await novoConcurso("C", "INSCRITO");
    await novoConcurso("D", "CANCELADO");
    expect(await contarPorStatus(db)).toEqual([
      { status: "PREVISTO", quantidade: 1 },
      { status: "INSCRITO", quantidade: 2 },
      { status: "CANCELADO", quantidade: 1 },
    ]);
    expect((await obterDashboard(db, HOJE)).totalConcursos).toBe(4);
  });
});

describe("listarConcursos com filtro de status", () => {
  it("filtra pelo status informado", async () => {
    await novoConcurso("A", "INSCRITO");
    await novoConcurso("B", "PREVISTO");
    expect((await listarConcursos(db, { status: ["PREVISTO"] })).map((c) => c.orgao)).toEqual([
      "B",
    ]);
    expect(await listarConcursos(db, { status: ["NOMEADO"] })).toEqual([]);
    expect(await listarConcursos(db, { status: [] })).toHaveLength(2);
  });
});
