/** Pendências de status (#65, #85) dos concursos do usuário (#49), no dashboard e no concurso. */
import { and, asc, eq, inArray } from "drizzle-orm";
import { type CorConcurso, corDoConcurso } from "@/domain/cores";
import type { Status } from "@/domain/enums";
import type { EventoChave } from "@/domain/eventos-chave";
import { STATUS_TERMINAIS } from "@/domain/status";
import {
  type DispensaPendencia,
  type PendenciaStatus,
  proximaPendencia,
  TIPOS_PENDENCIA,
} from "@/domain/sugestao-status";
import type { DataISO } from "@/lib/tz";
import type { Db } from "../db/client";
import { concurso, evento, pendenciaStatusDispensa } from "../db/schema";
import type { Executor } from "../repositories/tipos";

export interface ConcursoComPendencia {
  id: number;
  orgao: string;
  cargo: string;
  status: Status;
  cor: CorConcurso;
  icone: string | null;
  pendencia: PendenciaStatus;
}

/** Status sem pendências possíveis: terminais e suspenso. */
const SEM_PENDENCIA: readonly Status[] = [...STATUS_TERMINAIS, "SUSPENSO"];

/** Dispensas/adiamentos das pendências dos concursos informados. */
export async function listarDispensas(
  db: Db | Executor,
  concursoIds: readonly number[],
): Promise<Map<number, DispensaPendencia[]>> {
  const mapa = new Map<number, DispensaPendencia[]>();
  if (concursoIds.length === 0) return mapa;
  const linhas = await db
    .select({
      concursoId: pendenciaStatusDispensa.concursoId,
      regra: pendenciaStatusDispensa.regra,
      eventoId: pendenciaStatusDispensa.eventoId,
      dataEvento: pendenciaStatusDispensa.dataEvento,
      ate: pendenciaStatusDispensa.ate,
    })
    .from(pendenciaStatusDispensa)
    .where(inArray(pendenciaStatusDispensa.concursoId, [...concursoIds]));
  for (const { concursoId, ...d } of linhas)
    mapa.set(concursoId, [...(mapa.get(concursoId) ?? []), d]);
  return mapa;
}

/** Pendência exibida para um concurso (primeira não dispensada nem adiada), ou `null`. */
export async function obterPendenciaConcurso(
  db: Db | Executor,
  concursoId: number,
  status: Status,
  eventos: readonly EventoChave[],
  hoje: DataISO,
): Promise<PendenciaStatus | null> {
  if (SEM_PENDENCIA.includes(status)) return null;
  const dispensas = (await listarDispensas(db, [concursoId])).get(concursoId) ?? [];
  return proximaPendencia(status, eventos, hoje, dispensas);
}

/** Concursos com uma pendência de status em `hoje`, por órgão. */
export async function listarPendenciasStatus(
  db: Db,
  usuarioId: number,
  hoje: DataISO,
): Promise<ConcursoComPendencia[]> {
  const concursos = (
    await db
      .select({
        id: concurso.id,
        orgao: concurso.orgao,
        cargo: concurso.cargo,
        status: concurso.status,
        cor: concurso.cor,
        icone: concurso.icone,
      })
      .from(concurso)
      .where(eq(concurso.usuarioId, usuarioId))
      .orderBy(asc(concurso.orgao), asc(concurso.id))
  ).filter((c) => !SEM_PENDENCIA.includes(c.status));
  if (concursos.length === 0) return [];
  const ids = concursos.map((c) => c.id);

  const [eventos, dispensas] = await Promise.all([
    db
      .select({
        id: evento.id,
        concursoId: evento.concursoId,
        tipo: evento.tipo,
        titulo: evento.titulo,
        data: evento.data,
        hora: evento.hora,
        concluido: evento.concluido,
      })
      .from(evento)
      .where(and(inArray(evento.concursoId, ids), inArray(evento.tipo, TIPOS_PENDENCIA))),
    listarDispensas(db, ids),
  ]);
  const porConcurso = new Map<number, typeof eventos>();
  for (const e of eventos)
    porConcurso.set(e.concursoId, [...(porConcurso.get(e.concursoId) ?? []), e]);

  return concursos.flatMap((c) => {
    const pendencia = proximaPendencia(
      c.status,
      porConcurso.get(c.id) ?? [],
      hoje,
      dispensas.get(c.id) ?? [],
    );
    return pendencia ? [{ ...c, cor: corDoConcurso(c), pendencia }] : [];
  });
}
