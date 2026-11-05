/**
 * Autorização das Server Actions e páginas do painel admin (#50): o papel é relido do banco a
 * cada chamada e a visão escolhida (cookie) nunca concede acesso. Os módulos do Next e o usuário
 * da requisição são simulados; o banco é real (em memória).
 */
import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UsuarioSessao } from "../auth/acesso";
import { criarBancoTeste, criarUsuarioTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { ID_USUARIO_INICIAL, usuario } from "../db/schema";
import { emailNaAllowlist, obterUsuario } from "../repositories/usuarios";

const estado = vi.hoisted(() => ({
  db: null as unknown as Db,
  usuario: null as UsuarioSessao | null,
  cookies: new Map<string, string>(),
}));

vi.mock("../db/client", async (original) => ({
  ...(await original<typeof import("../db/client")>()),
  getDb: () => estado.db,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) =>
      estado.cookies.has(nome) ? { value: estado.cookies.get(nome) } : undefined,
    set: (nome: string, valor: string) => estado.cookies.set(nome, valor),
  }),
}));
vi.mock("next/navigation", () => ({
  unstable_rethrow: () => {},
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  forbidden: () => {
    throw new Error("FORBIDDEN 403");
  },
}));
vi.mock("../auth/acesso", () => ({
  MENSAGEM_SESSAO_EXPIRADA: "Sessão expirada. Entre novamente para continuar.",
  usuarioAtual: async () => estado.usuario,
  exigirUsuarioPagina: async () => {
    if (!estado.usuario) throw new Error("REDIRECT /login");
    return estado.usuario;
  },
  exigirUsuarioAcao: async () =>
    estado.usuario
      ? { ok: true, usuario: estado.usuario }
      : { ok: false, erros: { _form: ["Sessão expirada."] } },
}));

const {
  adicionarEmailPermitidoAcao,
  definirBloqueioAcao,
  definirPapelAcao,
  removerEmailPermitidoAcao,
} = await import("./admin");
const { alternarVisaoAcao } = await import("./visao");
const { exigirAdminPagina, MENSAGEM_SEM_PERMISSAO, visaoAtual } = await import("../auth/admin");

let client: Client;
let bia: number;

const sessaoDe = async (id: number): Promise<UsuarioSessao> => {
  const u = await obterUsuario(estado.db, id);
  if (!u) throw new Error("usuário ausente");
  return { id: u.id, email: u.email, nome: u.nome, avatarUrl: u.avatarUrl, papel: u.papel };
};

beforeEach(async () => {
  ({ db: estado.db, client } = await criarBancoTeste());
  await estado.db
    .update(usuario)
    .set({ email: "ana@x.com" })
    .where(eq(usuario.id, ID_USUARIO_INICIAL));
  bia = await criarUsuarioTeste(estado.db, "bia@x.com");
  estado.cookies.clear();
  estado.usuario = await sessaoDe(ID_USUARIO_INICIAL);
});

afterEach(() => client.close());

const negado = { ok: false, erros: { _form: [MENSAGEM_SEM_PERMISSAO] } };

describe("não admin", () => {
  beforeEach(async () => {
    estado.usuario = await sessaoDe(bia);
  });

  it("recebe 403 em todas as ações administrativas, mesmo com a visão admin no cookie", async () => {
    estado.cookies.set("concurso_visao", "admin");
    expect(await definirPapelAcao(bia, "ADMIN")).toEqual(negado);
    expect(await definirBloqueioAcao(ID_USUARIO_INICIAL, true)).toEqual(negado);
    expect(await adicionarEmailPermitidoAcao("x@x.com")).toEqual(negado);
    expect(await removerEmailPermitidoAcao("x@x.com")).toEqual(negado);
    expect((await obterUsuario(estado.db, bia))?.papel).toBe("USUARIO");
    expect(await emailNaAllowlist(estado.db, "x@x.com")).toBe(false);
  });

  it("recebe 403 nas páginas /admin e não escolhe a visão admin", async () => {
    estado.cookies.set("concurso_visao", "admin");
    await expect(exigirAdminPagina()).rejects.toThrow("FORBIDDEN 403");
    expect(await visaoAtual(estado.usuario as UsuarioSessao)).toBe("usuario");
    expect(await alternarVisaoAcao("admin")).toEqual(negado);
  });

  it("perde o acesso quando rebaixado, sem novo login", async () => {
    await estado.db.update(usuario).set({ papel: "ADMIN" }).where(eq(usuario.id, bia));
    estado.usuario = await sessaoDe(bia);
    await expect(exigirAdminPagina()).resolves.toMatchObject({ id: bia });
    await estado.db.update(usuario).set({ papel: "USUARIO" }).where(eq(usuario.id, bia));
    estado.usuario = await sessaoDe(bia);
    await expect(exigirAdminPagina()).rejects.toThrow("FORBIDDEN 403");
  });
});

describe("sem sessão", () => {
  it("as ações pedem login de novo", async () => {
    estado.usuario = null;
    const r = await definirPapelAcao(bia, "ADMIN");
    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.erros._form?.[0]).toMatch(/Sessão expirada/);
  });
});

describe("admin", () => {
  it("promove, bloqueia e gerencia a allowlist", async () => {
    expect(await definirPapelAcao(bia, "ADMIN")).toEqual({ ok: true, data: null });
    expect(await definirBloqueioAcao(bia, true)).toEqual({ ok: true, data: null });
    expect((await obterUsuario(estado.db, bia))?.bloqueadoEm).not.toBeNull();
    expect(await adicionarEmailPermitidoAcao(" Novo@X.com ")).toEqual({ ok: true, data: null });
    expect(await emailNaAllowlist(estado.db, "novo@x.com")).toBe(true);
    expect(await removerEmailPermitidoAcao("novo@x.com")).toEqual({ ok: true, data: null });
  });

  it("valida as entradas", async () => {
    expect((await definirPapelAcao("1", "ADMIN")).ok).toBe(false);
    expect((await definirPapelAcao(bia, "DONO")).ok).toBe(false);
    expect((await definirBloqueioAcao(bia, "sim")).ok).toBe(false);
    const r = await adicionarEmailPermitidoAcao("não é e-mail");
    expect(r.ok ? null : Object.values(r.erros).flat()).toEqual(["E-mail inválido."]);
  });

  it("não remove o último admin ativo, nem a si mesmo", async () => {
    const r = await definirPapelAcao(ID_USUARIO_INICIAL, "USUARIO");
    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.erros._form?.[0]).toMatch(/último admin ativo/);
    const b = await definirBloqueioAcao(ID_USUARIO_INICIAL, true);
    expect(b.ok ? null : b.erros._form?.[0]).toMatch(/própria conta/);
    expect((await obterUsuario(estado.db, ID_USUARIO_INICIAL))?.papel).toBe("ADMIN");
  });

  it("ao se rebaixar (havendo outro admin) volta para a visão usuário", async () => {
    await definirPapelAcao(bia, "ADMIN");
    await expect(definirPapelAcao(ID_USUARIO_INICIAL, "USUARIO")).rejects.toThrow("REDIRECT /");
  });

  it("alterna a visão sem novo login, guardando-a em cookie", async () => {
    await expect(alternarVisaoAcao("admin")).rejects.toThrow("REDIRECT /admin");
    expect(estado.cookies.get("concurso_visao")).toBe("admin");
    expect(await visaoAtual(estado.usuario as UsuarioSessao)).toBe("admin");
    await expect(exigirAdminPagina()).resolves.toMatchObject({ id: ID_USUARIO_INICIAL });
    await expect(alternarVisaoAcao("usuario")).rejects.toThrow("REDIRECT /");
    expect(await visaoAtual(estado.usuario as UsuarioSessao)).toBe("usuario");
    expect((await alternarVisaoAcao("outra")).ok).toBe(false);
  });
});
