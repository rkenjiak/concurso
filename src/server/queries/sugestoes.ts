/** Sugestões de status (#65) para os concursos do usuário (#49), exibidas no dashboard. */
import { and, asc, eq, inArray } from "drizzle-orm";
import { type CorConcurso, corDoConcurso } from "@/domain/cores";
import type { Status } from "@/domain/enums";
import { TRILHA_PRINCIPAL } from "@/domain/status";
import { type SugestaoStatus, sugerirStatus } from "@/domain/sugestao-status";
import type { DataISO } from "@/lib/tz";
import type { Db } from "../db/client";
import { concurso, evento } from "../db/schema";

export interface ConcursoComSugestao {
  id: number;
  orgao: string;
  cargo: string;
  status: Status;
  cor: CorConcurso;
  icone: string | null;
  sugestao: SugestaoStatus;
}

/** Status a partir dos quais pode haver sugestão (trilha principal, de "Inscrito" em diante). */
const STATUS_COM_SUGESTAO = TRILHA_PRINCIPAL.slice(TRILHA_PRINCIPAL.indexOf("INSCRITO"));

/** Concursos com sugestão de próximo status em `hoje`, por órgão. */
export async function listarSugestoesStatus(
  db: Db,
  usuarioId: number,
  hoje: DataISO,
): Promise<ConcursoComSugestao[]> {
  const concursos = await db
    .select({
      id: concurso.id,
      orgao: concurso.orgao,
      cargo: concurso.cargo,
      status: concurso.status,
      cor: concurso.cor,
      icone: concurso.icone,
    })
    .from(concurso)
    .where(and(eq(concurso.usuarioId, usuarioId), inArray(concurso.status, STATUS_COM_SUGESTAO)))
    .orderBy(asc(concurso.orgao), asc(concurso.id));
  if (concursos.length === 0) return [];

  const eventos = await db
    .select({
      id: evento.id,
      concursoId: evento.concursoId,
      tipo: evento.tipo,
      titulo: evento.titulo,
      data: evento.data,
      concluido: evento.concluido,
    })
    .from(evento)
    .where(
      and(
        inArray(
          evento.concursoId,
          concursos.map((c) => c.id),
        ),
        inArray(evento.tipo, ["PROVA_OBJETIVA", "PROVA_DISCURSIVA", "PRAZO_RECURSO"]),
      ),
    );
  const porConcurso = new Map<number, typeof eventos>();
  for (const e of eventos)
    porConcurso.set(e.concursoId, [...(porConcurso.get(e.concursoId) ?? []), e]);

  return concursos.flatMap((c) => {
    const sugestao = sugerirStatus(c.status, porConcurso.get(c.id) ?? [], hoje);
    return sugestao ? [{ ...c, cor: corDoConcurso(c), sugestao }] : [];
  });
}
