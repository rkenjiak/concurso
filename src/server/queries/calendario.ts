/** Leituras do calendário mensal (RF04/RF06). */
import { asc, between, eq, or } from "drizzle-orm";
import {
  type ItemCalendario,
  itensCalendario,
  type MesISO,
  primeiroDia,
  ultimoDia,
} from "@/domain/calendario";
import type { DataISO } from "@/lib/tz";
import type { Db } from "../db/client";
import { evento } from "../db/schema";
import {
  COLUNAS_EVENTO_PRAZO,
  type ConcursoDoPrazo,
  type EventoDoPrazo,
  listarConcursosDoPrazo,
} from "./dashboard";

export type ItemDoCalendario = ItemCalendario<EventoDoPrazo, ConcursoDoPrazo>;

/**
 * Itens do mês (`AAAA-MM`): eventos do período (concluídos inclusive) e fins de validade
 * calculados. Também lê os eventos `VALIDADE` fora do mês, que suprimem o pseudo-evento.
 */
export async function obterCalendario(
  db: Db,
  mes: MesISO,
  hoje: DataISO,
): Promise<ItemDoCalendario[]> {
  const inicio = primeiroDia(mes);
  const fim = ultimoDia(mes);
  const [concursos, eventos] = await Promise.all([
    listarConcursosDoPrazo(db),
    db
      .select(COLUNAS_EVENTO_PRAZO)
      .from(evento)
      .where(or(between(evento.data, inicio, fim), eq(evento.tipo, "VALIDADE")))
      .orderBy(asc(evento.data), asc(evento.id)),
  ]);
  return itensCalendario(eventos, concursos, inicio, fim, hoje);
}
