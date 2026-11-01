import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { obterConcurso } from "../queries/concursos";
import { listarEventos } from "../queries/eventos";
import { listarLinks } from "../queries/links";
import type { ConcursoNovoEntrada } from "./entradas";
import * as op from "./operacoes";

let db: Db;
let client: Client;

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
});

afterEach(() => client.close());

const AGORA = new Date("2026-11-01T12:00:00Z");
const CONCURSO: ConcursoNovoEntrada = {
  orgao: "Tribunal Regional Eleitoral de São Paulo",
  cargo: "Técnico Judiciário – Área Administrativa",
  remuneracao: 8529.65,
};

async function cadastrar(concurso: ConcursoNovoEntrada = CONCURSO) {
  const r = await op.cadastrar(db, {
    concurso,
    eventos: [{ tipo: "PROVA_OBJETIVA", data: "2027-01-10", hora: "09:00" }],
  });
  if (!r.ok || r.data.simulacao) throw new Error(JSON.stringify(r));
  return r.data.id;
}

describe("cadastrar", () => {
  it("usa EDITAL_PUBLICADO por padrão e aceita outro status inicial", async () => {
    const id = await cadastrar();
    expect((await obterConcurso(db, id))?.status).toBe("EDITAL_PUBLICADO");
    const r = await op.cadastrar(
      db,
      { concurso: { orgao: "Câmara", cargo: "Analista", status: "INSCRITO" } },
      AGORA,
    );
    expect(r.ok && !r.data.simulacao && (await obterConcurso(db, r.data.id))?.status).toBe(
      "INSCRITO",
    );
  });

  it("simular não grava e mostra valores em reais e possíveis duplicados", async () => {
    const id = await cadastrar();
    const r = await op.cadastrar(db, { concurso: CONCURSO, simular: true });
    expect(r).toMatchObject({
      ok: true,
      data: {
        simulacao: true,
        concurso: { remuneracao: 8529.65, status: "EDITAL_PUBLICADO" },
        possiveisDuplicados: [{ id }],
      },
    });
    expect(await op.listar(db)).toHaveLength(1);
  });

  it("com ignorarDuplicados cadastra mesmo havendo parecido", async () => {
    await cadastrar();
    const r = await op.cadastrar(db, { concurso: CONCURSO, ignorarDuplicados: true });
    expect(r.ok).toBe(true);
    expect(await op.listar(db)).toHaveLength(2);
  });

  it("acumula erros do concurso, eventos e links com o caminho", async () => {
    const r = await op.cadastrar(db, {
      concurso: { orgao: "", cargo: "X", validadeMeses: 30 },
      eventos: [{ tipo: "OUTRO", data: "2027-01-01", hora: "25:00" }],
      links: [{ tipo: "OUTRO", url: "" }],
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.erros).sort()).toEqual([
      "concurso.orgao",
      "concurso.validadeMeses",
      "eventos[0].hora",
      "links[0].url",
    ]);
  });
});

describe("atualizar", () => {
  it("recusa concurso inexistente e valida os campos", async () => {
    expect(await op.atualizar(db, 99, { cargo: "X" })).toEqual({
      ok: false,
      erros: { _form: ["Concurso não encontrado."] },
    });
    const id = await cadastrar();
    const r = await op.atualizar(db, id, {
      homologacaoData: "2027-05-01",
      validadeFimManual: "2027-01-01",
    });
    expect(!r.ok && r.erros.validadeFimManual).toBeTruthy();
  });

  it("não altera o status nem campos omitidos", async () => {
    const id = await cadastrar();
    await op.atualizar(db, id, { banca: "Cebraspe", tags: ["Eleitoral"] });
    expect(await obterConcurso(db, id)).toMatchObject({
      status: "EDITAL_PUBLICADO",
      banca: "Cebraspe",
      remuneracaoCentavos: 852_965,
      tags: ["eleitoral"],
    });
  });
});

describe("alterarStatus", () => {
  it("recusa concurso inexistente", async () => {
    expect(await op.alterarStatus(db, 5, { para: "INSCRITO" })).toMatchObject({ ok: false });
  });
});

describe("salvarEventos e salvarLinks", () => {
  it("exigem tipo ao criar e ID existente ao alterar, sem gravar nada", async () => {
    const id = await cadastrar();
    const outro = await cadastrar({ orgao: "Prefeitura de Campinas", cargo: "Professor" });
    const [doOutro] = await listarEventos(db, outro);

    const r = await op.salvarEventos(db, id, [
      { tipo: "PRAZO_RECURSO", data: "2027-01-12" },
      { data: "2027-01-13" },
      { id: doOutro?.id, data: "2027-02-01" },
    ]);
    expect(!r.ok && Object.keys(r.erros).sort()).toEqual(["eventos[1].tipo", "eventos[2].id"]);
    expect(await listarEventos(db, id)).toHaveLength(1);

    const l = await op.salvarLinks(db, id, [{ url: "https://x.com" }, { id: 999, rotulo: "a" }]);
    expect(!l.ok && Object.keys(l.erros).sort()).toEqual(["links[0].tipo", "links[1].id"]);
    expect(await listarLinks(db, id)).toEqual([]);
  });

  it("recusam concurso inexistente", async () => {
    expect((await op.salvarEventos(db, 9, [{ tipo: "OUTRO", data: "2027-01-01" }])).ok).toBe(false);
    expect((await op.salvarLinks(db, 9, [{ tipo: "OUTRO", url: "https://x.com" }])).ok).toBe(false);
  });

  it("marca conclusão e altera link existente", async () => {
    const id = await cadastrar();
    const [prova] = await listarEventos(db, id);
    expect((await op.salvarEventos(db, id, [{ id: prova?.id, concluido: true }], AGORA)).ok).toBe(
      true,
    );
    expect((await listarEventos(db, id))[0]).toMatchObject({ concluido: true, concluidoEm: AGORA });

    const criado = await op.salvarLinks(db, id, [{ tipo: "OUTRO", url: "https://a.com" }]);
    const linkId = criado.ok ? criado.data.ids[0] : undefined;
    await op.salvarLinks(db, id, [{ id: linkId, tipo: "GABARITO", rotulo: "Gabarito" }]);
    expect(await listarLinks(db, id)).toEqual([
      expect.objectContaining({ tipo: "GABARITO", rotulo: "Gabarito", url: "https://a.com" }),
    ]);
  });
});

describe("registrarResultado", () => {
  it("exige a fase ao criar e um resultado do concurso ao alterar", async () => {
    const id = await cadastrar();
    expect(await op.registrarResultado(db, id, { nota: 50 })).toMatchObject({
      ok: false,
      erros: { fase: [expect.any(String)] },
    });
    expect(await op.registrarResultado(db, id, { id: 3, nota: 50 })).toMatchObject({ ok: false });
    expect(await op.registrarResultado(db, 77, { fase: "OBJETIVA" })).toMatchObject({ ok: false });
    expect(
      await op.registrarResultado(db, id, { fase: "OBJETIVA", nota: 90, notaMaxima: 80 }),
    ).toMatchObject({ ok: false, erros: { nota: [expect.any(String)] } });
  });
});

describe("leituras", () => {
  it("obterFicha devolve null para inexistente", async () => {
    expect(await op.obterFicha(db, 1)).toBeNull();
  });

  it("listar filtra por status e UF; prazos trazem o concurso", async () => {
    const id = await cadastrar({ ...CONCURSO, uf: "SP" });
    expect(await op.listar(db, { status: ["INSCRITO"] })).toEqual([]);
    expect(await op.listar(db, { uf: "SP" })).toMatchObject([{ id, remuneracao: 8529.65 }]);
    const prazos = await op.proximosPrazos(db, 30, "2027-01-01");
    expect(prazos.proximos).toMatchObject([
      { concursoId: id, tipo: "PROVA_OBJETIVA", data: "2027-01-10", dias: 9 },
    ]);
  });
});
