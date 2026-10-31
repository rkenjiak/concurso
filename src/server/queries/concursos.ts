/** Leituras de concurso (RF01). */
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { type Concurso, concurso } from "../db/schema";

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
>;

/** Lista simples, mais recentes primeiro. */
export async function listarConcursos(db: Db): Promise<ConcursoResumo[]> {
  return db
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
}

export async function obterConcurso(db: Db, id: number): Promise<Concurso | null> {
  const [linha] = await db.select().from(concurso).where(eq(concurso.id, id));
  return linha ?? null;
}
