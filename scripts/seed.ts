/**
 * Seed opcional com concursos FICTÍCIOS para desenvolvimento local (`pnpm db:seed`).
 * Só insere se o banco estiver vazio; use `--force` para inserir mesmo assim.
 */
import { count } from "drizzle-orm";
import { montarBuscaNormalizada, normalizarTag } from "../src/lib/normalize";
import { criarDb } from "../src/server/db/client";
import { aplicarMigracoes } from "../src/server/db/migrate";
import { concurso, concursoTag, evento, link, statusHistorico, tag } from "../src/server/db/schema";
import { carregarEnv } from "./env";

carregarEnv();

/** Data `YYYY-MM-DD` daqui a `dias` dias (aproximação suficiente para dados de exemplo). */
function emDias(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
}

const { db, client } = criarDb();

try {
  await aplicarMigracoes(db);
  const [linha] = await db.select({ total: count() }).from(concurso);
  if ((linha?.total ?? 0) > 0 && !process.argv.includes("--force")) {
    console.log("Banco já possui concursos; seed ignorado (use --force para inserir mesmo assim).");
  } else {
    await db.transaction(async (tx) => {
      const agora = new Date();
      const tags = ["tribunais", "prioridade"].map(normalizarTag);

      const [trf] = await tx
        .insert(concurso)
        .values({
          orgao: "Tribunal Regional Exemplo",
          cargo: "Analista Judiciário — Área Judiciária",
          banca: "Banca Exemplo",
          esfera: "FEDERAL",
          uf: "SP",
          cidade: "São Paulo",
          escolaridade: "SUPERIOR",
          remuneracaoCentavos: 1_400_000,
          taxaInscricaoCentavos: 13_000,
          vagasAmpla: 10,
          possuiCadastroReserva: true,
          vagasCotas: 3,
          status: "INSCRITO",
          statusDesde: agora,
          observacoes: "Dados **fictícios** gerados pelo seed.",
          buscaNormalizada: montarBuscaNormalizada({
            orgao: "Tribunal Regional Exemplo",
            cargo: "Analista Judiciário — Área Judiciária",
            banca: "Banca Exemplo",
            tags,
          }),
        })
        .returning({ id: concurso.id });

      const [pref] = await tx
        .insert(concurso)
        .values({
          orgao: "Prefeitura de Cidade Exemplo",
          cargo: "Técnico Administrativo",
          esfera: "MUNICIPAL",
          uf: "MG",
          escolaridade: "MEDIO",
          remuneracaoCentavos: 380_000,
          status: "PREVISTO",
          statusDesde: agora,
          buscaNormalizada: montarBuscaNormalizada({
            orgao: "Prefeitura de Cidade Exemplo",
            cargo: "Técnico Administrativo",
          }),
        })
        .returning({ id: concurso.id });

      if (!trf || !pref) throw new Error("Falha ao inserir concursos de exemplo.");

      await tx.insert(statusHistorico).values([
        { concursoId: trf.id, de: null, para: "INSCRITO", alteradoEm: agora },
        { concursoId: pref.id, de: null, para: "PREVISTO", alteradoEm: agora },
      ]);

      await tx.insert(link).values([
        {
          concursoId: trf.id,
          tipo: "EDITAL_ABERTURA",
          rotulo: "Edital de abertura",
          url: "https://example.com/edital.pdf",
          ordem: 0,
        },
        {
          concursoId: trf.id,
          tipo: "AREA_CANDIDATO",
          rotulo: "Área do candidato",
          url: "https://example.com/candidato",
          ordem: 1,
        },
      ]);

      await tx.insert(evento).values([
        { concursoId: trf.id, tipo: "VENCIMENTO_BOLETO", data: emDias(2) },
        { concursoId: trf.id, tipo: "PROVA_OBJETIVA", data: emDias(20), hora: "13:00" },
      ]);

      const tagsCriadas = await tx
        .insert(tag)
        .values(tags.map((nome) => ({ nome })))
        .onConflictDoUpdate({ target: tag.nome, set: { nome: tag.nome } })
        .returning({ id: tag.id });
      await tx
        .insert(concursoTag)
        .values(tagsCriadas.map((t) => ({ concursoId: trf.id, tagId: t.id })));
    });
    console.log("Seed concluído: 2 concursos fictícios inseridos.");
  }
} catch (erro) {
  console.error("Falha no seed:", erro);
  process.exitCode = 1;
} finally {
  client.close();
}
