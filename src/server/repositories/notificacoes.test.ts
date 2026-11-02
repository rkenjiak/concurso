import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { REGRAS_PADRAO } from "@/domain/notificacoes";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import { eventoSchema, VALORES_INICIAIS_EVENTO } from "@/lib/schemas/evento";
import { criarBancoTeste, criarUsuarioTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { concurso, notificacaoEstado, ID_USUARIO_INICIAL as U, usuario } from "../db/schema";
import { gerarIcsDoUsuario } from "../queries/calendario-ics";
import {
  contarNotificacoesNaoLidas,
  obterNotificacoes,
  obterRegras,
} from "../queries/notificacoes";
import { criarConcurso } from "./concursos";
import { atualizarEvento, criarEvento, excluirEvento } from "./eventos";
import {
  definirConcursoSilenciado,
  listarRegrasPersonalizadas,
  marcarNotificacoes,
  restaurarRegrasPadrao,
  salvarRegras,
} from "./notificacoes";
import {
  gerarTokenIcs,
  gerarTokenMcp,
  obterUsuario,
  PREFIXO_TOKEN_ICS,
  resumoTokenMcp,
  revogarTokenIcs,
  usuarioDoTokenIcs,
} from "./usuarios";

let db: Db;
let client: Client;

beforeEach(async () => {
  ({ db, client } = await criarBancoTeste());
});

afterEach(() => client.close());

const HOJE = "2026-11-10";

async function cadastrar(usuarioId = U, orgao = "TRF") {
  const concursoId = await criarConcurso(
    db,
    usuarioId,
    concursoSchema.parse({
      ...VALORES_INICIAIS_CONCURSO,
      orgao,
      cargo: "Analista",
      status: "INSCRITO",
    }),
  );
  const dadosEvento = (data: string) =>
    eventoSchema.parse({ ...VALORES_INICIAIS_EVENTO, tipo: "FIM_INSCRICOES", data });
  const eventoId = await criarEvento(db, usuarioId, concursoId, dadosEvento("2026-11-15"));
  return { concursoId, eventoId, dadosEvento };
}

describe("regras de notificação", () => {
  it("guarda só o que difere do padrão e restaura", async () => {
    await salvarRegras(db, U, [
      { tipo: "FIM_INSCRICOES", ativo: true, antecedencias: [0, 10] },
      { ...REGRAS_PADRAO.POSSE },
    ]);
    expect(await listarRegrasPersonalizadas(db, U)).toEqual([
      { tipo: "FIM_INSCRICOES", ativo: true, antecedencias: [10, 0] },
    ]);
    expect((await obterRegras(db, U)).FIM_INSCRICOES.antecedencias).toEqual([10, 0]);

    // Voltar um tipo ao padrão apaga a personalização dele.
    await salvarRegras(db, U, [{ ...REGRAS_PADRAO.FIM_INSCRICOES }]);
    expect(await listarRegrasPersonalizadas(db, U)).toEqual([]);

    await salvarRegras(db, U, [{ tipo: "OUTRO", ativo: true, antecedencias: [2] }]);
    await restaurarRegrasPadrao(db, U);
    expect(await obterRegras(db, U)).toEqual(REGRAS_PADRAO);
  });

  it("são por usuário", async () => {
    const outro = await criarUsuarioTeste(db);
    await salvarRegras(db, outro, [{ tipo: "FIM_INSCRICOES", ativo: false, antecedencias: [7] }]);
    expect(await obterRegras(db, U)).toEqual(REGRAS_PADRAO);
    expect((await obterRegras(db, outro)).FIM_INSCRICOES.ativo).toBe(false);
  });
});

describe("notificações do app", () => {
  it("disparam pelas regras; mudar a regra muda os avisos", async () => {
    const { eventoId } = await cadastrar();
    const [n] = await obterNotificacoes(db, U, HOJE);
    expect(n).toMatchObject({ chave: `evento-${eventoId}:7`, dias: 5, lida: false });
    expect(await contarNotificacoesNaoLidas(db, U, HOJE)).toBe(1);

    await salvarRegras(db, U, [{ tipo: "FIM_INSCRICOES", ativo: true, antecedencias: [3] }]);
    expect(await obterNotificacoes(db, U, HOJE)).toEqual([]);
    expect((await obterNotificacoes(db, U, "2026-11-12"))[0]?.chave).toBe(`evento-${eventoId}:3`);
  });

  it("lida persiste e acompanha a mudança de data do evento, sem duplicar", async () => {
    const { concursoId, eventoId, dadosEvento } = await cadastrar();
    await marcarNotificacoes(db, U, [{ tipo: "evento", eventoId, antecedencia: 7 }], "LER");
    expect(await contarNotificacoesNaoLidas(db, U, HOJE)).toBe(0);

    // Retificação: a data muda, a notificação é a mesma (e continua lida).
    await atualizarEvento(db, U, concursoId, eventoId, dadosEvento("2026-11-16"));
    const lista = await obterNotificacoes(db, U, HOJE);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      chave: `evento-${eventoId}:7`,
      data: "2026-11-16",
      lida: true,
    });

    // A próxima antecedência é outra notificação, não lida.
    expect((await obterNotificacoes(db, U, "2026-11-15"))[0]).toMatchObject({
      chave: `evento-${eventoId}:1`,
      lida: false,
    });
  });

  it("dispensar remove da lista; marcar de novo não desfaz a dispensa", async () => {
    const { eventoId } = await cadastrar();
    const alvo = { tipo: "evento" as const, eventoId, antecedencia: 7 };
    await marcarNotificacoes(db, U, [alvo], "DISPENSAR");
    await marcarNotificacoes(db, U, [alvo], "LER");
    expect(await obterNotificacoes(db, U, HOJE)).toEqual([]);
    const [estado] = await db.select().from(notificacaoEstado);
    expect(estado).toMatchObject({ chave: `evento-${eventoId}:7`, eventoId, antecedencia: 7 });
    expect(estado?.lidaEm).not.toBeNull();
    expect(estado?.dispensadaEm).not.toBeNull();
  });

  it("não marca notificações de outro usuário (nada é gravado)", async () => {
    const outro = await criarUsuarioTeste(db);
    const meu = await cadastrar();
    const dele = await cadastrar(outro, "Prefeitura");
    await expect(
      marcarNotificacoes(
        db,
        U,
        [
          { tipo: "evento", eventoId: meu.eventoId, antecedencia: 7 },
          { tipo: "evento", eventoId: dele.eventoId, antecedencia: 7 },
        ],
        "LER",
      ),
    ).rejects.toThrow("Notificação não encontrada.");
    await expect(
      marcarNotificacoes(
        db,
        U,
        [{ tipo: "validade", concursoId: dele.concursoId, antecedencia: 90 }],
        "LER",
      ),
    ).rejects.toThrow("Notificação não encontrada.");
    expect(await db.select().from(notificacaoEstado)).toEqual([]);
    expect(await obterNotificacoes(db, outro, HOJE)).toHaveLength(1);
    expect((await obterNotificacoes(db, U, HOJE)).map((n) => n.concurso.id)).toEqual([
      meu.concursoId,
    ]);
  });

  it("silenciar o concurso cala as notificações sem alterar updated_at", async () => {
    const { concursoId } = await cadastrar();
    const [antes] = await db.select().from(concurso).where(eq(concurso.id, concursoId));
    await definirConcursoSilenciado(db, U, concursoId, true);
    expect(await obterNotificacoes(db, U, HOJE)).toEqual([]);
    const [depois] = await db.select().from(concurso).where(eq(concurso.id, concursoId));
    expect(depois?.updatedAt).toEqual(antes?.updatedAt);
    await definirConcursoSilenciado(db, U, concursoId, false);
    expect(await obterNotificacoes(db, U, HOJE)).toHaveLength(1);

    const outro = await criarUsuarioTeste(db);
    await expect(definirConcursoSilenciado(db, outro, concursoId, true)).rejects.toThrow(
      "Concurso não encontrado.",
    );
  });

  it("excluir o evento leva o estado junto", async () => {
    const { concursoId, eventoId } = await cadastrar();
    await marcarNotificacoes(db, U, [{ tipo: "evento", eventoId, antecedencia: 7 }], "LER");
    await excluirEvento(db, U, concursoId, eventoId);
    expect(await db.select().from(notificacaoEstado)).toEqual([]);
  });
});

describe("feed de calendário (.ics)", () => {
  it("token: guarda só o resumo, identifica o dono, é trocado e revogado", async () => {
    const token = await gerarTokenIcs(db, U);
    expect(token.startsWith(PREFIXO_TOKEN_ICS)).toBe(true);
    expect((await obterUsuario(db, U))?.icsTokenHash).toBe(resumoTokenMcp(token));
    expect((await usuarioDoTokenIcs(db, token))?.id).toBe(U);
    expect(await usuarioDoTokenIcs(db, `${token}x`)).toBeNull();

    const novo = await gerarTokenIcs(db, U);
    expect(await usuarioDoTokenIcs(db, token)).toBeNull();
    expect((await usuarioDoTokenIcs(db, novo))?.id).toBe(U);

    await revogarTokenIcs(db, U);
    expect(await usuarioDoTokenIcs(db, novo)).toBeNull();
  });

  it("o token do MCP não abre o feed", async () => {
    const mcp = await gerarTokenMcp(db, U);
    expect(await usuarioDoTokenIcs(db, mcp)).toBeNull();
  });

  it("usuário bloqueado perde o acesso ao feed", async () => {
    const outro = await criarUsuarioTeste(db);
    const token = await gerarTokenIcs(db, outro);
    await db.update(usuario).set({ bloqueadoEm: new Date() }).where(eq(usuario.id, outro));
    expect(await usuarioDoTokenIcs(db, token)).toBeNull();
  });

  it("o feed de um usuário não contém eventos de outro", async () => {
    const outro = await criarUsuarioTeste(db);
    const meu = await cadastrar(U, "Meu órgão");
    const dele = await cadastrar(outro, "Órgão alheio");
    const opcoes = {
      incluirConcluidos: true,
      incluirEncerrados: true,
      urlBase: "https://app.test",
    };
    const ics = (await gerarIcsDoUsuario(db, U, opcoes)) ?? "";
    expect(ics).toContain(`UID:evento-${meu.eventoId}@app.test`);
    expect(ics).toContain("Meu órgão");
    expect(ics).not.toContain(`evento-${dele.eventoId}@`);
    expect(ics).not.toContain("Órgão alheio");
    expect(ics).toContain("TRIGGER:-P6DT15H"); // alarme de 7 dias às 9h

    // Download de um concurso: só ele; concurso de outro usuário = null.
    expect(await gerarIcsDoUsuario(db, U, { ...opcoes, concursoId: dele.concursoId })).toBeNull();
    const unico = await gerarIcsDoUsuario(db, U, { ...opcoes, concursoId: meu.concursoId });
    expect(unico).toContain("X-WR-CALNAME:Meu órgão — Analista");
  });
});
