/**
 * Calendário `.ics` do usuário (RF08, #65): download manual (todos os concursos ou um só) e feed
 * assinável. Só os dados do usuário (#49); a geração fica em `domain/icalendar`.
 */
import { and, asc, eq } from "drizzle-orm";
import { eventosDoCalendario, gerarIcs } from "@/domain/icalendar";
import { calcularValidadeFim } from "@/domain/validade";
import type { Db } from "../db/client";
import { concurso, evento } from "../db/schema";
import { obterRegras } from "./notificacoes";

export interface OpcoesIcsUsuario {
  /** Só este concurso (download do detalhe); ausente = todos. */
  concursoId?: number;
  incluirConcluidos: boolean;
  incluirEncerrados: boolean;
  /** Origem do app, para os links dos eventos e o domínio dos `UID`s. */
  urlBase: string;
}

/**
 * Gera o `.ics` com os eventos do usuário. Com `concursoId`, devolve `null` se o concurso não é
 * dele (ou não existe).
 */
export async function gerarIcsDoUsuario(
  db: Db,
  usuarioId: number,
  opcoes: OpcoesIcsUsuario,
  agora: Date = new Date(),
): Promise<string | null> {
  const doConcurso =
    opcoes.concursoId === undefined ? undefined : eq(concurso.id, opcoes.concursoId);
  const [concursos, eventos, regras] = await Promise.all([
    db
      .select({
        id: concurso.id,
        orgao: concurso.orgao,
        cargo: concurso.cargo,
        status: concurso.status,
        icone: concurso.icone,
        notificacoesSilenciadas: concurso.notificacoesSilenciadas,
        homologacaoData: concurso.homologacaoData,
        validadeMeses: concurso.validadeMeses,
        validadeProrrogada: concurso.validadeProrrogada,
        validadeFimManual: concurso.validadeFimManual,
        updatedAt: concurso.updatedAt,
      })
      .from(concurso)
      .where(and(eq(concurso.usuarioId, usuarioId), doConcurso))
      .orderBy(asc(concurso.id)),
    db
      .select({
        id: evento.id,
        concursoId: evento.concursoId,
        tipo: evento.tipo,
        titulo: evento.titulo,
        data: evento.data,
        hora: evento.hora,
        local: evento.local,
        observacao: evento.observacao,
        concluido: evento.concluido,
        updatedAt: evento.updatedAt,
      })
      .from(evento)
      .innerJoin(concurso, eq(concurso.id, evento.concursoId))
      .where(and(eq(concurso.usuarioId, usuarioId), doConcurso))
      .orderBy(asc(evento.data), asc(evento.id)),
    obterRegras(db, usuarioId),
  ]);
  if (opcoes.concursoId !== undefined && concursos.length === 0) return null;

  const unico = concursos.length === 1 && opcoes.concursoId !== undefined ? concursos[0] : null;
  return gerarIcs(
    {
      nome: unico ? `${unico.orgao} — ${unico.cargo}` : "Concursos",
      descricao: "Prazos e eventos dos seus concursos públicos.",
      eventos: eventosDoCalendario(
        eventos,
        concursos.map((c) => ({
          ...c,
          validadeFim: calcularValidadeFim(c),
        })),
        {
          regras,
          incluirConcluidos: opcoes.incluirConcluidos,
          incluirEncerrados: opcoes.incluirEncerrados,
          urlBase: opcoes.urlBase,
        },
      ),
    },
    agora,
  );
}
