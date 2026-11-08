import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Status } from "@/domain/enums";
import { ErroDominio } from "@/domain/erros";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import {
  type EventoFormValores,
  eventoSchema,
  VALORES_INICIAIS_EVENTO,
} from "@/lib/schemas/evento";
import { ID_USUARIO_INICIAL as U } from "@/server/db/schema";
import { criarBancoTeste, criarUsuarioTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { criarConcurso } from "../repositories/concursos";
import { atualizarEvento, criarEvento, definirConcluido } from "../repositories/eventos";
import { dispensarPendencia } from "../repositories/pendencias";
import { listarContagens } from "./contagem";
import { listarPendenciasStatus, obterPendenciaDoEvento } from "./sugestoes";

let db: Db;
let client: Client;

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
});

afterEach(() => client.close());

const HOJE = "2026-11-10";

const novoConcurso = (orgao: string, status: Status, usuarioId = U) =>
  criarConcurso(
    db,
    usuarioId,
    concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao, cargo: "Analista", status }),
  );

const novoEvento = (concursoId: number, parcial: Partial<EventoFormValores>, usuarioId = U) =>
  criarEvento(
    db,
    usuarioId,
    concursoId,
    eventoSchema.parse({ ...VALORES_INICIAIS_EVENTO, data: HOJE, ...parcial }),
  );

describe("listarContagens (#84)", () => {
  it("próxima prova por concurso, ordenada, só de concursos em andamento do usuário", async () => {
    const trf = await novoConcurso("TRF", "INSCRITO");
    const tj = await novoConcurso("TJ", "PROVA_AGENDADA");
    const cancelado = await novoConcurso("Cancelado", "CANCELADO");
    const outra = await criarUsuarioTeste(db);
    const deOutro = await novoConcurso("Outro", "INSCRITO", outra);
    await novoEvento(trf, { tipo: "PROVA_OBJETIVA", data: "2026-11-20" });
    await novoEvento(trf, { tipo: "PROVA_DISCURSIVA", data: "2026-12-20" });
    await novoEvento(trf, { tipo: "PROVA_OBJETIVA", data: "2026-11-01" });
    await novoEvento(tj, { tipo: "PROVA_OBJETIVA", data: "2026-11-11" });
    await novoEvento(tj, { tipo: "FIM_INSCRICOES", data: "2026-11-10" });
    await novoEvento(cancelado, { tipo: "PROVA_OBJETIVA", data: "2026-11-12" });
    await novoEvento(deOutro, { tipo: "PROVA_OBJETIVA", data: "2026-11-12" }, outra);

    const r = await listarContagens(db, U, HOJE);
    expect(r.map((c) => [c.orgao, c.contagem.dias, c.contagem.destaque])).toEqual([
      ["TJ", 1, "AMANHA"],
      ["TRF", 10, "NORMAL"],
    ]);
    expect(r[1]?.contagem.rotulo).toBe("Prova objetiva em 10 dias, 20/11/2026");
  });
});

describe("listarPendenciasStatus (#85)", () => {
  it("pergunta por evento e respeita dispensas e adiamentos", async () => {
    const trf = await novoConcurso("TRF", "EDITAL_PUBLICADO");
    const tj = await novoConcurso("TJ", "PROVA_AGENDADA");
    await novoConcurso("Sem eventos", "INSCRITO");
    const fim = await novoEvento(trf, { tipo: "FIM_INSCRICOES", data: "2026-11-05" });
    const prova = await novoEvento(tj, { tipo: "PROVA_OBJETIVA", data: "2026-11-08" });

    const antes = await listarPendenciasStatus(db, U, HOJE);
    expect(antes.map((c) => [c.orgao, c.pendencia.chave])).toEqual([
      ["TJ", `PROVA-${prova}`],
      ["TRF", `INSCRICAO-${fim}`],
    ]);

    await dispensarPendencia(db, U, trf, {
      regra: "INSCRICAO",
      eventoId: fim,
      dataEvento: "2026-11-05",
      ate: null,
    });
    await dispensarPendencia(db, U, tj, {
      regra: "PROVA",
      eventoId: prova,
      dataEvento: "2026-11-08",
      ate: "2026-11-13",
    });
    expect(await listarPendenciasStatus(db, U, HOJE)).toEqual([]);
    // O adiamento vence; a dispensa continua.
    expect((await listarPendenciasStatus(db, U, "2026-11-13")).map((c) => c.orgao)).toEqual(["TJ"]);

    // Evento remarcado: a dispensa deixa de valer.
    await atualizarEvento(
      db,
      U,
      trf,
      fim,
      eventoSchema.parse({
        ...VALORES_INICIAIS_EVENTO,
        tipo: "FIM_INSCRICOES",
        data: "2026-11-07",
      }),
    );
    expect((await listarPendenciasStatus(db, U, HOJE)).map((c) => c.orgao)).toEqual(["TRF"]);
  });

  it("dispensa só em concurso e evento do próprio usuário", async () => {
    const trf = await novoConcurso("TRF", "EDITAL_PUBLICADO");
    const tj = await novoConcurso("TJ", "EDITAL_PUBLICADO");
    const fim = await novoEvento(trf, { tipo: "FIM_INSCRICOES", data: "2026-11-05" });
    const outra = await criarUsuarioTeste(db);
    const dados = {
      regra: "INSCRICAO",
      eventoId: fim,
      dataEvento: "2026-11-05",
      ate: null,
    } as const;
    await expect(dispensarPendencia(db, outra, trf, dados)).rejects.toThrow(ErroDominio);
    await expect(dispensarPendencia(db, U, tj, dados)).rejects.toThrow("Evento não encontrado.");
  });
});

describe("obterPendenciaDoEvento (#100, D5)", () => {
  it("pendência do evento recém-concluído; nada se for de outro evento ou de outro usuário", async () => {
    const trf = await novoConcurso("TRF", "EDITAL_PUBLICADO");
    const fim = await novoEvento(trf, { tipo: "FIM_INSCRICOES", data: "2026-11-20" });
    const boleto = await novoEvento(trf, { tipo: "VENCIMENTO_BOLETO", data: "2026-11-25" });

    // Antes de concluir, o fim das inscrições (futuro) não gera pergunta.
    expect(await obterPendenciaDoEvento(db, U, trf, fim, HOJE)).toBeNull();
    await definirConcluido(db, U, trf, fim, true);
    expect((await obterPendenciaDoEvento(db, U, trf, fim, HOJE))?.chave).toBe(`INSCRICAO-${fim}`);
    // A pendência atual do concurso é de outro evento.
    await definirConcluido(db, U, trf, boleto, true);
    expect(await obterPendenciaDoEvento(db, U, trf, boleto, HOJE)).toBeNull();
    // Concurso de outro usuário.
    const outra = await criarUsuarioTeste(db);
    expect(await obterPendenciaDoEvento(db, outra, trf, fim, HOJE)).toBeNull();
  });
});
