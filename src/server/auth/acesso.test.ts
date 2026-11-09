/**
 * `usuarioAtual` (#108): registra o último acesso real e não derruba a requisição se a escrita
 * falhar. Banco real em memória, sem login configurado (uso local: sempre o usuário inicial).
 */
import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { ID_USUARIO_INICIAL, usuario } from "../db/schema";
import { log } from "../log";
import * as usuarios from "../repositories/usuarios";

const estado = vi.hoisted(() => ({ db: null as unknown as Db }));

vi.mock("../db/client", async (original) => ({
  ...(await original<typeof import("../db/client")>()),
  getDb: () => estado.db,
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("../repositories/usuarios", async (original) => {
  const real = await original<typeof import("../repositories/usuarios")>();
  return { ...real, registrarAcessoSessao: vi.fn(real.registrarAcessoSessao) };
});

const { usuarioAtual } = await import("./acesso");

let client: Client;

beforeEach(async () => {
  ({ db: estado.db, client } = await criarBancoTeste());
  // Sem login configurado: `usuarioAtual` é sempre o usuário inicial.
  vi.stubEnv("APP_PASSWORD", "");
  vi.stubEnv("GOOGLE_CLIENT_ID", "");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  client.close();
});

describe("usuarioAtual (#108)", () => {
  it("grava o último acesso do usuário", async () => {
    expect((await usuarios.obterUsuario(estado.db, ID_USUARIO_INICIAL))?.ultimoAcessoEm).toBeNull();
    expect((await usuarioAtual())?.id).toBe(ID_USUARIO_INICIAL);
    const u = await usuarios.obterUsuario(estado.db, ID_USUARIO_INICIAL);
    expect(u?.ultimoAcessoEm).toBeInstanceOf(Date);
  });

  it("dentro da janela de 15 min nem tenta escrever; fora dela, escreve", async () => {
    const registrar = vi.mocked(usuarios.registrarAcessoSessao);
    const definirAcesso = (ms: number) =>
      estado.db
        .update(usuario)
        .set({ ultimoAcessoEm: new Date(Date.now() - ms) })
        .where(eq(usuario.id, ID_USUARIO_INICIAL));
    registrar.mockClear();
    await definirAcesso(60_000);
    await usuarioAtual();
    expect(registrar).not.toHaveBeenCalled();

    await definirAcesso(usuarios.JANELA_REGISTRO_USO_MS + 60_000);
    await usuarioAtual();
    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it("se o registro falhar, resolve normalmente e só avisa no log", async () => {
    vi.mocked(usuarios.registrarAcessoSessao).mockRejectedValueOnce(new Error("readonly"));
    const aviso = vi.spyOn(log, "warn").mockImplementation(() => {});
    expect((await usuarioAtual())?.id).toBe(ID_USUARIO_INICIAL);
    expect(aviso).toHaveBeenCalledWith(
      "auth.registro_acesso_falhou",
      expect.objectContaining({ canal: "sessao", usuarioId: ID_USUARIO_INICIAL }),
    );
  });
});
