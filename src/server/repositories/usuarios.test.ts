import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { ID_USUARIO_INICIAL, usuario } from "../db/schema";
import {
  entrarComGoogle,
  gerarTokenMcp,
  obterUsuario,
  PREFIXO_TOKEN_MCP,
  resumoTokenMcp,
  revogarTokenMcp,
  usuarioDoTokenMcp,
} from "./usuarios";

let db: Db;
beforeEach(async () => {
  ({ db } = await criarBancoTeste());
});

const perfil = (sub: string, email: string) => ({
  sub,
  email,
  nome: `Pessoa ${sub}`,
  avatarUrl: null,
});
const AGORA = new Date("2026-11-01T12:00:00Z");

describe("usuário inicial", () => {
  it("é criado pela migração como admin sem e-mail", async () => {
    expect(await obterUsuario(db, ID_USUARIO_INICIAL)).toMatchObject({
      id: ID_USUARIO_INICIAL,
      email: null,
      googleSub: null,
      papel: "ADMIN",
    });
  });
});

describe("entrarComGoogle", () => {
  it("o primeiro admin assume o usuário inicial; os seguintes criam usuários novos", async () => {
    const admin = await entrarComGoogle(db, perfil("g1", "admin@x.com"), true, AGORA);
    expect(admin).toMatchObject({
      id: ID_USUARIO_INICIAL,
      email: "admin@x.com",
      googleSub: "g1",
      nome: "Pessoa g1",
      papel: "ADMIN",
      ultimoAcessoEm: AGORA,
    });
    const outroAdmin = await entrarComGoogle(db, perfil("g2", "admin2@x.com"), true, AGORA);
    expect(outroAdmin.id).not.toBe(ID_USUARIO_INICIAL);
    expect(outroAdmin.papel).toBe("ADMIN");
  });

  it("um usuário comum nunca assume o usuário inicial", async () => {
    const u = await entrarComGoogle(db, perfil("g1", "ana@x.com"), false, AGORA);
    expect(u.id).not.toBe(ID_USUARIO_INICIAL);
    expect(u.papel).toBe("USUARIO");
    expect((await obterUsuario(db, ID_USUARIO_INICIAL))?.email).toBeNull();
  });

  it("reencontra pela conta Google (mesmo com e-mail trocado) ou vincula pelo e-mail", async () => {
    const u = await entrarComGoogle(db, perfil("g1", "ana@x.com"), false, AGORA);
    const mesmo = await entrarComGoogle(db, perfil("g1", "ana.nova@x.com"), false, AGORA);
    expect(mesmo).toMatchObject({ id: u.id, email: "ana.nova@x.com" });

    const [criado] = await db
      .insert(usuario)
      .values({ email: "bia@x.com" })
      .returning({ id: usuario.id });
    const vinculado = await entrarComGoogle(db, perfil("g9", "bia@x.com"), false, AGORA);
    expect(vinculado).toMatchObject({ id: criado?.id, googleSub: "g9" });
  });

  it("promove a admin quem entra pelo ADMIN_EMAILS e não rebaixa depois", async () => {
    const u = await entrarComGoogle(db, perfil("g1", "ana@x.com"), false, AGORA);
    await db.update(usuario).set({ email: null, googleSub: "outro" }).where(eq(usuario.id, 1));
    expect((await entrarComGoogle(db, perfil("g1", "ana@x.com"), true, AGORA)).papel).toBe("ADMIN");
    const depois = await entrarComGoogle(db, perfil("g1", "ana@x.com"), false, AGORA);
    expect(depois).toMatchObject({ id: u.id, papel: "ADMIN" });
  });
});

describe("token do MCP", () => {
  it("guarda só o resumo, identifica o dono e é trocado ou revogado", async () => {
    const token = await gerarTokenMcp(db, ID_USUARIO_INICIAL);
    expect(token.startsWith(PREFIXO_TOKEN_MCP)).toBe(true);
    expect(token.length).toBeGreaterThan(40);
    const dono = await obterUsuario(db, ID_USUARIO_INICIAL);
    expect(dono?.mcpTokenHash).toBe(resumoTokenMcp(token));
    expect((await usuarioDoTokenMcp(db, token))?.id).toBe(ID_USUARIO_INICIAL);
    expect(await usuarioDoTokenMcp(db, `${token}x`)).toBeNull();

    const novo = await gerarTokenMcp(db, ID_USUARIO_INICIAL);
    expect(await usuarioDoTokenMcp(db, token)).toBeNull();
    expect((await usuarioDoTokenMcp(db, novo))?.id).toBe(ID_USUARIO_INICIAL);

    await revogarTokenMcp(db, ID_USUARIO_INICIAL);
    expect(await usuarioDoTokenMcp(db, novo)).toBeNull();
  });
});
