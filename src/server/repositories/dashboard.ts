/**
 * Preferências de exibição do dashboard (#44): ocultar/reexibir prazos da lista de próximos
 * prazos. O app é de usuário único, então a preferência fica no próprio registro (`evento.
 * oculto_dashboard` e, para o pseudo-evento de validade, `concurso.validade_oculta_dashboard`).
 * Não é uma edição dos dados: `updated_at` é preservado.
 */
import { eq, sql } from "drizzle-orm";
import { ErroDominio } from "@/domain/erros";
import type { AlvoPrazo } from "@/domain/prazos";
import type { Db } from "../db/client";
import { concurso, evento } from "../db/schema";

/** Oculta (`true`) ou reexibe (`false`) o prazo no dashboard. */
export async function definirPrazoOculto(db: Db, alvo: AlvoPrazo, oculto: boolean): Promise<void> {
  const linhas =
    alvo.tipo === "evento"
      ? await db
          .update(evento)
          .set({ ocultoDashboard: oculto, updatedAt: sql`${evento.updatedAt}` })
          .where(eq(evento.id, alvo.eventoId))
          .returning({ id: evento.id })
      : await db
          .update(concurso)
          .set({ validadeOcultaDashboard: oculto, updatedAt: sql`${concurso.updatedAt}` })
          .where(eq(concurso.id, alvo.concursoId))
          .returning({ id: concurso.id });
  if (linhas.length === 0) {
    throw new ErroDominio(
      alvo.tipo === "evento" ? "Evento não encontrado." : "Concurso não encontrado.",
    );
  }
}
