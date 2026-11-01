/** Leituras de links (RF02). */
import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { type Link, link } from "../db/schema";
import type { Executor } from "../repositories/tipos";

/** Links do concurso (o chamador garante que é do usuário, via `obterConcurso`). */
export async function listarLinks(db: Db | Executor, concursoId: number): Promise<Link[]> {
  return db
    .select()
    .from(link)
    .where(eq(link.concursoId, concursoId))
    .orderBy(asc(link.ordem), asc(link.id));
}
