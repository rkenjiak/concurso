import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErroDominio } from "@/domain/erros";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import { criarBancoTeste, criarUsuarioTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { ID_USUARIO_INICIAL, usuario } from "../db/schema";
import {
  adicionarEmailPermitido,
  definirBloqueio,
  definirPapel,
  listarAuditoria,
  listarEmailsPermitidos,
  listarUsuarios,
  MENSAGENS_ADMIN,
  obterResumo,
  removerEmailPermitido,
} from "./admin";
import { criarConcurso } from "./concursos";
import {
  emailNaAllowlist,
  gerarTokenIcs,
  gerarTokenMcp,
  obterUsuario,
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
