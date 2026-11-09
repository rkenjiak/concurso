import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErroDominio } from "@/domain/erros";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import { eventoSchema, VALORES_INICIAIS_EVENTO } from "@/lib/schemas/evento";
import { linkSchema } from "@/lib/schemas/link";
import { resultadoFaseSchema, VALORES_INICIAIS_RESULTADO_FASE } from "@/lib/schemas/resultado-fase";
import { criarBancoTeste, criarUsuarioTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { ID_USUARIO_INICIAL, usuario } from "../db/schema";
import {
  adicionarEmailPermitido,
  definirBloqueio,
  definirPapel,
  ehEmailAdminFixo,
  listarAuditoria,
  listarEmailsPermitidos,
  listarUsuarios,
  MENSAGENS_ADMIN,
  obterDetalheUsuario,
  obterResumo,
  removerEmailPermitido,
  revogarTokens,
} from "./admin";
import { criarConcurso } from "./concursos";
import { criarEvento } from "./eventos";
import { criarLink } from "./links";
import { criarResultadoFase } from "./resultados";
import {
  emailNaAllowlist,
  entrarComGoogle,
  gerarTokenIcs,
  gerarTokenMcp,
  obterUsuario,
  registrarUsoToken,
  usuarioDoTokenIcs,
  usuarioDoTokenMcp,
} from "./usuarios";

let db: Db;
let client: Client;
let bia: number;
const AGORA = new Date("2026-11-01T12:00:00Z");
const SEM_FIXOS = { emailsAdminFixos: new Set<string>() };

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
  await db
    .update(usuario)
    .set({ email: "ana@x.com", nome: "Ana" })
    .where(eq(usuario.id, ID_USUARIO_INICIAL));
  bia = await criarUsuarioTeste(db, "bia@x.com");
});

afterEach(() => client.close());

const ana = { id: ID_USUARIO_INICIAL, email: "ana@x.com", nome: "Ana" };
const papel = async (id: number) => (await obterUsuario(db, id))?.papel;
const bloqueado = async (id: number) => (await obterUsuario(db, id))?.bloqueadoEm ?? null;

describe("leituras do painel", () => {
  it("lista usuários com o número de concursos e resume a instância", async () => {
    await criarConcurso(
      db,
      bia,
      concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "TRF", cargo: "Analista" }),
    );
    expect((await listarUsuarios(db)).map((u) => [u.email, u.papel, u.totalConcursos])).toEqual([
      ["ana@x.com", "ADMIN", 0],
      ["bia@x.com", "USUARIO", 1],
    ]);
    expect(await obterResumo(db)).toEqual({
      usuarios: 2,
      admins: 1,
      bloqueados: 0,
      concursos: 1,
      eventos: 0,
      emailsPermitidos: 0,
      ativos7Dias: 0,
      ativos30Dias: 0,
      comTokenMcp: 0,
      comFeedIcs: 0,
    });
  });

  it("conta ativos em 7 e 30 dias e tokens ativos, e lista o uso sem o resumo (#108)", async () => {
    const carla = await criarUsuarioTeste(db, "carla@x.com");
    const dias = (n: number) => new Date(AGORA.getTime() - n * 24 * 60 * 60 * 1000);
    await db
      .update(usuario)
      .set({ ultimoAcessoEm: dias(1) })
      .where(eq(usuario.id, ana.id));
    await db
      .update(usuario)
      .set({ ultimoAcessoEm: dias(10) })
      .where(eq(usuario.id, bia));
    await db
      .update(usuario)
      .set({ ultimoAcessoEm: dias(40) })
      .where(eq(usuario.id, carla));
    const mcp = await gerarTokenMcp(db, bia);
    await gerarTokenIcs(db, bia);
    await gerarTokenIcs(db, carla);

    expect(await obterResumo(db, AGORA)).toMatchObject({ ativos7Dias: 1, ativos30Dias: 2 });
    // O uso do MCP (há 2 dias) também conta como acesso.
    await registrarUsoToken(db, bia, "mcp", mcp, dias(2));
    expect(await obterResumo(db, AGORA)).toMatchObject({
      ativos7Dias: 2,
      ativos30Dias: 2,
      comTokenMcp: 1,
      comFeedIcs: 2,
    });
    const linhaBia = (await listarUsuarios(db)).find((u) => u.id === bia);
    expect(linhaBia).toMatchObject({
      ultimoAcessoEm: dias(2),
      mcpTokenAtivo: true,
      mcpTokenUsadoEm: dias(2),
      icsTokenAtivo: true,
      icsTokenUsadoEm: null,
    });
    expect(linhaBia).not.toHaveProperty("mcpTokenHash");
    expect(linhaBia).not.toHaveProperty("icsTokenHash");

    // Bloqueado não conta como token ativo (o bloqueio apaga os tokens).
    await definirBloqueio(db, ana, bia, true, SEM_FIXOS, AGORA);
    // Bloqueado não conta como ativo, como nos cartões de token.
    expect(await obterResumo(db, AGORA)).toMatchObject({
      ativos7Dias: 1,
      ativos30Dias: 1,
      comTokenMcp: 0,
      comFeedIcs: 1,
    });
  });
});

describe("definirPapel", () => {
  it("promove e rebaixa, registrando na auditoria", async () => {
    await definirPapel(db, ana, bia, "ADMIN", SEM_FIXOS, AGORA);
    expect(await papel(bia)).toBe("ADMIN");
    await definirPapel(db, ana, bia, "USUARIO", SEM_FIXOS, AGORA);
    expect(await papel(bia)).toBe("USUARIO");
    expect(
      (await listarAuditoria(db)).map((r) => [r.admin, r.acao, r.alvo, r.alvoUsuarioId]),
    ).toEqual([
      ["ana@x.com", "REBAIXAR_ADMIN", "bia@x.com", bia],
      ["ana@x.com", "PROMOVER_ADMIN", "bia@x.com", bia],
    ]);
  });

  it("sem mudança não altera nem audita", async () => {
    await definirPapel(db, ana, bia, "USUARIO", SEM_FIXOS, AGORA);
    expect(await listarAuditoria(db)).toEqual([]);
  });

  it("não rebaixa o último admin ativo, nem a si mesmo", async () => {
    await expect(definirPapel(db, ana, ana.id, "USUARIO", SEM_FIXOS)).rejects.toThrow(
      MENSAGENS_ADMIN.ultimoAdmin,
    );
    expect(await papel(ana.id)).toBe("ADMIN");

    // Outro admin bloqueado não conta como ativo.
    await definirPapel(db, ana, bia, "ADMIN", SEM_FIXOS);
    await definirBloqueio(db, ana, bia, true, SEM_FIXOS);
    await expect(definirPapel(db, ana, ana.id, "USUARIO", SEM_FIXOS)).rejects.toThrow(ErroDominio);

    // Com outro admin ativo, pode se rebaixar.
    await definirBloqueio(db, ana, bia, false, SEM_FIXOS);
    await definirPapel(db, ana, ana.id, "USUARIO", SEM_FIXOS);
    expect(await papel(ana.id)).toBe("USUARIO");
  });

  it("não rebaixa admin de ADMIN_EMAILS nem promove bloqueado", async () => {
    await definirPapel(db, ana, bia, "ADMIN", SEM_FIXOS);
    const fixos = { emailsAdminFixos: new Set(["bia@x.com"]) };
    await expect(definirPapel(db, ana, bia, "USUARIO", fixos)).rejects.toThrow(
      MENSAGENS_ADMIN.adminFixo,
    );
    const carla = await criarUsuarioTeste(db, "carla@x.com");
    await definirBloqueio(db, ana, carla, true, SEM_FIXOS);
    await expect(definirPapel(db, ana, carla, "ADMIN", SEM_FIXOS)).rejects.toThrow(
      MENSAGENS_ADMIN.promoverBloqueado,
    );
  });

  it("recusa usuário inexistente", async () => {
    await expect(definirPapel(db, ana, 999, "ADMIN", SEM_FIXOS)).rejects.toThrow(
      MENSAGENS_ADMIN.usuarioNaoEncontrado,
    );
  });
});

describe("definirBloqueio", () => {
  it("desbloquear não reativa tokens guardados de um bloqueio anterior ao #96", async () => {
    const token = await gerarTokenMcp(db, bia);
    const tokenIcs = await gerarTokenIcs(db, bia);
    // Estado legado: bloqueado por uma versão que não apagava os tokens.
    await db.update(usuario).set({ bloqueadoEm: AGORA }).where(eq(usuario.id, bia));
    await definirBloqueio(db, ana, bia, false, SEM_FIXOS, AGORA);
    expect(await usuarioDoTokenMcp(db, token)).toBeNull();
    expect(await usuarioDoTokenIcs(db, tokenIcs)).toBeNull();
  });

  it("bloquear e desbloquear zeram o último uso dos tokens (#108)", async () => {
    const usoTokens = async () => {
      const u = await obterUsuario(db, bia);
      return [u?.mcpTokenUsadoEm ?? null, u?.icsTokenUsadoEm ?? null];
    };
    await registrarUsoToken(db, bia, "mcp", await gerarTokenMcp(db, bia), AGORA);
    await registrarUsoToken(db, bia, "ics", await gerarTokenIcs(db, bia), AGORA);
    expect(await usoTokens()).toEqual([AGORA, AGORA]);
    await definirBloqueio(db, ana, bia, true, SEM_FIXOS, AGORA);
    expect(await usoTokens()).toEqual([null, null]);
    // Estado legado: bloqueado com o uso ainda gravado.
    await db
      .update(usuario)
      .set({ mcpTokenUsadoEm: AGORA, icsTokenUsadoEm: AGORA })
      .where(eq(usuario.id, bia));
    await definirBloqueio(db, ana, bia, false, SEM_FIXOS, AGORA);
    expect(await usoTokens()).toEqual([null, null]);
  });

  it("bloqueia e desbloqueia; o bloqueio revoga os tokens do MCP e do .ics (#96)", async () => {
    const token = await gerarTokenMcp(db, bia);
    const tokenIcs = await gerarTokenIcs(db, bia);
    await definirBloqueio(db, ana, bia, true, SEM_FIXOS, AGORA);
    expect(await bloqueado(bia)).toEqual(AGORA);
    expect(await usuarioDoTokenMcp(db, token)).toBeNull();
    expect(await usuarioDoTokenIcs(db, tokenIcs)).toBeNull();
    await definirBloqueio(db, ana, bia, false, SEM_FIXOS, AGORA);
    expect(await bloqueado(bia)).toBeNull();
    expect(await usuarioDoTokenMcp(db, token)).toBeNull();
    expect(await usuarioDoTokenIcs(db, tokenIcs)).toBeNull();
    expect((await usuarioDoTokenMcp(db, await gerarTokenMcp(db, bia)))?.id).toBe(bia);
    expect((await listarAuditoria(db)).map((r) => r.acao)).toEqual([
      "DESBLOQUEAR_USUARIO",
      "BLOQUEAR_USUARIO",
    ]);
  });

  it("não bloqueia a si mesmo, o último admin ativo nem admin de ADMIN_EMAILS", async () => {
    await expect(definirBloqueio(db, ana, ana.id, true, SEM_FIXOS)).rejects.toThrow(
      MENSAGENS_ADMIN.bloquearSiMesmo,
    );
    // Bia (admin) tenta bloquear Ana, a única outra admin… depois de Ana ser a última ativa.
    await definirPapel(db, ana, bia, "ADMIN", SEM_FIXOS);
    const biaAdmin = { id: bia, email: "bia@x.com", nome: null };
    await definirBloqueio(db, biaAdmin, ana.id, true, SEM_FIXOS);
    expect(await bloqueado(ana.id)).not.toBeNull();
    // Agora Bia é a última admin ativa: ninguém a bloqueia (nem um admin bloqueado).
    await expect(definirBloqueio(db, ana, bia, true, SEM_FIXOS)).rejects.toThrow(
      MENSAGENS_ADMIN.ultimoAdmin,
    );
    await definirBloqueio(db, biaAdmin, ana.id, false, SEM_FIXOS);
    await expect(
      definirBloqueio(db, ana, bia, true, { emailsAdminFixos: new Set(["bia@x.com"]) }),
    ).rejects.toThrow(MENSAGENS_ADMIN.adminFixo);
    expect(await bloqueado(bia)).toBeNull();
  });
});

describe("allowlist do painel", () => {
  it("adiciona (normalizado), lista, recusa repetido e remove, auditando", async () => {
    await adicionarEmailPermitido(db, ana, "  Carla@X.com ", AGORA);
    expect(await emailNaAllowlist(db, "carla@x.com")).toBe(true);
    expect(await listarEmailsPermitidos(db)).toEqual([
      { email: "carla@x.com", adicionadoPor: "ana@x.com", createdAt: AGORA },
    ]);
    await expect(adicionarEmailPermitido(db, ana, "carla@x.com")).rejects.toThrow(
      MENSAGENS_ADMIN.emailRepetido,
    );
    await removerEmailPermitido(db, ana, "CARLA@x.com", AGORA);
    expect(await emailNaAllowlist(db, "carla@x.com")).toBe(false);
    await expect(removerEmailPermitido(db, ana, "carla@x.com")).rejects.toThrow(
      MENSAGENS_ADMIN.emailAusente,
    );
    expect((await listarAuditoria(db)).map((r) => [r.acao, r.alvo])).toEqual([
      ["REMOVER_EMAIL", "carla@x.com"],
      ["PERMITIR_EMAIL", "carla@x.com"],
    ]);
  });
});

describe("detalhe do usuário (#108)", () => {
  it("devolve só flags, datas e contagens agregadas; null para ID inexistente", async () => {
    const concursoId = await criarConcurso(
      db,
      bia,
      concursoSchema.parse({
        ...VALORES_INICIAIS_CONCURSO,
        orgao: "Órgão secreto da Bia",
        cargo: "Cargo secreto",
        observacoes: "observação secreta",
      }),
    );
    await criarEvento(
      db,
      bia,
      concursoId,
      eventoSchema.parse({
        ...VALORES_INICIAIS_EVENTO,
        tipo: "PROVA_OBJETIVA",
        data: "2026-12-01",
      }),
    );
    await criarLink(
      db,
      bia,
      concursoId,
      linkSchema.parse({ tipo: "EDITAL_ABERTURA", rotulo: "", url: "https://ex.com/secreto" }),
    );
    await criarResultadoFase(
      db,
      bia,
      concursoId,
      resultadoFaseSchema.parse({ ...VALORES_INICIAIS_RESULTADO_FASE, nota: "80" }),
    );
    // Concurso de outra pessoa não entra nas contagens.
    await criarConcurso(
      db,
      ana.id,
      concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "TRF", cargo: "Analista" }),
    );
    await db.update(usuario).set({ googleSub: "g-bia" }).where(eq(usuario.id, bia));
    await adicionarEmailPermitido(db, ana, "bia@x.com", AGORA);
    const token = await gerarTokenMcp(db, bia);

    const detalhe = await obterDetalheUsuario(db, bia);
    expect(detalhe).toMatchObject({
      id: bia,
      email: "bia@x.com",
      googleVinculado: true,
      emailNoPainel: true,
      mcpTokenAtivo: true,
      icsTokenAtivo: false,
      contagens: { concursos: 1, eventos: 1, links: 1, resultados: 1 },
    });
    expect(await obterDetalheUsuario(db, 9999)).toBeNull();

    // Isolamento: nenhuma leitura do painel devolve conteúdo de concursos nem segredos.
    const lido = JSON.stringify([detalhe, await listarUsuarios(db), await obterResumo(db)]);
    for (const proibido of ["secret", "TRF", "Analista", "ex.com", "g-bia", token]) {
      expect(lido).not.toContain(proibido);
    }
    expect(lido).not.toMatch(/TokenHash|googleSub/);
  });

  it("listagem marca o e-mail liberado no painel", async () => {
    await adicionarEmailPermitido(db, ana, "bia@x.com", AGORA);
    expect((await listarUsuarios(db)).map((u) => [u.email, u.emailNoPainel])).toEqual([
      ["ana@x.com", false],
      ["bia@x.com", true],
    ]);
  });

  it("allowlist e ADMIN_EMAILS casam com o e-mail como o login o grava (normalizado)", async () => {
    // O painel normaliza ao liberar; o login Google grava o e-mail já normalizado (`lerPerfil`).
    await adicionarEmailPermitido(db, ana, "  Carla@X.com ", AGORA);
    const carla = await entrarComGoogle(
      db,
      { sub: "g-carla", email: "carla@x.com", nome: null, avatarUrl: null },
      false,
      AGORA,
    );
    expect((await obterDetalheUsuario(db, carla.id))?.emailNoPainel).toBe(true);
    expect(ehEmailAdminFixo(" ANA@x.com", new Set(["ana@x.com"]))).toBe(true);
    expect(ehEmailAdminFixo(null, new Set(["ana@x.com"]))).toBe(false);
  });
});

describe("revogarTokens (#108)", () => {
  it("revoga MCP e .ics, zera o último uso, não bloqueia e audita", async () => {
    const mcp = await gerarTokenMcp(db, bia);
    const ics = await gerarTokenIcs(db, bia);
    await registrarUsoToken(db, bia, "mcp", mcp, AGORA);
    await registrarUsoToken(db, bia, "ics", ics, AGORA);

    expect(await revogarTokens(db, ana, bia, AGORA)).toBe(true);
    expect(await usuarioDoTokenMcp(db, mcp)).toBeNull();
    expect(await usuarioDoTokenIcs(db, ics)).toBeNull();
    const alvo = await obterUsuario(db, bia);
    expect(alvo).toMatchObject({
      bloqueadoEm: null,
      mcpTokenUsadoEm: null,
      icsTokenUsadoEm: null,
      // O último acesso não é apagado: só o uso dos tokens.
      ultimoAcessoEm: AGORA,
    });
    const [registro] = await listarAuditoria(db);
    expect(registro).toMatchObject({
      acao: "REVOGAR_TOKENS",
      adminId: ana.id,
      alvoUsuarioId: bia,
      alvo: "bia@x.com",
      createdAt: AGORA,
    });
    // Continua podendo gerar outro.
    expect((await usuarioDoTokenMcp(db, await gerarTokenMcp(db, bia)))?.id).toBe(bia);
  });

  it("sem tokens ativos não faz nada nem audita; ID inexistente é erro", async () => {
    expect(await revogarTokens(db, ana, bia, AGORA)).toBe(false);
    expect(await listarAuditoria(db)).toEqual([]);
    await expect(revogarTokens(db, ana, 9999, AGORA)).rejects.toThrow(
      MENSAGENS_ADMIN.usuarioNaoEncontrado,
    );
  });

  it("basta um dos tokens ativo", async () => {
    await gerarTokenIcs(db, bia);
    expect(await revogarTokens(db, ana, bia, AGORA)).toBe(true);
    expect((await obterUsuario(db, bia))?.icsTokenHash).toBeNull();
  });
});
