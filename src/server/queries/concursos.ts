/** Leituras de concurso (RF01). */
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { type Concurso, concurso } from "../db/schema";
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
> & { tags: string[] };

export type ConcursoDetalhe = Concurso & { tags: string[] };

/** Lista simples, mais recentes primeiro. */
export async function listarConcursos(db: Db): Promise<ConcursoResumo[]> {
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
    })
    .from(concurso)
    .orderBy(desc(concurso.createdAt), desc(concurso.id));
  const tags = await tagsPorConcurso(
    db,
    linhas.map((l) => l.id),
  );
  return linhas.map((l) => ({ ...l, tags: tags.get(l.id) ?? [] }));
}

export async function obterConcurso(db: Db, id: number): Promise<ConcursoDetalhe | null> {
  const [linha] = await db.select().from(concurso).where(eq(concurso.id, id));
  if (!linha) return null;
  const tags = await tagsPorConcurso(db, [id]);
  return { ...linha, tags: tags.get(id) ?? [] };
}
