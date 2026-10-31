/** Leituras do histórico de status (RF03). */
import { asc, eq } from "drizzle-orm";
import type { Status } from "@/domain/enums";
import { contextoDoHistorico, podeDesfazer, transicoesPermitidas } from "@/domain/status";
import type { Db } from "../db/client";
import { type StatusHistorico, statusHistorico } from "../db/schema";
import type { Executor } from "../repositories/tipos";

/** Histórico do concurso em ordem cronológica (mais antigo primeiro). */
export async function listarHistorico(
  db: Executor,
  concursoId: number,
): Promise<StatusHistorico[]> {
  return db
    .select()
    .from(statusHistorico)
    .where(eq(statusHistorico.concursoId, concursoId))
    .orderBy(asc(statusHistorico.alteradoEm), asc(statusHistorico.id));
}

export interface OpcoesStatus {
  /** Destinos permitidos a partir do status atual (já considerando suspensão). */
  transicoes: Status[];
  /** Status que seria restaurado ao desfazer a última mudança, se possível. */
  desfazerPara: Status | null;
}

/** O que a UI pode oferecer para o status atual, derivado do histórico. */
export function opcoesStatus(atual: Status, historico: readonly StatusHistorico[]): OpcoesStatus {
  const ultimo = historico.at(-1);
  return {
    transicoes: transicoesPermitidas(atual, contextoDoHistorico(historico)),
    desfazerPara: podeDesfazer(ultimo) ? (ultimo?.de ?? null) : null,
  };
}

export async function obterOpcoesStatus(
  db: Db,
  concursoId: number,
  atual: Status,
): Promise<{ historico: StatusHistorico[]; opcoes: OpcoesStatus }> {
  const historico = await listarHistorico(db, concursoId);
  return { historico, opcoes: opcoesStatus(atual, historico) };
}
