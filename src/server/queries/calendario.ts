/** Leituras do calendário mensal (RF04/RF06), restritas aos concursos do usuário (#49). */
import { and, asc, between, eq, or } from "drizzle-orm";
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
  eventoDoUsuario,
  listarConcursosDoPrazo,
} from "./dashboard";

export type ItemDoCalendario = ItemCalendario<EventoDoPrazo, ConcursoDoPrazo>;

/** Limites que cobrem qualquer data `YYYY-MM-DD` válida (anos 1000–9999). */
const INICIO_SEMPRE = "1000-01-01";
const FIM_SEMPRE = "9999-12-31";

/**
 * Itens do mês (`AAAA-MM`): eventos do período (concluídos inclusive) e fins de validade
 * calculados. Também lê os eventos `VALIDADE` fora do mês, que suprimem o pseudo-evento.
 */
export async function obterCalendario(
  db: Db,
  usuarioId: number,
  mes: MesISO,
  hoje: DataISO,
): Promise<ItemDoCalendario[]> {
  const inicio = primeiroDia(mes);
  const fim = ultimoDia(mes);
  const [concursos, eventos] = await Promise.all([
    listarConcursosDoPrazo(db, usuarioId),
    db
      .select(COLUNAS_EVENTO_PRAZO)
      .from(evento)
      .where(
        and(
          eventoDoUsuario(db, usuarioId),
          or(between(evento.data, inicio, fim), eq(evento.tipo, "VALIDADE")),
        ),
      )
      .orderBy(asc(evento.data), asc(evento.id)),
  ]);
  return itensCalendario(eventos, concursos, inicio, fim, hoje);
}

export interface CalendarioCompleto {
  /** Todos os concursos do usuário (para o filtro, #83), na ordem de `listarConcursosDoPrazo`. */
  concursos: ConcursoDoPrazo[];
  /** Itens de todas as datas, ordenados; o mês exibido é um recorte (`itensDoMes`). */
  itens: ItemDoCalendario[];
}

/**
 * Todos os itens do calendário do usuário, de qualquer data (#83): a página recorta o mês exibido
 * e usa o resto para a contagem por mês do seletor e os atalhos "próximo mês com eventos" e
 * "próxima prova". Um app pessoal tem poucas centenas de eventos: uma leitura só é mais simples
 * (e mais barata) que várias consultas agregadas.
 */
export async function obterCalendarioCompleto(
  db: Db,
  usuarioId: number,
  hoje: DataISO,
): Promise<CalendarioCompleto> {
  const [concursos, eventos] = await Promise.all([
    listarConcursosDoPrazo(db, usuarioId),
    db
      .select(COLUNAS_EVENTO_PRAZO)
      .from(evento)
      .where(eventoDoUsuario(db, usuarioId))
      .orderBy(asc(evento.data), asc(evento.id)),
  ]);
  return { concursos, itens: itensCalendario(eventos, concursos, INICIO_SEMPRE, FIM_SEMPRE, hoje) };
}
