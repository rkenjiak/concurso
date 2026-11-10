/**
 * Feedback de usuários (#117): envio (validação, autor da sessão, versão da build, limite por
 * hora) e ações em lote do admin (permissão, limite do lote, transições e um registro de auditoria
 * por lote). Os módulos do Next e o usuário da requisição são simulados; o banco é real (em
 * memória).
 */
import type { Client } from "@libsql/client";
import { asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_ENVIOS_FEEDBACK, MAX_LOTE_FEEDBACK, MENSAGENS_FEEDBACK } from "@/domain/feedback";
import { commit, versao } from "@/lib/versao";
import type { UsuarioSessao } from "../auth/acesso";
import { criarBancoTeste, criarUsuarioTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { auditoriaAdmin, feedback, ID_USUARIO_INICIAL, usuario } from "../db/schema";
import { obterUsuario } from "../repositories/usuarios";

const estado = vi.hoisted(() => ({
  db: null as unknown as Db,
  usuario: null as UsuarioSessao | null,
  userAgent: "Mozilla/5.0 (Teste)" as string | null,
}));

vi.mock("../db/client", async (original) => ({
  ...(await original<typeof import("../db/client")>()),
  getDb: () => estado.db,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (nome: string) => (nome === "user-agent" ? estado.userAgent : null),
  }),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  unstable_rethrow: () => {},
  forbidden: () => {
    throw new Error("FORBIDDEN 403");
  },
}));
vi.mock("../auth/acesso", () => ({
  MENSAGEM_SESSAO_EXPIRADA: "Sessão expirada. Entre novamente para continuar.",
  usuarioAtual: async () => estado.usuario,
  exigirUsuarioAcao: async () =>
    estado.usuario
      ? { ok: true, usuario: estado.usuario }
      : { ok: false, erros: { _form: ["Sessão expirada. Entre novamente para continuar."] } },
}));

const {
  descartarFeedbacksAcao,
  desfazerDescarteAcao,
  enviarFeedbackAcao,
  excluirFeedbacksAcao,
  exportarFeedbacksAcao,
  restaurarFeedbacksAcao,
} = await import("./feedback");
const { MENSAGEM_SEM_PERMISSAO } = await import("../auth/admin");

let client: Client;
let bia: number;

const sessaoDe = async (id: number): Promise<UsuarioSessao> => {
  const u = await obterUsuario(estado.db, id);
  if (!u) throw new Error("usuário ausente");
  return { id: u.id, email: u.email, nome: u.nome, avatarUrl: u.avatarUrl, papel: u.papel };
};

const MENSAGEM = "O botão de salvar não responde.";

async function enviarComo(id: number, mensagem = MENSAGEM, tipo = "BUG") {
  estado.usuario = await sessaoDe(id);
  const r = await enviarFeedbackAcao({ tipo, mensagem, pagina: "/concursos/12?aba=links" });
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.data.id;
}

const linhas = () => estado.db.select().from(feedback).orderBy(asc(feedback.id));
const auditoria = () => estado.db.select().from(auditoriaAdmin).orderBy(asc(auditoriaAdmin.id));
const statusDe = async (id: number) => (await linhas()).find((f) => f.id === id)?.status;

beforeEach(async () => {
  ({ db: estado.db, client } = await criarBancoTeste());
  await estado.db
    .update(usuario)
    .set({ email: "ana@x.com" })
    .where(eq(usuario.id, ID_USUARIO_INICIAL));
  bia = await criarUsuarioTeste(estado.db, "bia@x.com");
  estado.userAgent = "Mozilla/5.0 (Teste)";
  estado.usuario = await sessaoDe(ID_USUARIO_INICIAL);
});

afterEach(() => client.close());

describe("enviarFeedbackAcao", () => {
  it("grava em nome do usuário da sessão, com a versão da build, o user agent e a rota", async () => {
    estado.usuario = await sessaoDe(bia);
    const r = await enviarFeedbackAcao({
      tipo: "SUGESTAO",
      mensagem: `  ${MENSAGEM}  `,
      pagina: "/concursos/12/editar?busca=segredo#links",
      // Campos extras do cliente são ignorados.
      usuarioId: ID_USUARIO_INICIAL,
      versaoApp: "9.9.9",
      status: "EXPORTADO",
    });
    expect(r.ok).toBe(true);
    const [f] = await linhas();
    expect(f).toMatchObject({
      usuarioId: bia,
      usuario: "bia@x.com",
      tipo: "SUGESTAO",
      mensagem: MENSAGEM,
      pagina: "/concursos/[id]/editar",
      versaoApp: versao,
      commitApp: commit,
      userAgent: "Mozilla/5.0 (Teste)",
      status: "NOVO",
      tratadoPor: null,
    });
  });

  it("valida tipo e tamanho da mensagem", async () => {
    const curta = await enviarFeedbackAcao({ tipo: "BUG", mensagem: "curta", pagina: "/" });
    expect(curta).toMatchObject({ ok: false, erros: { mensagem: [expect.any(String)] } });
    const longa = await enviarFeedbackAcao({ tipo: "BUG", mensagem: "a".repeat(2001) });
    expect(longa).toMatchObject({ ok: false, erros: { mensagem: [expect.any(String)] } });
    const tipo = await enviarFeedbackAcao({ tipo: "ELOGIO", mensagem: MENSAGEM });
    expect(tipo).toMatchObject({ ok: false, erros: { tipo: [expect.any(String)] } });
    expect(await linhas()).toEqual([]);
  });

  it("página inválida ou ausente não impede o envio", async () => {
    expect((await enviarFeedbackAcao({ tipo: "OUTRO", mensagem: MENSAGEM })).ok).toBe(true);
    const r = await enviarFeedbackAcao({ tipo: "OUTRO", mensagem: MENSAGEM, pagina: "//x.com" });
    expect(r.ok).toBe(true);
    expect((await linhas()).map((f) => f.pagina)).toEqual([null, null]);
  });

  it("sem sessão, pede login", async () => {
    estado.usuario = null;
    const r = await enviarFeedbackAcao({ tipo: "BUG", mensagem: MENSAGEM });
    expect(r).toEqual({
      ok: false,
      erros: { _form: ["Sessão expirada. Entre novamente para continuar."] },
    });
  });

  it(`limita a ${MAX_ENVIOS_FEEDBACK} envios por usuário por hora`, async () => {
    for (let i = 0; i < MAX_ENVIOS_FEEDBACK; i++) await enviarComo(bia);
    estado.usuario = await sessaoDe(bia);
    expect(await enviarFeedbackAcao({ tipo: "BUG", mensagem: MENSAGEM })).toEqual({
      ok: false,
      erros: { _form: [MENSAGENS_FEEDBACK.limiteEnvios] },
    });
    expect(await linhas()).toHaveLength(MAX_ENVIOS_FEEDBACK);
    // O limite é por usuário.
    await enviarComo(ID_USUARIO_INICIAL);
    // Envios com mais de uma hora não contam.
    await estado.db
      .update(feedback)
      .set({ createdAt: new Date(Date.now() - 61 * 60_000) })
      .where(eq(feedback.usuarioId, bia));
    await enviarComo(bia);
  });
});

describe("ações do admin", () => {
  let ids: number[];

  beforeEach(async () => {
    ids = [
      await enviarComo(bia, "Primeiro feedback da Bia."),
      await enviarComo(bia, "Segundo feedback da Bia.", "SUGESTAO"),
      await enviarComo(ID_USUARIO_INICIAL, "Feedback da Ana, admin."),
    ];
    estado.usuario = await sessaoDe(ID_USUARIO_INICIAL);
  });

  it("usuário comum não exporta, descarta, restaura nem exclui", async () => {
    estado.usuario = await sessaoDe(bia);
    const negado = { ok: false, erros: { _form: [MENSAGEM_SEM_PERMISSAO] } };
    expect(await exportarFeedbacksAcao(ids, "JSON", false)).toEqual(negado);
    expect(await descartarFeedbacksAcao(ids)).toEqual(negado);
    expect(await desfazerDescarteAcao([{ id: ids[0], status: "NOVO" }])).toEqual(negado);
    expect(await restaurarFeedbacksAcao(ids)).toEqual(negado);
    expect(await excluirFeedbacksAcao(ids)).toEqual(negado);
    expect((await linhas()).map((f) => f.status)).toEqual(["NOVO", "NOVO", "NOVO"]);
    expect(await auditoria()).toEqual([]);
  });

  it(`recusa lotes vazios ou com mais de ${MAX_LOTE_FEEDBACK} itens`, async () => {
    const grande = Array.from({ length: MAX_LOTE_FEEDBACK + 1 }, (_, i) => i + 1);
    for (const r of [
      await exportarFeedbacksAcao(grande, "JSON", false),
      await descartarFeedbacksAcao(grande),
      await restaurarFeedbacksAcao(grande),
      await excluirFeedbacksAcao(grande),
      await descartarFeedbacksAcao([]),
      await descartarFeedbacksAcao(["1"]),
    ]) {
      expect(r.ok).toBe(false);
    }
    expect(await exportarFeedbacksAcao(ids, "PDF", false)).toMatchObject({ ok: false });
    expect(await auditoria()).toEqual([]);
  });

  it("exporta sem e-mail por padrão, marca EXPORTADO e audita uma vez por lote", async () => {
    const r = await exportarFeedbacksAcao([ids[0], ids[1], ids[0]], "MARKDOWN_ISSUES", false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.exportados).toBe(2);
    expect(r.data.conteudo).toContain("[Sugestão] Segundo feedback da Bia.");
    expect(r.data.conteudo).toContain("- **Página:** `/concursos/[id]`");
    expect(r.data.conteudo).not.toContain("bia@x.com");
    const [a, b, c] = await linhas();
    expect(a).toMatchObject({ status: "EXPORTADO", tratadoPor: ID_USUARIO_INICIAL });
    expect(a?.tratadoEm).toBeInstanceOf(Date);
    expect(b?.status).toBe("EXPORTADO");
    expect(c?.status).toBe("NOVO");
    expect(await auditoria()).toMatchObject([
      { acao: "EXPORTAR_FEEDBACK", alvo: "2 feedbacks", admin: "ana@x.com", alvoUsuarioId: null },
    ]);

    const comEmail = await exportarFeedbacksAcao([ids[0]], "GH", true);
    expect(comEmail.ok && comEmail.data.conteudo).toContain("- **Usuário:** bia@x.com");
    expect(await auditoria()).toHaveLength(2);
    expect((await auditoria())[1]?.alvo).toBe("1 feedback");
  });

  it("descarta, desfaz para o status anterior, restaura e exclui só descartados", async () => {
    await exportarFeedbacksAcao([ids[0]], "JSON", false);
    const descarte = await descartarFeedbacksAcao(ids);
    expect(descarte).toEqual({
      ok: true,
      data: {
        anteriores: [
          { id: ids[0], status: "EXPORTADO" },
          { id: ids[1], status: "NOVO" },
          { id: ids[2], status: "NOVO" },
        ],
      },
    });
    expect((await linhas()).map((f) => f.status)).toEqual([
      "DESCARTADO",
      "DESCARTADO",
      "DESCARTADO",
    ]);
    // Descartar de novo não muda nada nem audita.
    expect(await descartarFeedbacksAcao(ids)).toEqual({ ok: true, data: { anteriores: [] } });

    if (!descarte.ok) return;
    expect(await desfazerDescarteAcao(descarte.data.anteriores.slice(0, 2))).toEqual({
      ok: true,
      data: { restaurados: 2 },
    });
    expect(await statusDe(ids[0] as number)).toBe("EXPORTADO");
    expect(await statusDe(ids[1] as number)).toBe("NOVO");
    // Desfazer não aceita voltar para DESCARTADO.
    expect((await desfazerDescarteAcao([{ id: ids[0], status: "DESCARTADO" }])).ok).toBe(false);

    // Excluir ignora quem não está descartado.
    expect(await excluirFeedbacksAcao([ids[0], ids[2]])).toEqual({
      ok: true,
      data: { excluidos: 1 },
    });
    expect((await linhas()).map((f) => f.id)).toEqual([ids[0], ids[1]]);

    await descartarFeedbacksAcao([ids[1]]);
    expect(await restaurarFeedbacksAcao([ids[1]])).toEqual({ ok: true, data: { restaurados: 1 } });
    expect(await statusDe(ids[1] as number)).toBe("NOVO");

    expect((await auditoria()).map((a) => [a.acao, a.alvo])).toEqual([
      ["EXPORTAR_FEEDBACK", "1 feedback"],
      ["DESCARTAR_FEEDBACK", "3 feedbacks"],
      ["RESTAURAR_FEEDBACK", "2 feedbacks"],
      ["EXCLUIR_FEEDBACK", "1 feedback"],
      ["DESCARTAR_FEEDBACK", "1 feedback"],
      ["RESTAURAR_FEEDBACK", "1 feedback"],
    ]);
  });

  it("feedback continua com a cópia do e-mail se o usuário for excluído", async () => {
    await estado.db.delete(usuario).where(eq(usuario.id, bia));
    const [f] = await linhas();
    expect(f).toMatchObject({ usuarioId: null, usuario: "bia@x.com" });
  });
});
