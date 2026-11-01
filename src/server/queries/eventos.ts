/** Leituras de eventos (RF04). */
import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { type Evento, evento } from "../db/schema";
import type { Executor } from "../repositories/tipos";

/**
 * Eventos do concurso (o chamador garante que é do usuário, via `obterConcurso`) por data; no mesmo dia, sem hora ("dia inteiro") primeiro — no SQLite
 * `NULL` vem antes em ordem crescente.
 */
export async function listarEventos(db: Db | Executor, concursoId: number): Promise<Evento[]> {
  return db
    .select()
    .from(evento)
    .where(eq(evento.concursoId, concursoId))
    .orderBy(asc(evento.data), asc(evento.hora), asc(evento.id));
}
