/**
 * `usuarioAtual` (#108): registra o último acesso real e não derruba a requisição se a escrita
 * falhar. Banco real em memória, sem login configurado (uso local: sempre o usuário inicial).
 */
import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarBancoTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { ID_USUARIO_INICIAL } from "../db/schema";
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
