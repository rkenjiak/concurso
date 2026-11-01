import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarBancoTeste, criarUsuarioTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { emailPermitido, ID_USUARIO_INICIAL, usuario } from "../db/schema";
import { decidirLoginGoogle, usuarioDaSessao } from "./autorizacao";
import type { ConfigAuth } from "./config";

let db: Db;
let client: Client;
let bia: number;

const base = {
  habilitada: true as const,
  segredo: new Uint8Array(32),
  emailsAdmin: new Set(["ana@x.com"]),
  emailsPermitidos: new Set(["bia@x.com"]),
};
const GOOGLE: ConfigAuth = { ...base, senha: null, google: { clientId: "c", clientSecret: "s" } };
const SENHA: ConfigAuth = { ...base, senha: "senha", google: null };

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
  await db
    .update(usuario)
    .set({ email: "ana@x.com", googleSub: "g-ana" })
    .where(eq(usuario.id, ID_USUARIO_INICIAL));
  bia = await criarUsuarioTeste(db, "bia@x.com");
  await db.update(usuario).set({ googleSub: "g-bia" }).where(eq(usuario.id, bia));
});

afterEach(() => client.close());

const bloquear = (id: number) =>
  db.update(usuario).set({ bloqueadoEm: new Date() }).where(eq(usuario.id, id));

describe("usuarioDaSessao", () => {
  it("sem login, é sempre o usuário inicial (o bloqueio não se aplica)", async () => {
    await bloquear(ID_USUARIO_INICIAL);
    expect((await usuarioDaSessao(db, { habilitada: false }, null))?.id).toBe(ID_USUARIO_INICIAL);
  });

  it("aceita sessão Google de e-mail autorizado e recusa sem sessão", async () => {
    expect((await usuarioDaSessao(db, GOOGLE, { usuarioId: bia, metodo: "google" }))?.id).toBe(bia);
    expect(await usuarioDaSessao(db, GOOGLE, null)).toBeNull();
  });

  it("usuário bloqueado perde a sessão existente (Google e senha)", async () => {
    await bloquear(bia);
    expect(await usuarioDaSessao(db, GOOGLE, { usuarioId: bia, metodo: "google" })).toBeNull();
    await bloquear(ID_USUARIO_INICIAL);
    expect(
      await usuarioDaSessao(db, SENHA, { usuarioId: ID_USUARIO_INICIAL, metodo: "senha" }),
    ).toBeNull();
  });

  it("vale a allowlist do painel; sem ela nem nas variáveis, perde o acesso", async () => {
    const carla = await criarUsuarioTeste(db, "carla@x.com");
    const sessao = { usuarioId: carla, metodo: "google" as const };
    expect(await usuarioDaSessao(db, GOOGLE, sessao)).toBeNull();
    await db.insert(emailPermitido).values({ email: "carla@x.com" });
    expect((await usuarioDaSessao(db, GOOGLE, sessao))?.id).toBe(carla);
    await db.delete(emailPermitido);
    expect(await usuarioDaSessao(db, GOOGLE, sessao)).toBeNull();
  });

  it("admin no banco tem acesso mesmo fora das listas", async () => {
    const carla = await criarUsuarioTeste(db, "carla@x.com");
    await db.update(usuario).set({ papel: "ADMIN" }).where(eq(usuario.id, carla));
    expect((await usuarioDaSessao(db, GOOGLE, { usuarioId: carla, metodo: "google" }))?.id).toBe(
      carla,
    );
  });
});

describe("decidirLoginGoogle", () => {
  it("autoriza pelas variáveis, pelo painel ou por já ser admin", async () => {
    expect(await decidirLoginGoogle(db, GOOGLE, { sub: "novo", email: "bia@x.com" })).toBe("ok");
    expect(await decidirLoginGoogle(db, GOOGLE, { sub: "novo", email: "dani@x.com" })).toBe(
      "nao_autorizado",
    );
    await db.insert(emailPermitido).values({ email: "dani@x.com" });
    expect(await decidirLoginGoogle(db, GOOGLE, { sub: "novo", email: "dani@x.com" })).toBe("ok");

    const eva = await criarUsuarioTeste(db, "eva@x.com");
    await db.update(usuario).set({ papel: "ADMIN" }).where(eq(usuario.id, eva));
    expect(await decidirLoginGoogle(db, GOOGLE, { sub: "g-eva", email: "eva@x.com" })).toBe("ok");
  });

  it("recusa conta bloqueada, encontrada pela conta Google ou pelo e-mail", async () => {
    await bloquear(bia);
    expect(await decidirLoginGoogle(db, GOOGLE, { sub: "g-bia", email: "outro@x.com" })).toBe(
      "bloqueado",
    );
    expect(await decidirLoginGoogle(db, GOOGLE, { sub: "novo", email: "bia@x.com" })).toBe(
      "bloqueado",
    );
  });
});
