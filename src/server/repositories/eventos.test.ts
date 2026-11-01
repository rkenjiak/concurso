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
import { ID_USUARIO_INICIAL as U } from "@/server/db/schema";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { listarEventos } from "../queries/eventos";
import { criarConcurso, excluirConcurso } from "./concursos";
import {
  atualizarEvento,
  criarEvento,
  definirConcluido,
  excluirEvento,
  salvarEventos,
} from "./eventos";

let db: Db;
let client: Client;
let concursoId: number;

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
  concursoId = await criarConcurso(
    db,
    U,
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
    await criarEvento(db, U, concursoId, dados({ data: "2026-12-01", tipo: "PROVA_OBJETIVA" }));
    await criarEvento(db, U, concursoId, dados({ data: "2026-11-10", hora: "14:00" }));
    await criarEvento(db, U, concursoId, dados({ data: "2026-11-10", hora: "08:30" }));
    await criarEvento(db, U, concursoId, dados({ data: "2026-11-10" }));
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
      U,
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
    await expect(criarEvento(db, U, 999, dados({}))).rejects.toThrow(ErroDominio);
  });

  it("atualiza preservando concluido_em se a conclusão não muda", async () => {
    const id = await criarEvento(db, U, concursoId, dados({ concluido: true }), T1);
    await atualizarEvento(db, U, concursoId, id, dados({ concluido: true, local: "Sala 2" }), T2);
    let [e] = await listarEventos(db, concursoId);
    expect(e).toMatchObject({ local: "Sala 2", concluido: true, concluidoEm: T1 });

    await atualizarEvento(db, U, concursoId, id, dados({ concluido: false }), T2);
    [e] = await listarEventos(db, concursoId);
    expect(e).toMatchObject({ concluido: false, concluidoEm: null, local: null });

    await atualizarEvento(db, U, concursoId, id, dados({ concluido: true }), T2);
    [e] = await listarEventos(db, concursoId);
    expect(e).toMatchObject({ concluido: true, concluidoEm: T2 });
  });

  it("marca e desmarca concluído", async () => {
    const id = await criarEvento(db, U, concursoId, dados({}));
    await definirConcluido(db, U, concursoId, id, true, T1);
    expect((await listarEventos(db, concursoId))[0]).toMatchObject({
      concluido: true,
      concluidoEm: T1,
    });
    await definirConcluido(db, U, concursoId, id, false, T2);
    expect((await listarEventos(db, concursoId))[0]).toMatchObject({
      concluido: false,
      concluidoEm: null,
    });
  });

  it("restringe atualização, conclusão e exclusão ao concurso", async () => {
    const outro = await criarConcurso(
      db,
      U,
      concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "Outro", cargo: "Z" }),
    );
    const id = await criarEvento(db, U, concursoId, dados({}));
    await expect(atualizarEvento(db, U, outro, id, dados({}))).rejects.toThrow(
      "Evento não encontrado.",
    );
    await expect(definirConcluido(db, U, outro, id, true)).rejects.toThrow(
      "Evento não encontrado.",
    );
    await expect(excluirEvento(db, U, outro, id)).rejects.toThrow("Evento não encontrado.");
    await excluirEvento(db, U, concursoId, id);
    expect(await listarEventos(db, concursoId)).toEqual([]);
  });

  it("exclui os eventos junto com o concurso", async () => {
    await criarEvento(db, U, concursoId, dados({}));
    await excluirConcurso(db, U, concursoId);
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

describe("salvarEventos", () => {
  it("cria e atualiza em lote, devolvendo os IDs na ordem", async () => {
    const existente = await criarEvento(db, U, concursoId, dados({ tipo: "PROVA_OBJETIVA" }));
    const ids = await salvarEventos(
      db,
      U,
      concursoId,
      [
        { id: null, dados: dados({ tipo: "PRAZO_RECURSO", data: "2026-11-20" }) },
        {
          id: existente,
          dados: dados({ tipo: "PROVA_OBJETIVA", data: "2026-12-05", concluido: true }),
        },
      ],
      T1,
    );
    expect(ids).toEqual([existente + 1, existente]);
    const eventos = await listarEventos(db, concursoId);
    expect(eventos.map((e) => [e.tipo, e.data, e.concluidoEm])).toEqual([
      ["PRAZO_RECURSO", "2026-11-20", null],
      ["PROVA_OBJETIVA", "2026-12-05", T1],
    ]);
  });

  it("é tudo ou nada: evento de outro concurso desfaz o lote", async () => {
    const outro = await criarConcurso(
      db,
      U,
      concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "Z", cargo: "W" }),
    );
    const alheio = await criarEvento(db, U, outro, dados({}));
    await expect(
      salvarEventos(db, U, concursoId, [
        { id: null, dados: dados({}) },
        { id: alheio, dados: dados({ data: "2027-01-01" }) },
      ]),
    ).rejects.toThrow(ErroDominio);
    expect(await listarEventos(db, concursoId)).toEqual([]);
    expect((await listarEventos(db, outro))[0]?.data).toBe("2026-11-10");
  });

  it("rejeita concurso inexistente", async () => {
    await expect(salvarEventos(db, U, 999, [])).rejects.toThrow("Concurso não encontrado.");
  });
});
