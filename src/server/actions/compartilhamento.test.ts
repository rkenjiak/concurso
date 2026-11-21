/**
 * Testes das Server Actions de compartilhamento (#129): autenticação, validação, isolamento e
 * invalidação cirúrgica do cache ISR (`revalidatePath` só em regenerar/revogar, nunca em gerar).
 */
import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import type { UsuarioSessao } from "../auth/acesso";
import { criarBancoTeste, criarUsuarioTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { ID_USUARIO_INICIAL } from "../db/schema";
import { obterCompartilhamentoDoConcurso } from "../queries/compartilhamento";
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
vi.mock("../auth/acesso", () => ({
  MENSAGEM_SESSAO_EXPIRADA: "Sessão expirada. Entre novamente para continuar.",
  exigirUsuarioAcao: async () =>
    estado.usuario
      ? { ok: true, usuario: estado.usuario }
      : { ok: false, erros: { _form: ["Sessão expirada."] } },
}));

const { gerarCompartilhamentoAcao, regenerarCompartilhamentoAcao, revogarCompartilhamentoAcao } =
  await import("./compartilhamento");

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

describe("actions de compartilhamento (#129)", () => {
  it("exige usuário autenticado e valida o ID", async () => {
    estado.usuario = null;
    expect(await gerarCompartilhamentoAcao(concursoAna)).toMatchObject({ ok: false });
    expect(await regenerarCompartilhamentoAcao(concursoAna)).toMatchObject({ ok: false });
    expect(await revogarCompartilhamentoAcao(concursoAna)).toMatchObject({ ok: false });

    const ana = await obterUsuario(estado.db, ID_USUARIO_INICIAL);
    if (!ana) throw new Error("usuário inicial ausente");
    estado.usuario = {
      id: ana.id,
      email: ana.email,
      nome: ana.nome,
      avatarUrl: ana.avatarUrl,
      papel: ana.papel,
    };
    expect(await gerarCompartilhamentoAcao("abc")).toEqual({
      ok: false,
      erros: { _form: ["Concurso não encontrado."] },
    });
    expect(await regenerarCompartilhamentoAcao(-1)).toEqual({
      ok: false,
      erros: { _form: ["Concurso não encontrado."] },
    });
    expect(await revogarCompartilhamentoAcao(null)).toEqual({
      ok: false,
      erros: { _form: ["Concurso não encontrado."] },
    });
  });

  it("impede outro usuário de gerar, regenerar ou revogar", async () => {
    const r0 = await gerarCompartilhamentoAcao(concursoAna);
    expect(r0.ok).toBe(true);
    const tokenAna = r0.ok ? r0.data.token : "";

    estado.usuario = { id: bia, email: "bia@x.com", nome: null, avatarUrl: null, papel: "USUARIO" };
    estado.refresh.mockClear();
    estado.revalidatePath.mockClear();

    expect(await gerarCompartilhamentoAcao(concursoAna)).toMatchObject({ ok: false });
    expect(await regenerarCompartilhamentoAcao(concursoAna)).toMatchObject({ ok: false });
    expect(await revogarCompartilhamentoAcao(concursoAna)).toMatchObject({ ok: false });
    expect(estado.revalidatePath).not.toHaveBeenCalled();
    expect(
      await obterCompartilhamentoDoConcurso(estado.db, ID_USUARIO_INICIAL, concursoAna),
    ).toMatchObject({
      token: tokenAna,
    });
  });

  it("gerar usa só refresh(); regenerar e revogar invalidam o token anterior", async () => {
    const g = await gerarCompartilhamentoAcao(concursoAna);
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(estado.refresh).toHaveBeenCalledOnce();
    expect(estado.revalidatePath).not.toHaveBeenCalled();

    estado.refresh.mockClear();
    const reg = await regenerarCompartilhamentoAcao(concursoAna);
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;
    expect(reg.data.token).not.toBe(g.data.token);
    expect(estado.revalidatePath).toHaveBeenCalledExactlyOnceWith(`/compartilhado/${g.data.token}`);
    expect(estado.refresh).toHaveBeenCalledOnce();

    estado.refresh.mockClear();
    estado.revalidatePath.mockClear();
    const rev = await revogarCompartilhamentoAcao(concursoAna);
    expect(rev).toEqual({ ok: true, data: null });
    expect(estado.revalidatePath).toHaveBeenCalledExactlyOnceWith(
      `/compartilhado/${reg.data.token}`,
    );
    expect(estado.refresh).toHaveBeenCalledOnce();

    // Revogar sem link ativo não chama revalidatePath.
    estado.revalidatePath.mockClear();
    expect(await revogarCompartilhamentoAcao(concursoAna)).toEqual({ ok: true, data: null });
    expect(estado.revalidatePath).not.toHaveBeenCalled();
  });
});
