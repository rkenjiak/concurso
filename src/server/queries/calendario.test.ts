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
import { obterCalendario } from "./calendario";

let db: Db;
let client: Client;

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
});

afterEach(() => client.close());

const HOJE = "2026-10-31";

const novoConcurso = (orgao: string, status: Status, extra: Record<string, unknown> = {}) =>
  criarConcurso(
    db,
    concursoSchema.parse({
      ...VALORES_INICIAIS_CONCURSO,
      orgao,
      cargo: "Analista",
      status,
      ...extra,
    }),
  );

const novoEvento = (concursoId: number, parcial: Partial<EventoFormValores>) =>
  criarEvento(
    db,
    concursoId,
    eventoSchema.parse({ ...VALORES_INICIAIS_EVENTO, data: HOJE, ...parcial }),
  );

describe("obterCalendario", () => {
  it("banco vazio", async () => {
    expect(await obterCalendario(db, "2026-11", HOJE)).toEqual([]);
  });

  it("eventos do mês (inclusive concluídos e de encerrados) e validade calculada", async () => {
    const trf = await novoConcurso("TRF", "INSCRITO");
    const tj = await novoConcurso("TJ", "EMPOSSADO");
    // 2025-11-20 + 12 meses = 2026-11-20.
    const cr = await novoConcurso("CR", "CLASSIFICADO", {
      homologacaoData: "2025-11-20",
      validadeMeses: "12",
    });
    // Validade explícita fora do mês suprime o pseudo-evento.
    const explicita = await novoConcurso("Explícita", "APROVADO", {
      homologacaoData: "2025-11-10",
      validadeMeses: "12",
    });
    await novoEvento(explicita, { tipo: "VALIDADE", data: "2027-01-10" });
    await novoEvento(trf, { tipo: "PROVA_OBJETIVA", data: "2026-11-02", hora: "13:00" });
    await novoEvento(trf, { tipo: "FIM_INSCRICOES", data: "2026-11-01", concluido: true });
    await novoEvento(trf, { tipo: "OUTRO", data: "2026-10-30" });
    await novoEvento(trf, { tipo: "OUTRO", data: "2026-12-01" });
    await novoEvento(tj, { tipo: "POSSE", data: "2026-11-30" });

    const itens = await obterCalendario(db, "2026-11", HOJE);
    expect(
      itens.map((i) => [i.concurso.orgao, i.tipo, i.data, i.esmaecido, i.criticidade]),
    ).toEqual([
      ["TRF", "FIM_INSCRICOES", "2026-11-01", true, "NORMAL"],
      ["TRF", "PROVA_OBJETIVA", "2026-11-02", false, "ALTA"],
      ["CR", "VALIDADE", "2026-11-20", false, "NORMAL"],
      ["TJ", "POSSE", "2026-11-30", true, "NORMAL"],
    ]);
    expect(itens[1]?.evento).toMatchObject({ hora: "13:00", concursoId: trf });
    expect(itens[2]).toMatchObject({ derivado: true, concurso: { id: cr } });
  });
});
