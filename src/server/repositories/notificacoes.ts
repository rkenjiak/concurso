/**
 * Escritas das notificações do app (#65): personalização das regras por usuário, estado de
 * leitura/dispensa e silenciamento por concurso. As notificações em si não são guardadas: são
 * calculadas sob demanda (`domain/notificacoes`, `queries/notificacoes`).
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { ErroDominio } from "@/domain/erros";
import {
  type AlvoNotificacao,
  chaveNotificacao,
  ehRegraPadrao,
  normalizarAntecedencias,
  type RegraNotificacao,
} from "@/domain/notificacoes";
import type { Db } from "../db/client";
import { concurso, evento, notificacaoEstado, regraNotificacao } from "../db/schema";
import { doUsuario } from "./concursos";
import type { Executor } from "./tipos";

/** Antecedências como guardadas no banco: `7,1,0`. */
export const serializarAntecedencias = (dias: readonly number[]) =>
  normalizarAntecedencias(dias).join(",");

/** Lê o texto do banco; itens inválidos são descartados (a mescla com o padrão valida o resto). */
export const lerAntecedenciasBanco = (texto: string) =>
  texto
    .split(",")
    .filter((p) => /^\d+$/.test(p))
    .map(Number);

/** Regras personalizadas do usuário (só os tipos que diferem do padrão). */
export async function listarRegrasPersonalizadas(
  db: Executor,
  usuarioId: number,
): Promise<RegraNotificacao[]> {
  const linhas = await db
    .select()
    .from(regraNotificacao)
    .where(eq(regraNotificacao.usuarioId, usuarioId));
  return linhas.map((l) => ({
    tipo: l.tipo,
    ativo: l.ativo,
    antecedencias: lerAntecedenciasBanco(l.antecedencias),
  }));
}

/**
 * Salva as regras informadas (um item por tipo). Tipos iguais ao padrão deixam de ser guardados,
 * para continuarem seguindo o padrão se ele mudar numa versão futura.
 */
export async function salvarRegras(
  db: Db,
  usuarioId: number,
  regras: readonly RegraNotificacao[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const r of regras) {
      if (ehRegraPadrao(r)) {
        await tx
          .delete(regraNotificacao)
          .where(and(eq(regraNotificacao.usuarioId, usuarioId), eq(regraNotificacao.tipo, r.tipo)));
        continue;
      }
      const valores = { ativo: r.ativo, antecedencias: serializarAntecedencias(r.antecedencias) };
      await tx
        .insert(regraNotificacao)
        .values({ usuarioId, tipo: r.tipo, ...valores })
        .onConflictDoUpdate({
          target: [regraNotificacao.usuarioId, regraNotificacao.tipo],
          set: valores,
        });
    }
  });
}

/** Volta todas as regras ao padrão. */
export async function restaurarRegrasPadrao(db: Executor, usuarioId: number): Promise<void> {
  await db.delete(regraNotificacao).where(eq(regraNotificacao.usuarioId, usuarioId));
}

export type AcaoNotificacao = "LER" | "DISPENSAR";

interface AlvoResolvido {
  chave: string;
  concursoId: number;
  eventoId: number | null;
  antecedencia: number;
}

/** Confere que os alvos são do usuário e descobre o concurso de cada um. */
async function resolverAlvos(
  db: Executor,
  usuarioId: number,
  alvos: readonly AlvoNotificacao[],
): Promise<AlvoResolvido[]> {
  const idsEvento = [...new Set(alvos.flatMap((a) => (a.tipo === "evento" ? [a.eventoId] : [])))];
  const idsConcurso = [
    ...new Set(alvos.flatMap((a) => (a.tipo === "validade" ? [a.concursoId] : []))),
  ];
  const [eventos, concursos] = await Promise.all([
    idsEvento.length === 0
      ? []
      : db
          .select({ id: evento.id, concursoId: evento.concursoId })
          .from(evento)
          .innerJoin(concurso, eq(concurso.id, evento.concursoId))
          .where(and(inArray(evento.id, idsEvento), eq(concurso.usuarioId, usuarioId))),
    idsConcurso.length === 0
      ? []
      : db
          .select({ id: concurso.id })
          .from(concurso)
          .where(and(inArray(concurso.id, idsConcurso), eq(concurso.usuarioId, usuarioId))),
  ]);
  const concursoDoEvento = new Map(eventos.map((e) => [e.id, e.concursoId]));
  const concursosDoUsuario = new Set(concursos.map((c) => c.id));

  return alvos.map((a) => {
    if (a.tipo === "evento") {
      const concursoId = concursoDoEvento.get(a.eventoId);
      if (concursoId === undefined) throw new ErroDominio("Notificação não encontrada.");
      return {
        chave: chaveNotificacao(`evento-${a.eventoId}`, a.antecedencia),
        concursoId,
        eventoId: a.eventoId,
        antecedencia: a.antecedencia,
      };
    }
    if (!concursosDoUsuario.has(a.concursoId)) {
      throw new ErroDominio("Notificação não encontrada.");
    }
    return {
      chave: chaveNotificacao(`validade-${a.concursoId}`, a.antecedencia),
      concursoId: a.concursoId,
      eventoId: null,
      antecedencia: a.antecedencia,
    };
  });
}

/**
 * Marca notificações como lidas (`LER`) ou dispensadas (`DISPENSAR`, que também conta como
 * lida). Falha sem gravar nada se algum alvo não for do usuário.
 */
export async function marcarNotificacoes(
  db: Db,
  usuarioId: number,
  alvos: readonly AlvoNotificacao[],
  acao: AcaoNotificacao,
  agora: Date = new Date(),
): Promise<void> {
  if (alvos.length === 0) return;
  await db.transaction(async (tx) => {
    const resolvidos = await resolverAlvos(tx, usuarioId, alvos);
    for (const r of resolvidos) {
      const set =
        acao === "LER"
          ? { lidaEm: sql`coalesce(${notificacaoEstado.lidaEm}, ${agora.getTime()})` }
          : {
              lidaEm: sql`coalesce(${notificacaoEstado.lidaEm}, ${agora.getTime()})`,
              dispensadaEm: agora,
            };
      await tx
        .insert(notificacaoEstado)
        .values({
          ...r,
          lidaEm: agora,
          dispensadaEm: acao === "DISPENSAR" ? agora : null,
        })
        .onConflictDoUpdate({ target: notificacaoEstado.chave, set });
    }
  });
}

/** Silencia (ou reativa) as notificações e alarmes de um concurso, sem alterar `updated_at`. */
export async function definirConcursoSilenciado(
  db: Db,
  usuarioId: number,
  concursoId: number,
  silenciado: boolean,
): Promise<void> {
  const linhas = await db
    .update(concurso)
    .set({ notificacoesSilenciadas: silenciado, updatedAt: sql`${concurso.updatedAt}` })
    .where(doUsuario(usuarioId, concursoId))
    .returning({ id: concurso.id });
  if (linhas.length === 0) throw new ErroDominio("Concurso não encontrado.");
}
