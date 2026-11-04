/**
 * Pendências de status (#85): dispensar ("não perguntar mais") ou adiar ("lembrar depois").
 * A pendência é recalculada no domínio; aqui só se guarda a preferência, restrita ao concurso
 * do usuário (#49) e a um evento desse concurso.
 */
import { and, eq } from "drizzle-orm";
import { ErroDominio } from "@/domain/erros";
import type { RegraPendencia } from "@/domain/sugestao-status";
import type { DataISO } from "@/lib/tz";
import type { Db } from "../db/client";
import { evento, pendenciaStatusDispensa } from "../db/schema";
import { exigirConcurso } from "./eventos";

export interface DadosDispensa {
  regra: RegraPendencia;
  eventoId: number;
  dataEvento: DataISO;
  /** `null` = dispensada; data = volta a aparecer a partir desse dia. */
  ate: DataISO | null;
}

/** Grava (ou substitui) a dispensa da pendência do evento. */
export async function dispensarPendencia(
  db: Db,
  usuarioId: number,
  concursoId: number,
  dados: DadosDispensa,
): Promise<void> {
  await db.transaction(async (tx) => {
    await exigirConcurso(tx, usuarioId, concursoId);
    const [ev] = await tx
      .select({ id: evento.id })
      .from(evento)
      .where(and(eq(evento.id, dados.eventoId), eq(evento.concursoId, concursoId)));
    if (!ev) throw new ErroDominio("Evento não encontrado.");
    await tx
      .insert(pendenciaStatusDispensa)
      .values({ concursoId, ...dados })
      .onConflictDoUpdate({
        target: [pendenciaStatusDispensa.eventoId, pendenciaStatusDispensa.regra],
        set: { dataEvento: dados.dataEvento, ate: dados.ate, createdAt: new Date() },
      });
  });
}
