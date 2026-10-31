import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErroDominio } from "@/domain/erros";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import {
  type EventoDados,
  type EventoFormValores,
  eventoSchema,
  VALORES_INICIAIS_EVENTO,
} from "@/lib/schemas/evento";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { listarEventos } from "../queries/eventos";
import { criarConcurso, excluirConcurso } from "./concursos";
import { atualizarEvento, criarEvento, definirConcluido, excluirEvento } from "./eventos";

let db: Db;
let client: Client;
let concursoId: number;

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
  concursoId = await criarConcurso(
    db,
    concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "X", cargo: "Y" }),
  );
});

afterEach(() => client.close());

const dados = (parcial: Partial<EventoFormValores>): EventoDados =>
  eventoSchema.parse({ ...VALORES_INICIAIS_EVENTO, data: "2026-11-10", ...parcial });

const T1 = new Date("2026-11-01T12:00:00Z");
const T2 = new Date("2026-11-02T12:00:00Z");

describe("eventos", () => {
  it("lista por data, sem hora primeiro, depois hora", async () => {
    await criarEvento(db, concursoId, dados({ data: "2026-12-01", tipo: "PROVA_OBJETIVA" }));
    await criarEvento(db, concursoId, dados({ data: "2026-11-10", hora: "14:00" }));
    await criarEvento(db, concursoId, dados({ data: "2026-11-10", hora: "08:30" }));
    await criarEvento(db, concursoId, dados({ data: "2026-11-10" }));
    const eventos = await listarEventos(db, concursoId);
    expect(eventos.map((e) => [e.data, e.hora])).toEqual([
      ["2026-11-10", null],
      ["2026-11-10", "08:30"],
      ["2026-11-10", "14:00"],
      ["2026-12-01", null],
    ]);
  });

  it("grava todos os campos e concluido_em ao criar já concluído", async () => {
    const id = await criarEvento(
      db,
      concursoId,
      dados({
        tipo: "PROVA_OBJETIVA",
        titulo: "Prova",
        hora: "13:00",
        local: "Escola X",
        observacao: "Levar caneta preta",
        concluido: true,
      }),
      T1,
    );
    expect((await listarEventos(db, concursoId))[0]).toMatchObject({
      id,
      tipo: "PROVA_OBJETIVA",
      titulo: "Prova",
      data: "2026-11-10",
      hora: "13:00",
      local: "Escola X",
      observacao: "Levar caneta preta",
      concluido: true,
      concluidoEm: T1,
    });
  });

  it("rejeita evento de concurso inexistente", async () => {
    await expect(criarEvento(db, 999, dados({}))).rejects.toThrow(ErroDominio);
  });

  it("atualiza preservando concluido_em se a conclusão não muda", async () => {
    const id = await criarEvento(db, concursoId, dados({ concluido: true }), T1);
    await atualizarEvento(db, concursoId, id, dados({ concluido: true, local: "Sala 2" }), T2);
    let [e] = await listarEventos(db, concursoId);
    expect(e).toMatchObject({ local: "Sala 2", concluido: true, concluidoEm: T1 });

    await atualizarEvento(db, concursoId, id, dados({ concluido: false }), T2);
    [e] = await listarEventos(db, concursoId);
    expect(e).toMatchObject({ concluido: false, concluidoEm: null, local: null });

    await atualizarEvento(db, concursoId, id, dados({ concluido: true }), T2);
    [e] = await listarEventos(db, concursoId);
    expect(e).toMatchObject({ concluido: true, concluidoEm: T2 });
  });

  it("marca e desmarca concluído", async () => {
    const id = await criarEvento(db, concursoId, dados({}));
    await definirConcluido(db, concursoId, id, true, T1);
    expect((await listarEventos(db, concursoId))[0]).toMatchObject({
      concluido: true,
      concluidoEm: T1,
    });
    await definirConcluido(db, concursoId, id, false, T2);
    expect((await listarEventos(db, concursoId))[0]).toMatchObject({
      concluido: false,
      concluidoEm: null,
    });
  });

  it("restringe atualização, conclusão e exclusão ao concurso", async () => {
    const id = await criarEvento(db, concursoId, dados({}));
    await expect(atualizarEvento(db, 999, id, dados({}))).rejects.toThrow("Evento não encontrado.");
    await expect(definirConcluido(db, 999, id, true)).rejects.toThrow("Evento não encontrado.");
    await expect(excluirEvento(db, 999, id)).rejects.toThrow("Evento não encontrado.");
    await excluirEvento(db, concursoId, id);
    expect(await listarEventos(db, concursoId)).toEqual([]);
  });

  it("exclui os eventos junto com o concurso", async () => {
    await criarEvento(db, concursoId, dados({}));
    await excluirConcurso(db, concursoId);
    expect(await listarEventos(db, concursoId)).toEqual([]);
  });
});

describe("eventoSchema", () => {
  it("normaliza opcionais vazios para null", () => {
    expect(dados({ titulo: " ", hora: "", local: "", observacao: "" })).toEqual({
      tipo: "INICIO_INSCRICOES",
      titulo: null,
      data: "2026-11-10",
      hora: null,
      local: null,
      observacao: null,
      concluido: false,
    });
  });

  it.each(["", "2026-02-30", "10/11/2026", "2026-1-1"])("rejeita data %j", (data) => {
    const r = eventoSchema.safeParse({ ...VALORES_INICIAIS_EVENTO, data });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["data"]);
  });

  it.each(["24:00", "7:00", "12:60", "meio-dia"])("rejeita hora %j", (hora) => {
    const r = eventoSchema.safeParse({ ...VALORES_INICIAIS_EVENTO, data: "2026-11-10", hora });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["hora"]);
  });

  it("aceita hora válida e rejeita tipo inválido", () => {
    expect(dados({ hora: "23:59" }).hora).toBe("23:59");
    expect(
      eventoSchema.safeParse({ ...VALORES_INICIAIS_EVENTO, data: "2026-11-10", tipo: "X" }).success,
    ).toBe(false);
  });
});
