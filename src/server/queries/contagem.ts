/** Contagem regressiva até a próxima prova (#84) dos concursos do usuário (#49), para o dashboard. */
import { and, asc, eq, gte, inArray, notInArray } from "drizzle-orm";
import {
  type Contagem,
  compararContagens,
  contagemRegressiva,
  TIPOS_CONTAGEM_PADRAO,
} from "@/domain/contagem";
import { type CorConcurso, corDoConcurso } from "@/domain/cores";
import { STATUS_TERMINAIS } from "@/domain/status";
import type { DataISO } from "@/lib/tz";
import type { Db } from "../db/client";
import { concurso, evento } from "../db/schema";

export interface EventoDaContagem {
  id: number;
  tipo: (typeof evento.$inferSelect)["tipo"];
  titulo: string | null;
  data: DataISO;
  hora: string | null;
  concluido: boolean;
}

export interface ConcursoComContagem {
  concursoId: number;
  orgao: string;
  cargo: string;
  cor: CorConcurso;
  icone: string | null;
  contagem: Contagem<EventoDaContagem>;
}

/** Concursos em andamento com prova futura, da mais próxima para a mais distante. */
export async function listarContagens(
  db: Db,
  usuarioId: number,
  hoje: DataISO,
): Promise<ConcursoComContagem[]> {
  const linhas = await db
    .select({
      concursoId: concurso.id,
      orgao: concurso.orgao,
      cargo: concurso.cargo,
      status: concurso.status,
      corEscolhida: concurso.cor,
      icone: concurso.icone,
      id: evento.id,
      tipo: evento.tipo,
      titulo: evento.titulo,
      data: evento.data,
      hora: evento.hora,
      concluido: evento.concluido,
    })
    .from(evento)
    .innerJoin(concurso, eq(evento.concursoId, concurso.id))
    .where(
      and(
        eq(concurso.usuarioId, usuarioId),
        notInArray(concurso.status, [...STATUS_TERMINAIS, "SUSPENSO"]),
        inArray(evento.tipo, TIPOS_CONTAGEM_PADRAO),
        eq(evento.concluido, false),
        gte(evento.data, hoje),
      ),
    )
    .orderBy(asc(evento.data), asc(evento.hora), asc(evento.id));

  const porConcurso = new Map<number, typeof linhas>();
  for (const l of linhas)
    porConcurso.set(l.concursoId, [...(porConcurso.get(l.concursoId) ?? []), l]);

  const resultado: ConcursoComContagem[] = [];
  for (const [concursoId, eventos] of porConcurso) {
    const c = eventos[0];
    if (!c) continue;
    const contagem = contagemRegressiva(
      c.status,
      eventos.map(({ id, tipo, titulo, data, hora, concluido }) => ({
        id,
        tipo,
        titulo,
        data,
        hora,
        concluido,
      })),
      hoje,
    );
    if (!contagem) continue;
    resultado.push({
      concursoId,
      orgao: c.orgao,
      cargo: c.cargo,
      cor: corDoConcurso({ id: concursoId, cor: c.corEscolhida }),
      icone: c.icone,
      contagem,
    });
  }
  return resultado.sort(compararContagens);
}
