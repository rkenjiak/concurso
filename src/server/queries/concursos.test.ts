import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type ConcursoFormValores,
  concursoSchema,
  VALORES_INICIAIS_CONCURSO,
} from "@/lib/schemas/concurso";
import { eventoSchema, VALORES_INICIAIS_EVENTO } from "@/lib/schemas/evento";
import { type FiltrosConcursos, lerFiltrosConcursos } from "@/lib/schemas/filtros-concursos";
import { ID_USUARIO_INICIAL as U } from "@/server/db/schema";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { concurso } from "../db/schema";
import { criarConcurso } from "../repositories/concursos";
import { criarEvento } from "../repositories/eventos";
import { listarConcursos, termosDaBusca } from "./concursos";

let db: Db;
let client: Client;
let ids: Record<"trf" | "pm" | "pref" | "sefaz", number>;

const HOJE = "2026-10-31";

const novo = (parcial: Partial<ConcursoFormValores>) =>
  criarConcurso(
    db,
    U,
    concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, cargo: "Analista", ...parcial }),
  );

const evento = (concursoId: number, data: string, concluido = false) =>
  criarEvento(
    db,
    U,
    concursoId,
    eventoSchema.parse({ ...VALORES_INICIAIS_EVENTO, data, concluido }),
  );

const definirCriacao = (id: number, iso: string) =>
  db
    .update(concurso)
    .set({ createdAt: new Date(iso) })
    .where(eq(concurso.id, id));

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
  ids = {
    trf: await novo({
      orgao: "Tribunal Regional Federal",
      cargo: "Técnico Judiciário",
      banca: "FCC",
      esfera: "FEDERAL",
      uf: "SP",
      escolaridade: "MEDIO",
      remuneracao: "8.500,00",
      status: "INSCRITO",
      tags: ["tribunais", "área administrativa"],
    }),
    pm: await novo({
      orgao: "Polícia Militar",
      cargo: "Soldado",
      banca: "Vunesp",
      esfera: "ESTADUAL",
      uf: "SP",
      escolaridade: "MEDIO",
      remuneracao: "4.000,00",
      status: "PREVISTO",
    }),
    pref: await novo({
      orgao: "Prefeitura de Óbidos",
      cargo: "Auditor_Fiscal 100%",
      esfera: "MUNICIPAL",
      uf: "PA",
      escolaridade: "SUPERIOR",
      status: "APROVADO",
    }),
    sefaz: await novo({
      orgao: "Secretaria da Fazenda",
      cargo: "Auditor Fiscal",
      banca: "FGV",
      esfera: "ESTADUAL",
      uf: "RJ",
      escolaridade: "SUPERIOR",
      remuneracao: "21.000,00",
      status: "INSCRITO",
    }),
  };
  await definirCriacao(ids.trf, "2026-01-01T00:00:00Z");
  await definirCriacao(ids.pm, "2026-02-01T00:00:00Z");
  await definirCriacao(ids.pref, "2026-03-01T00:00:00Z");
  await definirCriacao(ids.sefaz, "2026-04-01T00:00:00Z");
});

afterEach(() => client.close());

const listar = async (filtros: Partial<FiltrosConcursos>) =>
  (await listarConcursos(db, U, filtros, HOJE)).map((c) => c.id);

describe("listarConcursos — busca", () => {
  it("ignora acentos e maiúsculas e busca em órgão, cargo, banca e tags", async () => {
    expect(await listar({ busca: "OBIDOS" })).toEqual([ids.pref]);
    expect(await listar({ busca: "tecnico judiciario" })).toEqual([ids.trf]);
    expect(await listar({ busca: "vunesp" })).toEqual([ids.pm]);
    expect(await listar({ busca: "Área Administrativa" })).toEqual([ids.trf]);
  });

  it("exige todos os termos, em qualquer ordem", async () => {
    expect(await listar({ busca: "fiscal auditor" })).toEqual([ids.sefaz, ids.pref]);
    expect(await listar({ busca: "auditor fgv" })).toEqual([ids.sefaz]);
    expect(await listar({ busca: "auditor vunesp" })).toEqual([]);
  });

  it("trata % e _ como texto literal", async () => {
    expect(await listar({ busca: "100%" })).toEqual([ids.pref]);
    expect(await listar({ busca: "auditor_" })).toEqual([ids.pref]);
    expect(await listar({ busca: "%" })).toEqual([ids.pref]);
    expect(await listar({ busca: "!" })).toEqual([]);
  });

  it("limita a busca a 20 termos distintos, sem erro de SQL com buscas enormes (#96)", async () => {
    const enorme = Array.from({ length: 5000 }, (_, i) => `t${i}`).join(" ");
    expect(await listar({ busca: enorme })).toEqual([]);
    // "auditor" fica depois dos 200 caracteres e é descartado: vale só "fiscal".
    expect(await listar({ busca: `${"fiscal ".repeat(1000)}auditor` })).toEqual(
      await listar({ busca: "fiscal" }),
    );
    expect(await listar({ busca: `${"fiscal ".repeat(10)}auditor fgv` })).toEqual([ids.sefaz]);
  });
});

describe("termosDaBusca", () => {
  it("normaliza, remove repetidos e limita caracteres e termos", () => {
    expect(termosDaBusca(null)).toEqual([]);
    expect(termosDaBusca("  Área  área AREA tj ")).toEqual(["area", "tj"]);
    expect(termosDaBusca(Array.from({ length: 50 }, (_, i) => `t${i}`).join(" "))).toHaveLength(20);
    // Só os primeiros 200 caracteres contam: o termo depois deles é descartado.
    expect(termosDaBusca(`${"a".repeat(199)} fim`)).toEqual(["a".repeat(199)]);
  });
});

describe("listarConcursos — filtros", () => {
  it("filtra por vários status", async () => {
    expect(await listar({ status: ["INSCRITO", "APROVADO"] })).toEqual([
      ids.sefaz,
      ids.pref,
      ids.trf,
    ]);
  });

  it("filtra por esfera, UF e escolaridade combinados", async () => {
    expect(await listar({ esfera: "ESTADUAL" })).toEqual([ids.sefaz, ids.pm]);
    expect(await listar({ uf: "SP", escolaridade: "MEDIO" })).toEqual([ids.pm, ids.trf]);
    expect(await listar({ esfera: "ESTADUAL", uf: "SP" })).toEqual([ids.pm]);
  });

  it("filtra por faixa de remuneração (inclusiva), excluindo quem não tem valor", async () => {
    expect(await listar({ remuneracaoMin: 850_000 })).toEqual([ids.sefaz, ids.trf]);
    expect(await listar({ remuneracaoMax: 850_000 })).toEqual([ids.pm, ids.trf]);
    expect(await listar({ remuneracaoMin: 400_001, remuneracaoMax: 850_000 })).toEqual([ids.trf]);
  });

  it("aceita os filtros lidos da URL", async () => {
    const filtros = lerFiltrosConcursos({ q: "auditor", status: "INSCRITO", remMin: "10.000" });
    expect(await listar(filtros)).toEqual([ids.sefaz]);
  });
});

describe("listarConcursos — ordenação", () => {
  it("padrão: cadastro mais recente primeiro", async () => {
    expect(await listar({})).toEqual([ids.sefaz, ids.pref, ids.pm, ids.trf]);
  });

  it("por nome, sem acento/maiúsculas", async () => {
    expect(await listar({ ordem: "nome" })).toEqual([ids.pm, ids.pref, ids.sefaz, ids.trf]);
  });

  it("por remuneração, maior primeiro e sem valor por último", async () => {
    expect(await listar({ ordem: "remuneracao" })).toEqual([ids.sefaz, ids.trf, ids.pm, ids.pref]);
  });

  it("por próxima data pendente (>= hoje), sem data por último", async () => {
    await evento(ids.trf, "2026-12-10");
    await evento(ids.trf, "2026-10-01"); // passada: ignorada
    await evento(ids.pm, "2026-11-05", true); // concluída: ignorada
    await evento(ids.pm, "2026-11-20");
    await evento(ids.pref, HOJE);
    const lista = await listarConcursos(db, U, { ordem: "proxima_data" }, HOJE);
    expect(lista.map((c) => [c.id, c.proximaData])).toEqual([
      [ids.pref, HOJE],
      [ids.pm, "2026-11-20"],
      [ids.trf, "2026-12-10"],
      [ids.sefaz, null],
    ]);
  });
});
