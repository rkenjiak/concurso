import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import { eventoSchema, VALORES_INICIAIS_EVENTO } from "@/lib/schemas/evento";
import { ID_USUARIO_INICIAL as U } from "@/server/db/schema";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { concurso, evento } from "../db/schema";
import { criarConcurso } from "./concursos";
import { definirPrazoOculto } from "./dashboard";
import { criarEvento } from "./eventos";

let db: Db;
let client: Client;

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
});

afterEach(() => client.close());

async function popular() {
  const concursoId = await criarConcurso(
    db,
    U,
    concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "TRF", cargo: "Analista" }),
  );
  const eventoId = await criarEvento(
    db,
    U,
    concursoId,
    eventoSchema.parse({ ...VALORES_INICIAIS_EVENTO, data: "2026-11-05" }),
  );
  return { concursoId, eventoId };
}

const lerEvento = async (id: number) =>
  (await db.select().from(evento).where(eq(evento.id, id)))[0];
const lerConcurso = async (id: number) =>
  (await db.select().from(concurso).where(eq(concurso.id, id)))[0];

describe("definirPrazoOculto", () => {
  it("novos registros começam visíveis", async () => {
    const { concursoId, eventoId } = await popular();
    expect((await lerEvento(eventoId))?.ocultoDashboard).toBe(false);
    expect((await lerConcurso(concursoId))?.validadeOcultaDashboard).toBe(false);
  });

  it("oculta e reexibe um evento sem alterar updated_at", async () => {
    const { eventoId } = await popular();
    const antes = await lerEvento(eventoId);
    await definirPrazoOculto(db, U, { tipo: "evento", eventoId }, true);
    const oculto = await lerEvento(eventoId);
    expect(oculto?.ocultoDashboard).toBe(true);
    expect(oculto?.updatedAt).toEqual(antes?.updatedAt);
    await definirPrazoOculto(db, U, { tipo: "evento", eventoId }, false);
    expect((await lerEvento(eventoId))?.ocultoDashboard).toBe(false);
  });

  it("oculta e reexibe o fim da validade do concurso sem alterar updated_at", async () => {
    const { concursoId } = await popular();
    const antes = await lerConcurso(concursoId);
    await definirPrazoOculto(db, U, { tipo: "validade", concursoId }, true);
    const oculto = await lerConcurso(concursoId);
    expect(oculto?.validadeOcultaDashboard).toBe(true);
    expect(oculto?.updatedAt).toEqual(antes?.updatedAt);
    await definirPrazoOculto(db, U, { tipo: "validade", concursoId }, false);
    expect((await lerConcurso(concursoId))?.validadeOcultaDashboard).toBe(false);
  });

  it("lança erro de domínio para registro inexistente", async () => {
    await expect(definirPrazoOculto(db, U, { tipo: "evento", eventoId: 99 }, true)).rejects.toThrow(
      "Evento não encontrado.",
    );
    await expect(
      definirPrazoOculto(db, U, { tipo: "validade", concursoId: 99 }, true),
    ).rejects.toThrow("Concurso não encontrado.");
  });
});
