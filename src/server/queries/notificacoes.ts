/**
 * Leituras das notificações do app (#65), restritas aos concursos do usuário (#49). As
 * notificações são calculadas sob demanda a partir dos eventos pendentes, das regras e de `hoje`
 * (`domain/notificacoes`); do banco vêm só as regras personalizadas e o estado de leitura.
 */
import { and, asc, eq, gte, inArray, lte, or } from "drizzle-orm";
import {
  ANTECEDENCIA_MAXIMA,
  contarNaoLidas,
  type EstadoNotificacao,
  mesclarRegras,
  type Notificacao,
  notificacoesDisparadas,
  type RegrasNotificacao,
} from "@/domain/notificacoes";
import { type DataISO, somarDias } from "@/lib/tz";
import type { Db } from "../db/client";
import { concurso, evento, notificacaoEstado } from "../db/schema";
import { listarRegrasPersonalizadas } from "../repositories/notificacoes";
import type { Executor } from "../repositories/tipos";
import {
  COLUNAS_EVENTO_PRAZO,
  type ConcursoDoPrazo,
  type EventoDoPrazo,
  eventoDoUsuario,
  listarConcursosDoPrazo,
} from "./dashboard";

export type NotificacaoDoUsuario = Notificacao<EventoDoPrazo, ConcursoDoPrazo>;

/** Regras efetivas do usuário: o padrão com as personalizações dele. */
export async function obterRegras(db: Executor, usuarioId: number): Promise<RegrasNotificacao> {
  return mesclarRegras(await listarRegrasPersonalizadas(db, usuarioId));
}

/** Estado (lida/dispensada) das notificações do usuário, por chave. */
async function estadosDoUsuario(
  db: Db,
  usuarioId: number,
): Promise<Map<string, EstadoNotificacao>> {
  const linhas = await db
    .select({
      chave: notificacaoEstado.chave,
      lidaEm: notificacaoEstado.lidaEm,
      dispensadaEm: notificacaoEstado.dispensadaEm,
    })
    .from(notificacaoEstado)
    .where(
      inArray(
        notificacaoEstado.concursoId,
        db.select({ id: concurso.id }).from(concurso).where(eq(concurso.usuarioId, usuarioId)),
      ),
    );
  return new Map(
    linhas.map((l) => [l.chave, { lida: l.lidaEm !== null, dispensada: l.dispensadaEm !== null }]),
  );
}

/**
 * Notificações disparadas em `hoje` (mais recentes primeiro), sem as dispensadas. Lê só os
 * eventos pendentes de hoje até a maior antecedência possível (e os de validade, que suprimem o
 * pseudo-evento).
 */
export async function obterNotificacoes(
  db: Db,
  usuarioId: number,
  hoje: DataISO,
): Promise<NotificacaoDoUsuario[]> {
  const [concursos, eventos, regras, estados] = await Promise.all([
    listarConcursosDoPrazo(db, usuarioId),
    db
      .select(COLUNAS_EVENTO_PRAZO)
      .from(evento)
      .where(
        and(
          eventoDoUsuario(db, usuarioId),
          or(
            and(
              eq(evento.concluido, false),
              gte(evento.data, hoje),
              lte(evento.data, somarDias(hoje, ANTECEDENCIA_MAXIMA)),
            ),
            eq(evento.tipo, "VALIDADE"),
          ),
        ),
      )
      .orderBy(asc(evento.data), asc(evento.id)),
    obterRegras(db, usuarioId),
    estadosDoUsuario(db, usuarioId),
  ]);
  return notificacoesDisparadas(eventos, concursos, regras, hoje, estados);
}

/** Quantidade de notificações não lidas em `hoje` (contador do sino). */
export async function contarNotificacoesNaoLidas(
  db: Db,
  usuarioId: number,
  hoje: DataISO,
): Promise<number> {
  return contarNaoLidas(await obterNotificacoes(db, usuarioId, hoje));
}
