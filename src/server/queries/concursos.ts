/** Leituras de concurso (RF01, RF07), sempre restritas aos concursos do usuário (#49). */
import { and, asc, desc, eq, gte, inArray, lte, type SQL, sql } from "drizzle-orm";
import { normalizarTexto } from "@/lib/normalize";
import { FILTROS_VAZIOS, type FiltrosConcursos } from "@/lib/schemas/filtros-concursos";
import { type DataISO, hojeSP } from "@/lib/tz";
import type { Db } from "../db/client";
import { type Concurso, concurso, evento } from "../db/schema";
import { tagsPorConcurso } from "./tags";

export type ConcursoResumo = Pick<
  Concurso,
  | "id"
  | "orgao"
  | "cargo"
  | "banca"
  | "esfera"
  | "uf"
  | "cidade"
  | "status"
  | "remuneracaoCentavos"
  | "createdAt"
  | "cor"
  | "icone"
> & {
  tags: string[];
  /** Menor data `>= hoje` entre os eventos não concluídos (§4.2), ou `null`. */
  proximaData: DataISO | null;
};

export type ConcursoDetalhe = Concurso & { tags: string[] };

/** Escapa `%`, `_` e `!` para uso em `LIKE ... ESCAPE '!'`. */
function escaparLike(texto: string): string {
  return texto.replace(/[!%_]/g, (c) => `!${c}`);
}

/**
 * Condições da busca/filtros. A busca textual exige que cada termo (normalizado, sem acento)
 * apareça em `busca_normalizada` (órgão + cargo + banca + tags).
 */
function condicoes(usuarioId: number, filtros: FiltrosConcursos): SQL | undefined {
  const termos = filtros.busca ? normalizarTexto(filtros.busca).split(" ").filter(Boolean) : [];
  return and(
    eq(concurso.usuarioId, usuarioId),
    ...termos.map(
      (t) => sql`${concurso.buscaNormalizada} like ${`%${escaparLike(t)}%`} escape '!'`,
    ),
    filtros.status.length > 0 ? inArray(concurso.status, filtros.status) : undefined,
    filtros.esfera ? eq(concurso.esfera, filtros.esfera) : undefined,
    filtros.uf ? eq(concurso.uf, filtros.uf) : undefined,
    filtros.escolaridade ? eq(concurso.escolaridade, filtros.escolaridade) : undefined,
    filtros.remuneracaoMin !== null
      ? gte(concurso.remuneracaoCentavos, filtros.remuneracaoMin)
      : undefined,
    filtros.remuneracaoMax !== null
      ? lte(concurso.remuneracaoCentavos, filtros.remuneracaoMax)
      : undefined,
  );
}

/**
 * Lista com busca, filtros e ordenação (RF07). `hoje` (America/Sao_Paulo) define a próxima data.
 * Ordenações: próxima data (asc, sem data por último), remuneração (desc, sem valor por último),
 * cadastro (mais recentes primeiro) e nome (órgão e cargo sem acento/maiúsculas, via a busca
 * normalizada, que começa por eles). Empates: mais recentes primeiro.
 */
export async function listarConcursos(
  db: Db,
  usuarioId: number,
  filtrosParciais: Partial<FiltrosConcursos> = {},
  hoje: DataISO = hojeSP(),
): Promise<ConcursoResumo[]> {
  const filtros = { ...FILTROS_VAZIOS, ...filtrosParciais };
  const proximas = db
    .select({
      concursoId: evento.concursoId,
      data: sql<DataISO>`min(${evento.data})`.as("proxima_data"),
    })
    .from(evento)
    .where(and(eq(evento.concluido, false), gte(evento.data, hoje)))
    .groupBy(evento.concursoId)
    .as("proximas");
  const proximaData = proximas.data;
  const desempate = [desc(concurso.createdAt), desc(concurso.id)];
  const ordem: Record<FiltrosConcursos["ordem"], SQL[]> = {
    proxima_data: [sql`${proximaData} is null`, asc(proximaData), ...desempate],
    remuneracao: [
      sql`${concurso.remuneracaoCentavos} is null`,
      desc(concurso.remuneracaoCentavos),
      ...desempate,
    ],
    cadastro: desempate,
    nome: [asc(concurso.buscaNormalizada), ...desempate],
  };

  const linhas = await db
    .select({
      id: concurso.id,
      orgao: concurso.orgao,
      cargo: concurso.cargo,
      banca: concurso.banca,
      esfera: concurso.esfera,
      uf: concurso.uf,
      cidade: concurso.cidade,
      status: concurso.status,
      remuneracaoCentavos: concurso.remuneracaoCentavos,
      createdAt: concurso.createdAt,
      cor: concurso.cor,
      icone: concurso.icone,
      proximaData,
    })
    .from(concurso)
    .leftJoin(proximas, eq(proximas.concursoId, concurso.id))
    .where(condicoes(usuarioId, filtros))
    .orderBy(...ordem[filtros.ordem]);
  const tags = await tagsPorConcurso(
    db,
    linhas.map((l) => l.id),
  );
  return linhas.map((l) => ({ ...l, tags: tags.get(l.id) ?? [] }));
}

export async function obterConcurso(
  db: Db,
  usuarioId: number,
  id: number,
): Promise<ConcursoDetalhe | null> {
  const [linha] = await db
    .select()
    .from(concurso)
    .where(and(eq(concurso.id, id), eq(concurso.usuarioId, usuarioId)));
  if (!linha) return null;
  const tags = await tagsPorConcurso(db, [id]);
  return { ...linha, tags: tags.get(id) ?? [] };
}
