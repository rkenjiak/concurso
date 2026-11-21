/**
 * Testes da Server Action `excluirConcurso` (#124, #129): sem link compartilhado, só chama
 * `refresh()` (nunca `revalidatePath`); com link compartilhado, invalida exatamente o caminho do
 * token anterior; concurso inexistente ou de outro usuário não altera nem revalida nada.
 */
import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import type { UsuarioSessao } from "../auth/acesso";
import { criarBancoTeste, criarUsuarioTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { ID_USUARIO_INICIAL } from "../db/schema";
import { ativarCompartilhamento } from "../repositories/compartilhamento";
import { criarConcurso } from "../repositories/concursos";
import { obterUsuario } from "../repositories/usuarios";

const estado = vi.hoisted(() => ({
  db: null as unknown as Db,
  usuario: null as UsuarioSessao | null,
  refresh: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("../db/client", async (original) => ({
  ...(await original<typeof import("../db/client")>()),
  getDb: () => estado.db,
}));
vi.mock("next/cache", () => ({
  refresh: estado.refresh,
  revalidatePath: estado.revalidatePath,
}));
vi.mock("next/navigation", () => ({
  unstable_rethrow: () => {},
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("../auth/acesso", () => ({
  MENSAGEM_SESSAO_EXPIRADA: "Sessão expirada. Entre novamente para continuar.",
  exigirUsuarioAcao: async () =>
    estado.usuario
      ? { ok: true, usuario: estado.usuario }
      : { ok: false, erros: { _form: ["Sessão expirada."] } },
}));

const { excluirConcurso } = await import("./concursos");

let client: Client;
let bia: number;
let concursoAna: number;

beforeEach(async () => {
  ({ db: estado.db, client } = await criarBancoTeste());
  const ana = await obterUsuario(estado.db, ID_USUARIO_INICIAL);
  if (!ana) throw new Error("usuário inicial ausente");
  estado.usuario = {
    id: ana.id,
    email: ana.email,
    nome: ana.nome,
    avatarUrl: ana.avatarUrl,
    papel: ana.papel,
  };
  bia = await criarUsuarioTeste(estado.db, "bia@x.com");
  concursoAna = await criarConcurso(
    estado.db,
    ID_USUARIO_INICIAL,
    concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "TRF", cargo: "Analista" }),
  );
  estado.refresh.mockClear();
  estado.revalidatePath.mockClear();
});

afterEach(() => client.close());

describe("excluirConcurso (#124, #129)", () => {
  it("sem compartilhamento, usa apenas refresh() e nunca revalidatePath (#124)", async () => {
    await expect(excluirConcurso(concursoAna)).rejects.toThrow(
      "REDIRECT /concursos?aviso=concurso-excluido",
    );
    expect(estado.refresh).toHaveBeenCalledOnce();
    expect(estado.revalidatePath).not.toHaveBeenCalled();
  });

  it("com compartilhamento, invalida exatamente /compartilhado/<token> e chama refresh() (#129)", async () => {
    const { token } = await ativarCompartilhamento(estado.db, ID_USUARIO_INICIAL, concursoAna);
    await expect(excluirConcurso(concursoAna)).rejects.toThrow(
      "REDIRECT /concursos?aviso=concurso-excluido",
    );
    expect(estado.revalidatePath).toHaveBeenCalledExactlyOnceWith(`/compartilhado/${token}`);
    expect(estado.refresh).toHaveBeenCalledOnce();
  });

  it("concurso de outro usuário ou ID inválido não exclui nem revalida", async () => {
    await ativarCompartilhamento(estado.db, ID_USUARIO_INICIAL, concursoAna);
    estado.usuario = { id: bia, email: "bia@x.com", nome: null, avatarUrl: null, papel: "USUARIO" };

    expect(await excluirConcurso(concursoAna)).toEqual({
      ok: false,
      erros: { _form: ["Concurso não encontrado."] },
    });
    expect(await excluirConcurso("abc")).toEqual({
      ok: false,
      erros: { _form: ["Concurso não encontrado."] },
    });
    expect(estado.revalidatePath).not.toHaveBeenCalled();
    expect(estado.refresh).not.toHaveBeenCalled();
  });
});
