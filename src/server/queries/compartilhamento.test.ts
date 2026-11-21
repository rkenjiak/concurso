/**
 * Testes da leitura pública e ciclo de vida do compartilhamento (#129).
 *
 * Confere validação de token antes de tocar no banco, contrato exato de chaves do DTO público
 * (nenhum campo privado), autorização do dono (`donoDoTokenAutorizado`) e operações de repositório.
 */
import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import { eventoSchema, VALORES_INICIAIS_EVENTO } from "@/lib/schemas/evento";
import { linkSchema } from "@/lib/schemas/link";
import { resultadoFaseSchema, VALORES_INICIAIS_RESULTADO_FASE } from "@/lib/schemas/resultado-fase";
import type { ConfigAuth } from "../auth/config";
import { criarBancoTeste, criarUsuarioTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { emailPermitido, ID_USUARIO_INICIAL, usuario } from "../db/schema";
import {
  ativarCompartilhamento,
  obterCompartilhamentoDoConcurso,
  regenerarCompartilhamento,
  revogarCompartilhamento,
} from "../repositories/compartilhamento";
import { criarConcurso } from "../repositories/concursos";
import { definirPrazoOculto } from "../repositories/dashboard";
import { criarEvento } from "../repositories/eventos";
import { criarLink } from "../repositories/links";
import { criarResultadoFase } from "../repositories/resultados";
import { alterarStatus } from "../repositories/status";
import { obterConcursoCompartilhado } from "./compartilhamento";

let db: Db;
let client: Client;
const U = ID_USUARIO_INICIAL;
const SEM_LOGIN: ConfigAuth = { habilitada: false };
const GOOGLE_CFG = { clientId: "c", clientSecret: "s" };
const GOOGLE: ConfigAuth = {
  habilitada: true,
  segredo: new Uint8Array(32),
  senha: null,
  google: GOOGLE_CFG,
  emailsAdmin: new Set(["ana@x.com"]),
  emailsPermitidos: new Set(["bia@x.com"]),
};

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
  await db.update(usuario).set({ email: "ana@x.com", nome: "Ana" }).where(eq(usuario.id, U));
});

afterEach(() => client.close());

describe("obterConcursoCompartilhado", () => {
  it("rejeita token malformado sem consultar o banco", async () => {
    const selectSpy = vi.fn(() => {
      throw new Error("não deveria consultar o banco");
    });
    const fakeDb = { select: selectSpy } as unknown as Db;

    for (const invalido of [
      "",
      "curto",
      "token-com-tamanho-invalido-1234567890",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!", // 32 chars com '!' inválido
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa+", // 32 chars com '+' inválido
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=", // 32 chars com '=' inválido
      "a".repeat(33),
    ]) {
      expect(await obterConcursoCompartilhado(fakeDb, SEM_LOGIN, invalido)).toBeNull();
    }
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it("retorna null para token válido inexistente no banco", async () => {
    expect(
      await obterConcursoCompartilhado(db, SEM_LOGIN, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    ).toBeNull();
  });

  it("retorna apenas as chaves exatas do DTO público e exclui dados privados", async () => {
    const cid = await criarConcurso(
      db,
      U,
      concursoSchema.parse({
        ...VALORES_INICIAIS_CONCURSO,
        orgao: "TRF 3ª Região",
        cargo: "Analista Judiciário",
        banca: "FCC",
        esfera: "FEDERAL",
        uf: "SP",
        cidade: "São Paulo",
        escolaridade: "SUPERIOR",
        remuneracao: "14.000,00",
        taxaInscricao: "130,00",
        vagasAmpla: "10",
        status: "INSCRITO",
        observacoes: "SENTINELA-CONCURSO-OBS",
        homologacaoData: "2026-01-10",
        validadeMeses: "24",
        validadeProrrogada: true,
        tags: ["SENTINELA-TAG"],
        cor: "AZUL",
        icone: "⚖️",
      }),
      new Date("2026-10-01T12:00:00Z"),
    );
    await alterarStatus(db, U, cid, "PROVA_AGENDADA", "SENTINELA-STATUS-OBS");
    const evId = await criarEvento(
      db,
      U,
      cid,
      eventoSchema.parse({
        ...VALORES_INICIAIS_EVENTO,
        tipo: "PROVA_OBJETIVA",
        titulo: "Prova objetiva",
        data: "2026-11-20",
        hora: "13:00",
        local: "SENTINELA-EVENTO-LOCAL",
        observacao: "SENTINELA-EVENTO-OBS",
        concluido: false,
      }),
    );
    // Evento oculto no dashboard deve aparecer no cronograma público (#129).
    await definirPrazoOculto(db, U, { tipo: "evento", eventoId: evId }, true);
    await criarLink(
      db,
      U,
      cid,
      linkSchema.parse({
        tipo: "EDITAL_ABERTURA",
        rotulo: "SENTINELA-LINK-ROTULO",
        url: "https://ex.com/sentinela-link",
      }),
    );
    await criarResultadoFase(
      db,
      U,
      cid,
      resultadoFaseSchema.parse({
        ...VALORES_INICIAIS_RESULTADO_FASE,
        nota: "85",
        descricao: "SENTINELA-RESULTADO",
        observacao: "SENTINELA-RESULTADO-OBS",
      }),
    );

    const { token } = await ativarCompartilhamento(db, U, cid);
    const dto = await obterConcursoCompartilhado(db, SEM_LOGIN, token);
    expect(dto).not.toBeNull();
    if (!dto) return;

    expect(Object.keys(dto).sort()).toEqual([
      "banca",
      "cargo",
      "cidade",
      "cor",
      "esfera",
      "eventos",
      "historico",
      "icone",
      "orgao",
      "status",
      "statusDesde",
      "uf",
      "validade",
    ]);
    expect(Object.keys(dto.validade).sort()).toEqual([
      "homologacaoData",
      "validadeFimManual",
      "validadeMeses",
      "validadeProrrogada",
    ]);
    expect(dto.eventos).toHaveLength(1);
    expect(Object.keys(dto.eventos[0] ?? {}).sort()).toEqual([
      "concluido",
      "data",
      "hora",
      "tipo",
      "titulo",
    ]);
    expect(dto.historico).toHaveLength(2);
    for (const h of dto.historico) {
      expect(Object.keys(h).sort()).toEqual(["alteradoEm", "de", "para"]);
    }

    const serializado = JSON.stringify(dto);
    for (const s of ["SENTINELA", "sentinela", "ana@x.com", "1400000", "13000", "SUPERIOR"]) {
      expect(serializado).not.toContain(s);
    }
    expect(dto.cor).toBe("AZUL");
    expect(dto.icone).toBe("⚖️");
  });

  it("respeita donoDoTokenAutorizado (bloqueio, allowlist e papel admin)", async () => {
    const carla = await criarUsuarioTeste(db, "carla@x.com");
    const cid = await criarConcurso(
      db,
      carla,
      concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "Órgão", cargo: "Cargo" }),
    );
    const { token } = await ativarCompartilhamento(db, carla, cid);

    // Fora das listas: não autorizado.
    expect(await obterConcursoCompartilhado(db, GOOGLE, token)).toBeNull();

    // Liberada no painel: autorizado.
    await db.insert(emailPermitido).values({ email: "carla@x.com" });
    expect(await obterConcursoCompartilhado(db, GOOGLE, token)).not.toBeNull();

    // Bloqueada: não autorizado (mesmo sem login).
    await db.update(usuario).set({ bloqueadoEm: new Date() }).where(eq(usuario.id, carla));
    expect(await obterConcursoCompartilhado(db, GOOGLE, token)).toBeNull();

    // Desbloqueada e removida da allowlist: não autorizado.
    await db.update(usuario).set({ bloqueadoEm: null }).where(eq(usuario.id, carla));
    await db.delete(emailPermitido).where(eq(emailPermitido.email, "carla@x.com"));
    expect(await obterConcursoCompartilhado(db, GOOGLE, token)).toBeNull();

    // Promovida a admin: autorizado; rebaixada: não autorizado.
    await db.update(usuario).set({ papel: "ADMIN" }).where(eq(usuario.id, carla));
    expect(await obterConcursoCompartilhado(db, GOOGLE, token)).not.toBeNull();
    await db.update(usuario).set({ papel: "USUARIO" }).where(eq(usuario.id, carla));
    expect(await obterConcursoCompartilhado(db, GOOGLE, token)).toBeNull();
  });
});

describe("ciclo de vida no repositório", () => {
  it("ativar é idempotente, regenerar substitui e revogar apaga", async () => {
    const cid = await criarConcurso(
      db,
      U,
      concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "Órgão", cargo: "Cargo" }),
    );
    expect(await obterCompartilhamentoDoConcurso(db, U, cid)).toBeNull();

    const a1 = await ativarCompartilhamento(db, U, cid);
    expect(a1.criado).toBe(true);
    expect(a1.token).toHaveLength(32);

    const a2 = await ativarCompartilhamento(db, U, cid);
    expect(a2.criado).toBe(false);
    expect(a2.token).toBe(a1.token);

    const r1 = await regenerarCompartilhamento(db, U, cid);
    expect(r1.tokenAnterior).toBe(a1.token);
    expect(r1.token).not.toBe(a1.token);
    expect(await obterConcursoCompartilhado(db, SEM_LOGIN, a1.token)).toBeNull();
    expect(await obterConcursoCompartilhado(db, SEM_LOGIN, r1.token)).not.toBeNull();

    const rev = await revogarCompartilhamento(db, U, cid);
    expect(rev.tokenAnterior).toBe(r1.token);
    expect(await obterCompartilhamentoDoConcurso(db, U, cid)).toBeNull();
    expect(await obterConcursoCompartilhado(db, SEM_LOGIN, r1.token)).toBeNull();
    expect(await revogarCompartilhamento(db, U, cid)).toEqual({ tokenAnterior: null });
  });
});
