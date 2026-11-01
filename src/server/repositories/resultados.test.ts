import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErroDominio } from "@/domain/erros";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import {
  type ResultadoFaseDados,
  type ResultadoFaseFormValores,
  resultadoFaseSchema,
  VALORES_INICIAIS_RESULTADO_FASE,
  valoresDoResultadoFase,
} from "@/lib/schemas/resultado-fase";
import { ID_USUARIO_INICIAL as U } from "@/server/db/schema";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { listarResultadosFase } from "../queries/resultados";
import { criarConcurso, excluirConcurso } from "./concursos";
import { atualizarResultadoFase, criarResultadoFase, excluirResultadoFase } from "./resultados";

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

const dados = (parcial: Partial<ResultadoFaseFormValores> = {}): ResultadoFaseDados =>
  resultadoFaseSchema.parse({ ...VALORES_INICIAIS_RESULTADO_FASE, ...parcial });

const erroEm = (parcial: Partial<ResultadoFaseFormValores>) => {
  const r = resultadoFaseSchema.safeParse({ ...VALORES_INICIAIS_RESULTADO_FASE, ...parcial });
  if (r.success) throw new Error("esperava falha");
  return r.error.issues.map((i) => i.path.join("."));
};

describe("resultados por fase", () => {
  it("cria na ordem de cadastro com todos os campos", async () => {
    const a = await criarResultadoFase(
      db,
      U,
      concursoId,
      dados({
        fase: "OBJETIVA",
        descricao: "Conhecimentos gerais e específicos",
        nota: "72,5",
        notaMaxima: "100",
        notaCorte: "65.25",
        classificacaoGeral: "120",
        classificacaoCotas: "8",
        listaCotas: "PcD",
        situacao: "APROVADO",
        observacao: "Recurso deferido na questão 12",
      }),
    );
    const b = await criarResultadoFase(db, U, concursoId, dados({ fase: "DISCURSIVA" }));
    const lista = await listarResultadosFase(db, concursoId);
    expect(lista.map((r) => r.id)).toEqual([a, b]);
    expect(lista.map((r) => r.ordem)).toEqual([0, 1]);
    expect(lista[0]).toMatchObject({
      concursoId,
      fase: "OBJETIVA",
      descricao: "Conhecimentos gerais e específicos",
      nota: 72.5,
      notaMaxima: 100,
      notaCorte: 65.25,
      classificacaoGeral: 120,
      classificacaoCotas: 8,
      listaCotas: "PcD",
      situacao: "APROVADO",
      observacao: "Recurso deferido na questão 12",
    });
    expect(lista[1]).toMatchObject({ fase: "DISCURSIVA", nota: null, situacao: "PENDENTE" });
  });

  it("rejeita resultado de concurso inexistente", async () => {
    await expect(criarResultadoFase(db, U, 999, dados())).rejects.toThrow(ErroDominio);
  });

  it("atualiza e volta aos valores do formulário", async () => {
    const id = await criarResultadoFase(db, U, concursoId, dados({ nota: "50" }));
    await atualizarResultadoFase(
      db,
      U,
      concursoId,
      id,
      dados({ nota: "81,125", situacao: "CLASSIFICADO", classificacaoGeral: "3" }),
    );
    const [r] = await listarResultadosFase(db, concursoId);
    expect(r).toMatchObject({ nota: 81.125, situacao: "CLASSIFICADO", classificacaoGeral: 3 });
    if (!r) throw new Error("sem resultado");
    expect(valoresDoResultadoFase(r)).toEqual({
      ...VALORES_INICIAIS_RESULTADO_FASE,
      nota: "81,125",
      situacao: "CLASSIFICADO",
      classificacaoGeral: "3",
    });
  });

  it("restringe atualização e exclusão ao concurso", async () => {
    const outro = await criarConcurso(
      db,
      U,
      concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "Outro", cargo: "Z" }),
    );
    const id = await criarResultadoFase(db, U, concursoId, dados());
    await expect(atualizarResultadoFase(db, U, outro, id, dados())).rejects.toThrow(
      "Resultado não encontrado.",
    );
    await expect(excluirResultadoFase(db, U, outro, id)).rejects.toThrow(
      "Resultado não encontrado.",
    );
    await excluirResultadoFase(db, U, concursoId, id);
    expect(await listarResultadosFase(db, concursoId)).toEqual([]);
  });

  it("exclui os resultados junto com o concurso", async () => {
    await criarResultadoFase(db, U, concursoId, dados());
    await excluirConcurso(db, U, concursoId);
    expect(await listarResultadosFase(db, concursoId)).toEqual([]);
  });
});

describe("resultadoFaseSchema", () => {
  it("normaliza opcionais vazios para null", () => {
    expect(dados({ descricao: " ", listaCotas: "", observacao: "" })).toEqual({
      fase: "OBJETIVA",
      descricao: null,
      nota: null,
      notaMaxima: null,
      notaCorte: null,
      classificacaoGeral: null,
      classificacaoCotas: null,
      listaCotas: null,
      situacao: "PENDENTE",
      observacao: null,
    });
  });

  it.each(["-1", "abc", "7,1234", "100001"])("rejeita nota %j", (nota) => {
    expect(erroEm({ nota })).toEqual(["nota"]);
  });

  it("rejeita classificação zero ou não inteira", () => {
    expect(erroEm({ classificacaoGeral: "0" })).toEqual(["classificacaoGeral"]);
    expect(erroEm({ classificacaoCotas: "1,5" })).toEqual(["classificacaoCotas"]);
  });

  it("nota e nota de corte não podem passar da nota máxima", () => {
    expect(erroEm({ nota: "101", notaCorte: "100,5", notaMaxima: "100" })).toEqual([
      "nota",
      "notaCorte",
    ]);
    expect(dados({ nota: "100", notaCorte: "60", notaMaxima: "100" }).nota).toBe(100);
    expect(dados({ nota: "120" }).nota).toBe(120);
  });

  it("rejeita fase e situação inválidas", () => {
    expect(erroEm({ fase: "X" as never, situacao: "Y" as never })).toEqual(["fase", "situacao"]);
  });
});
