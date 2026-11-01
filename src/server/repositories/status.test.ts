import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Status } from "@/domain/enums";
import { ErroDominio } from "@/domain/erros";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import { alterarStatusSchema } from "@/lib/schemas/status";
import { ID_USUARIO_INICIAL as U } from "@/server/db/schema";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { obterConcurso } from "../queries/concursos";
import { listarHistorico, obterOpcoesStatus, opcoesStatusPorConcurso } from "../queries/historico";
import { criarConcurso } from "./concursos";
import { alterarStatus, desfazerUltimoStatus } from "./status";

let db: Db;
let client: Client;

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
});

afterEach(() => client.close());

const t = (dia: number) => new Date(Date.UTC(2026, 0, dia, 12));

async function novo(status: Status = "PREVISTO"): Promise<number> {
  return criarConcurso(
    db,
    U,
    concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "X", cargo: "Y", status }),
    t(1),
  );
}

async function seq(id: number) {
  return (await listarHistorico(db, id)).map((h) => [h.de, h.para]);
}

describe("alterarStatus", () => {
  it("registra no histórico e atualiza status/status_desde", async () => {
    const id = await novo();
    await alterarStatus(db, U, id, "INSCRITO", "taxa paga", t(5));
    const c = await obterConcurso(db, U, id);
    expect(c).toMatchObject({ status: "INSCRITO", statusDesde: t(5) });
    const hist = await listarHistorico(db, id);
    expect(hist.at(-1)).toMatchObject({
      de: "PREVISTO",
      para: "INSCRITO",
      alteradoEm: t(5),
      observacao: "taxa paga",
    });
    expect(await seq(id)).toEqual([
      [null, "PREVISTO"],
      ["PREVISTO", "INSCRITO"],
    ]);
  });

  it("rejeita transição não permitida sem gravar nada", async () => {
    const id = await novo("PROVA_AGENDADA");
    await expect(alterarStatus(db, U, id, "INSCRITO")).rejects.toThrow(ErroDominio);
    expect((await obterConcurso(db, U, id))?.status).toBe("PROVA_AGENDADA");
    expect(await listarHistorico(db, id)).toHaveLength(1);
  });

  it("rejeita concurso inexistente", async () => {
    await expect(alterarStatus(db, U, 999, "INSCRITO")).rejects.toThrow("Concurso não encontrado.");
  });

  it("suspensão só retoma o status anterior", async () => {
    const id = await novo("INSCRITO");
    await alterarStatus(db, U, id, "SUSPENSO", null, t(2));
    await expect(alterarStatus(db, U, id, "PREVISTO", null, t(3))).rejects.toThrow(ErroDominio);
    await alterarStatus(db, U, id, "INSCRITO", null, t(4));
    expect((await obterConcurso(db, U, id))?.status).toBe("INSCRITO");
  });
});

describe("desfazerUltimoStatus", () => {
  it("remove o último registro e restaura o status e a data anteriores", async () => {
    const id = await novo();
    await alterarStatus(db, U, id, "EDITAL_PUBLICADO", null, t(2));
    await alterarStatus(db, U, id, "CANCELADO", null, t(3));
    expect(await desfazerUltimoStatus(db, U, id)).toBe("EDITAL_PUBLICADO");
    expect(await obterConcurso(db, U, id)).toMatchObject({
      status: "EDITAL_PUBLICADO",
      statusDesde: t(2),
    });
    expect(await seq(id)).toEqual([
      [null, "PREVISTO"],
      ["PREVISTO", "EDITAL_PUBLICADO"],
    ]);
    expect(await desfazerUltimoStatus(db, U, id)).toBe("PREVISTO");
    expect((await obterConcurso(db, U, id))?.statusDesde).toEqual(t(1));
  });

  it("não desfaz o registro de criação", async () => {
    const id = await novo();
    await expect(desfazerUltimoStatus(db, U, id)).rejects.toThrow(
      "Não há mudança de status para desfazer.",
    );
    expect(await listarHistorico(db, id)).toHaveLength(1);
  });

  it("rejeita concurso inexistente", async () => {
    await expect(desfazerUltimoStatus(db, U, 999)).rejects.toThrow("Concurso não encontrado.");
  });
});

describe("obterOpcoesStatus", () => {
  it("oferece transições e desfazer conforme o histórico", async () => {
    const id = await novo("APROVADO");
    let r = await obterOpcoesStatus(db, id, "APROVADO");
    expect(r.opcoes.desfazerPara).toBeNull();
    expect(r.opcoes.transicoes).toContain("NOMEADO");

    await alterarStatus(db, U, id, "SUSPENSO", null, t(2));
    r = await obterOpcoesStatus(db, id, "SUSPENSO");
    expect(r.opcoes).toEqual({ transicoes: ["APROVADO", "CANCELADO"], desfazerPara: "APROVADO" });
    expect(r.historico).toHaveLength(2);
  });
});

describe("opcoesStatusPorConcurso", () => {
  it("lista vazia não consulta o banco", async () => {
    expect((await opcoesStatusPorConcurso(db, [])).size).toBe(0);
  });

  it("calcula as opções de cada concurso a partir do próprio histórico", async () => {
    const a = await novo("APROVADO");
    const b = await novo("PREVISTO");
    await alterarStatus(db, U, a, "SUSPENSO", null, t(2));
    await alterarStatus(db, U, b, "INSCRITO", null, t(3));
    const mapa = await opcoesStatusPorConcurso(db, [
      { id: a, status: "SUSPENSO" },
      { id: b, status: "INSCRITO" },
    ]);
    expect(mapa.get(a)).toEqual((await obterOpcoesStatus(db, a, "SUSPENSO")).opcoes);
    expect(mapa.get(a)?.transicoes).toEqual(["APROVADO", "CANCELADO"]);
    expect(mapa.get(b)?.desfazerPara).toBe("PREVISTO");
    expect(mapa.get(b)?.transicoes).not.toContain("PREVISTO");
  });
});

describe("alterarStatusSchema", () => {
  it("normaliza observação vazia ou ausente", () => {
    expect(alterarStatusSchema.parse({ para: "INSCRITO", observacao: "  " })).toEqual({
      para: "INSCRITO",
      observacao: null,
    });
    expect(alterarStatusSchema.parse({ para: "INSCRITO" }).observacao).toBeNull();
  });

  it("rejeita status inválido", () => {
    const r = alterarStatusSchema.safeParse({ para: "X" });
    expect(r.error?.issues[0]?.message).toBe("Selecione o novo status.");
  });
});
