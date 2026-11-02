import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErroDominio } from "@/domain/erros";
import { type BackupJson, VERSAO_BACKUP, validarBackup } from "@/lib/schemas/backup";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import { eventoSchema, VALORES_INICIAIS_EVENTO } from "@/lib/schemas/evento";
import { linkSchema } from "@/lib/schemas/link";
import { resultadoFaseSchema, VALORES_INICIAIS_RESULTADO_FASE } from "@/lib/schemas/resultado-fase";
import { ID_USUARIO_INICIAL as U } from "@/server/db/schema";
import { criarBancoTeste, criarUsuarioTeste } from "../db/banco-teste";
import type { Db } from "../db/client";
import { listarConcursos, obterConcurso } from "../queries/concursos";
import { exportarConcursosCsv, exportarDados } from "../queries/exportacao";
import { criarConcurso } from "./concursos";
import { definirPrazoOculto } from "./dashboard";
import { criarEvento } from "./eventos";
import { substituirTudo } from "./importacao";
import { criarLink } from "./links";
import { definirConcursoSilenciado, marcarNotificacoes, salvarRegras } from "./notificacoes";
import { criarResultadoFase } from "./resultados";
import { alterarStatus } from "./status";

let origem: { db: Db; client: Client };
let destino: { db: Db; client: Client };

beforeEach(async () => {
  origem = await criarBancoTeste();
  destino = await criarBancoTeste();
});

afterEach(() => {
  origem.client.close();
  destino.client.close();
});

const T0 = new Date("2026-10-01T12:00:00.123Z");
const T1 = new Date("2026-10-15T09:30:00Z");

/** Popula o banco com dados em todas as tabelas. */
async function popular(db: Db) {
  const a = await criarConcurso(
    db,
    U,
    concursoSchema.parse({
      ...VALORES_INICIAIS_CONCURSO,
      orgao: "Tribunal Regional Federal",
      cargo: "Analista Judiciário",
      banca: "Banca X",
      esfera: "FEDERAL",
      uf: "SP",
      cidade: "São Paulo",
      escolaridade: "SUPERIOR",
      remuneracao: "14.000,00",
      taxaInscricao: "130,00",
      vagasAmpla: "10",
      possuiCadastroReserva: true,
      status: "INSCRITO",
      observacoes: 'Observação com "aspas"; ponto e vírgula\ne quebra de linha',
      tags: ["Tribunais", "prioridade"],
      homologacaoData: "2026-01-10",
      validadeMeses: "24",
      validadeProrrogada: true,
    }),
    T0,
  );
  const b = await criarConcurso(
    db,
    U,
    concursoSchema.parse({
      ...VALORES_INICIAIS_CONCURSO,
      orgao: "Prefeitura",
      cargo: "Técnico",
      tags: ["prioridade"],
      // Identificação visual (#46): o outro concurso fica com a cor automática.
      cor: "MAGENTA",
      icone: "🏛️",
    }),
    T0,
  );
  await alterarStatus(db, U, a, "PROVA_AGENDADA", "boleto pago", T1);
  await criarLink(
    db,
    U,
    a,
    linkSchema.parse({ tipo: "EDITAL_ABERTURA", rotulo: "Edital", url: "https://ex.com/e.pdf" }),
  );
  const evento = await criarEvento(
    db,
    U,
    a,
    eventoSchema.parse({
      ...VALORES_INICIAIS_EVENTO,
      tipo: "PROVA_OBJETIVA",
      data: "2026-11-20",
      hora: "13:00",
      local: "Escola",
      concluido: true,
    }),
    T1,
  );
  // Preferências de exibição do dashboard (#44) também fazem parte do backup.
  await definirPrazoOculto(db, U, { tipo: "evento", eventoId: evento }, true);
  await definirPrazoOculto(db, U, { tipo: "validade", concursoId: a }, true);
  // Lembretes (#65): regras personalizadas, estado das notificações e concurso silenciado.
  await salvarRegras(db, U, [{ tipo: "FIM_INSCRICOES", ativo: true, antecedencias: [10, 0] }]);
  await marcarNotificacoes(
    db,
    U,
    [{ tipo: "evento", eventoId: evento, antecedencia: 7 }],
    "LER",
    T1,
  );
  await marcarNotificacoes(
    db,
    U,
    [{ tipo: "validade", concursoId: a, antecedencia: 90 }],
    "DISPENSAR",
    T1,
  );
  await definirConcursoSilenciado(db, U, b, true);
  await criarResultadoFase(
    db,
    U,
    a,
    resultadoFaseSchema.parse({
      ...VALORES_INICIAIS_RESULTADO_FASE,
      nota: "72,5",
      notaMaxima: "100",
      classificacaoGeral: "15",
      situacao: "APROVADO",
    }),
  );
  return { a, b };
}

/**
 * Backup sem os IDs (a importação gera IDs novos): concursos pela posição, tags pelo nome e
 * filhas pelo concurso, na ordem do arquivo.
 */
function semIds(b: BackupJson) {
  const posicao = new Map(b.dados.concursos.map((c, i) => [c.id, i]));
  const nomeTag = new Map(b.dados.tags.map((t) => [t.id, t.nome]));
  const filhas = <L extends { id: number; concursoId: number }>(linhas: L[]) =>
    linhas.map(({ id: _, concursoId, ...resto }) => ({
      ...resto,
      concurso: posicao.get(concursoId),
    }));
  return {
    ...b,
    dados: {
      concursos: b.dados.concursos.map(({ id: _, ...c }) => c),
      tags: b.dados.tags.map((t) => t.nome).sort(),
      concursoTags: b.dados.concursoTags
        .map((ct) => `${posicao.get(ct.concursoId)}:${nomeTag.get(ct.tagId)}`)
        .sort(),
      links: filhas(b.dados.links),
      eventos: filhas(b.dados.eventos),
      statusHistorico: filhas(b.dados.statusHistorico),
      resultadosFase: filhas(b.dados.resultadosFase),
      anexos: filhas(b.dados.anexos ?? []),
      regrasNotificacao: b.dados.regrasNotificacao,
      notificacoes: (b.dados.notificacoes ?? []).map(({ concursoId, eventoId, ...resto }) => ({
        ...resto,
        concurso: posicao.get(concursoId),
        evento: eventoId === null ? null : b.dados.eventos.findIndex((e) => e.id === eventoId),
      })),
    },
  };
}

/** Simula gravar e ler o arquivo. */
const viaArquivo = (backup: BackupJson): unknown => JSON.parse(JSON.stringify(backup));

describe("exportar → importar", () => {
  it("restaura exatamente os mesmos dados em um banco vazio", async () => {
    await popular(origem.db);
    const exportado = await exportarDados(origem.db, U, T1);

    expect(exportado.schemaVersion).toBe(VERSAO_BACKUP);
    expect(exportado.dados.concursos).toHaveLength(2);
    expect(exportado.dados.tags.map((t) => t.nome).sort()).toEqual(["prioridade", "tribunais"]);
    expect(exportado.dados.concursoTags).toHaveLength(3);
    expect(exportado.dados.links).toHaveLength(1);
    expect(exportado.dados.eventos).toHaveLength(1);
    expect(exportado.dados.statusHistorico).toHaveLength(3);
    expect(exportado.dados.resultadosFase).toHaveLength(1);
    expect(exportado.dados.eventos[0]?.ocultoDashboard).toBe(true);
    expect(exportado.dados.concursos.map((c) => c.validadeOcultaDashboard)).toEqual([true, false]);
    expect(exportado.dados.regrasNotificacao).toEqual([
      { tipo: "FIM_INSCRICOES", ativo: true, antecedencias: [10, 0] },
    ]);
    expect(exportado.dados.notificacoes).toHaveLength(2);
    expect(exportado.dados.concursos.map((c) => c.notificacoesSilenciadas)).toEqual([false, true]);
    expect(exportado.dados.concursos.map((c) => [c.cor, c.icone])).toEqual([
      [null, null],
      ["MAGENTA", "🏛️"],
    ]);

    const resumo = await substituirTudo(destino.db, U, validarBackup(viaArquivo(exportado)));
    expect(resumo).toMatchObject({ concursos: 2, tags: 2, eventos: 1, statusHistorico: 3 });

    expect(await exportarDados(destino.db, U, T1)).toEqual(exportado);
    // Colunas derivadas (busca) também são reconstruídas.
    const [linha] = await listarConcursos(destino.db, U, { busca: "tribunais" });
    expect(linha?.orgao).toBe("Tribunal Regional Federal");
  });

  it("substitui todos os dados existentes e permite continuar cadastrando", async () => {
    const { a } = await popular(origem.db);
    const exportado = await exportarDados(origem.db, U, T1);
    await criarConcurso(
      destino.db,
      U,
      concursoSchema.parse({
        ...VALORES_INICIAIS_CONCURSO,
        orgao: "Velho",
        cargo: "Z",
        tags: ["x"],
      }),
    );
    await criarConcurso(
      destino.db,
      U,
      concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "Velho 2", cargo: "Z" }),
    );
    await criarConcurso(
      destino.db,
      U,
      concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "Velho 3", cargo: "Z" }),
    );

    await substituirTudo(destino.db, U, validarBackup(viaArquivo(exportado)));
    const importado = await exportarDados(destino.db, U, T1);
    expect(semIds(importado)).toEqual(semIds(exportado));
    // IDs novos, mas na ordem do arquivo.
    const novoA = importado.dados.concursos[exportado.dados.concursos.findIndex((c) => c.id === a)];
    expect((await obterConcurso(destino.db, U, novoA?.id ?? 0))?.tags).toEqual([
      "prioridade",
      "tribunais",
    ]);

    const novo = await criarConcurso(
      destino.db,
      U,
      concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: "Novo", cargo: "Z" }),
    );
    expect(novo).toBeGreaterThan(Math.max(...importado.dados.concursos.map((c) => c.id)));
  });

  it("importa só para o usuário, sem tocar nos dados de outros (#49)", async () => {
    await popular(origem.db);
    const exportado = await exportarDados(origem.db, U, T1);
    // No destino, o usuário inicial já tem dados; outro usuário importa o backup.
    await popular(destino.db);
    const antes = await exportarDados(destino.db, U, T1);
    const outro = await criarUsuarioTeste(destino.db);
    expect((await exportarDados(destino.db, outro, T1)).dados.concursos).toEqual([]);

    await substituirTudo(destino.db, outro, validarBackup(viaArquivo(exportado)));
    expect(semIds(await exportarDados(destino.db, outro, T1))).toEqual(semIds(exportado));
    expect(await exportarDados(destino.db, U, T1)).toEqual(antes);

    // Reimportar um backup vazio apaga só os dados do outro usuário; as tags seguem em uso.
    const vazio = await exportarDados(origem.db, outro, T1);
    await substituirTudo(destino.db, outro, validarBackup(viaArquivo(vazio)));
    expect((await exportarDados(destino.db, outro, T1)).dados.concursos).toEqual([]);
    expect(await exportarDados(destino.db, U, T1)).toEqual(antes);
    expect(await listarConcursos(destino.db, outro)).toEqual([]);
    expect(await exportarConcursosCsv(destino.db, outro)).not.toContain("Tribunal");
  });

  it("não altera nada se a importação falhar no meio", async () => {
    await popular(destino.db);
    const antes = await exportarDados(destino.db, U, T1);
    const backup = validarBackup(viaArquivo(antes));
    // Viola a unicidade de chave_storage dentro da transação.
    const anexoBase = {
      concursoId: 1,
      nomeArquivo: "a.pdf",
      mime: "application/pdf",
      tamanhoBytes: 1,
      chaveStorage: "mesma",
      createdAt: T0,
    };
    backup.dados.anexos = [
      { id: 1, ...anexoBase },
      { id: 2, ...anexoBase },
    ];
    await expect(substituirTudo(destino.db, U, backup)).rejects.toThrow();
    expect(await exportarDados(destino.db, U, T1)).toEqual(antes);
  });

  it("importa backup vazio", async () => {
    await popular(destino.db);
    const vazio = await exportarDados(origem.db, U, T1);
    await substituirTudo(destino.db, U, validarBackup(viaArquivo(vazio)));
    expect(await exportarDados(destino.db, U, T1)).toEqual(vazio);
  });
});

describe("validarBackup", () => {
  const base = async () => {
    await popular(origem.db);
    return viaArquivo(await exportarDados(origem.db, U, T1)) as BackupJson;
  };

  const mensagem = (entrada: unknown) => {
    try {
      validarBackup(entrada);
    } catch (e) {
      expect(e).toBeInstanceOf(ErroDominio);
      return (e as Error).message;
    }
    throw new Error("esperava falha");
  };

  it("rejeita arquivos que não são backup do app", () => {
    expect(mensagem(null)).toBe("O arquivo não é um backup deste app.");
    expect(mensagem([])).toBe("O arquivo não é um backup deste app.");
    expect(mensagem({ app: "outro", schemaVersion: 1 })).toBe(
      "O arquivo não é um backup deste app.",
    );
  });

  it("rejeita versões desconhecidas com mensagem clara", async () => {
    const b = await base();
    expect(mensagem({ ...b, schemaVersion: 2 })).toBe(
      "Este backup usa a versão 2 do formato, mais nova que a suportada (1). Atualize o app antes de importar.",
    );
    expect(mensagem({ ...b, schemaVersion: 0 })).toBe(
      "Versão do backup não suportada (0). Versão suportada: 1.",
    );
    expect(mensagem({ ...b, schemaVersion: undefined })).toContain("não suportada (undefined)");
  });

  it("indica o campo inválido", async () => {
    const b = await base();
    const c0 = b.dados.concursos[0];
    if (!c0) throw new Error("sem concurso");
    b.dados.concursos[0] = { ...c0, status: "INEXISTENTE" as never };
    expect(mensagem(b)).toMatch(/^Backup inválido em dados\.concursos\[0\]\.status: /);
  });

  it("rejeita referências quebradas e IDs repetidos", async () => {
    const b = await base();
    const l0 = b.dados.links[0];
    if (!l0) throw new Error("sem link");
    expect(mensagem({ ...b, dados: { ...b.dados, links: [{ ...l0, concursoId: 99 }] } })).toBe(
      "Backup inválido em dados.links[0]: O link referencia um concurso inexistente (99).",
    );
    expect(mensagem({ ...b, dados: { ...b.dados, links: [l0, l0] } })).toBe(
      `Backup inválido em dados.links[1]: ID de link repetido (${l0.id}).`,
    );
    expect(mensagem({ ...b, dados: { ...b.dados, tags: [] } })).toMatch(
      /referencia uma tag inexistente/,
    );
  });

  it("aceita backup antigo, sem os campos de prazos ocultos do dashboard", async () => {
    const b = await base();
    const antigo = {
      ...b,
      dados: {
        ...b.dados,
        concursos: b.dados.concursos.map(({ validadeOcultaDashboard: _, ...c }) => c),
        eventos: b.dados.eventos.map(({ ocultoDashboard: _, ...e }) => e),
      },
    };
    const backup = validarBackup(antigo);
    expect(backup.dados.concursos.map((c) => c.validadeOcultaDashboard)).toEqual([false, false]);
    expect(backup.dados.eventos.map((e) => e.ocultoDashboard)).toEqual([false]);
    await substituirTudo(destino.db, U, backup);
    const reexportado = await exportarDados(destino.db, U, T1);
    expect(reexportado.dados.eventos[0]?.ocultoDashboard).toBe(false);
  });

  it("aceita backup antigo, sem cor e ícone (cor automática)", async () => {
    const b = await base();
    const antigo = {
      ...b,
      dados: { ...b.dados, concursos: b.dados.concursos.map(({ cor: _, icone: __, ...c }) => c) },
    };
    const backup = validarBackup(antigo);
    expect(backup.dados.concursos.map((c) => [c.cor, c.icone])).toEqual([
      [null, null],
      [null, null],
    ]);
    await substituirTudo(destino.db, U, backup);
    const reexportado = await exportarDados(destino.db, U, T1);
    expect(reexportado.dados.concursos.map((c) => c.cor)).toEqual([null, null]);
  });

  it("aceita backup antigo, sem os dados de lembretes (#65)", async () => {
    const b = await base();
    const { regrasNotificacao: _, notificacoes: __, ...dados } = b.dados;
    const antigo = {
      ...b,
      dados: {
        ...dados,
        concursos: dados.concursos.map(({ notificacoesSilenciadas: _s, ...c }) => c),
      },
    };
    const backup = validarBackup(antigo);
    expect(backup.dados.regrasNotificacao).toEqual([]);
    expect(backup.dados.notificacoes).toEqual([]);
    expect(backup.dados.concursos.map((c) => c.notificacoesSilenciadas)).toEqual([false, false]);
    await substituirTudo(destino.db, U, backup);
    const reexportado = await exportarDados(destino.db, U, T1);
    expect(reexportado.dados.regrasNotificacao).toEqual([]);
    expect(reexportado.dados.notificacoes).toEqual([]);
  });

  it("rejeita notificação de evento de outro concurso e regra repetida", async () => {
    const b = await base();
    const [n] = b.dados.notificacoes ?? [];
    const outroConcurso = b.dados.concursos.find((c) => c.id !== n?.concursoId)?.id as number;
    expect(() =>
      validarBackup({
        ...b,
        dados: { ...b.dados, notificacoes: [{ ...n, concursoId: outroConcurso }] },
      }),
    ).toThrow(/evento inexistente/);
    const [r] = b.dados.regrasNotificacao ?? [];
    expect(() => validarBackup({ ...b, dados: { ...b.dados, regrasNotificacao: [r, r] } })).toThrow(
      /Tipo de regra de notificação repetido/,
    );
  });

  it("rejeita cor fora da paleta e ícone inválido", async () => {
    const b = await base();
    const c0 = b.dados.concursos[0];
    if (!c0) throw new Error("sem concurso");
    const com = (extra: object) => ({
      ...b,
      dados: { ...b.dados, concursos: [{ ...c0, ...extra }, ...b.dados.concursos.slice(1)] },
    });
    expect(mensagem(com({ cor: "VERMELHO" }))).toMatch(
      /^Backup inválido em dados\.concursos\[0\]\.cor/,
    );
    expect(mensagem(com({ icone: "dois símbolos" }))).toBe(
      "Backup inválido em dados.concursos[0].icone: Ícone inválido.",
    );
  });

  it("aceita backup sem a lista de anexos", async () => {
    const b = await base();
    const { anexos: _, ...dados } = b.dados;
    expect(validarBackup({ ...b, dados }).dados.anexos).toEqual([]);
  });
});

describe("exportarConcursosCsv", () => {
  it("gera uma linha por concurso com rótulos, valores e tags", async () => {
    await popular(origem.db);
    const csv = await exportarConcursosCsv(origem.db, U);
    expect(csv.startsWith("﻿ID;Órgão;Cargo;")).toBe(true);
    const linhas = csv.trimEnd().split("\r\n");
    expect(linhas).toHaveLength(3);
    expect(linhas[1]).toContain(
      "1;Tribunal Regional Federal;Analista Judiciário;Banca X;Federal;SP;São Paulo;Ensino superior;14000,00;130,00;10;;sim;;Prova agendada;15/10/2026 06:30;10/01/2026;24;sim;;prioridade, tribunais;",
    );
    expect(linhas[1]).toContain('"Observação com ""aspas""; ponto e vírgula\ne quebra de linha"');
  });
});
