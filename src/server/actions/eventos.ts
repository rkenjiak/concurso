"use server";

import { revalidatePath } from "next/cache";
import type { PendenciaStatus } from "@/domain/sugestao-status";
import { idSchema } from "@/lib/schemas/comum";
import { concluidoSchema, eventoSchema } from "@/lib/schemas/evento";
import { hojeSP } from "@/lib/tz";
import { exigirUsuarioAcao } from "../auth/acesso";
import { getDb } from "../db/client";
import { obterPendenciaDoEvento } from "../queries/sugestoes";
import * as repo from "../repositories/eventos";
import { executar, falha, falhaValidacao, type ResultadoAcao, sucesso } from "./resultado";

const INVALIDO = "Evento não encontrado.";

/**
 * Eventos aparecem no detalhe, no dashboard, no calendário, em /notificacoes e no contador do
 * sino (calculado no layout): revalida o layout raiz, que cobre todas essas telas (#100, D15).
 */
function revalidar(concursoId: number) {
  revalidatePath(`/concursos/${concursoId}`);
  revalidatePath("/", "layout");
}

/** Cria (`eventoId` nulo) ou atualiza um evento do concurso. */
export async function salvarEvento(
  concursoIdBruto: unknown,
  eventoIdBruto: unknown,
  entrada: unknown,
): Promise<ResultadoAcao<{ id: number }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const concursoId = idSchema.safeParse(concursoIdBruto);
  if (!concursoId.success) return falha("Concurso não encontrado.");
  const eventoId = eventoIdBruto == null ? null : idSchema.safeParse(eventoIdBruto);
  if (eventoId && !eventoId.success) return falha(INVALIDO);
  const dados = eventoSchema.safeParse(entrada);
  if (!dados.success) return falhaValidacao(dados.error);
  return executar(
    async () => {
      const db = getDb();
      let id: number;
      if (eventoId?.success) {
        id = eventoId.data;
        await repo.atualizarEvento(db, usuarioId, concursoId.data, id, dados.data);
      } else {
        id = await repo.criarEvento(db, usuarioId, concursoId.data, dados.data);
      }
      revalidar(concursoId.data);
      return sucesso({ id });
    },
    { acao: "eventos.salvarEvento", usuarioId },
  );
}

export async function excluirEvento(
  concursoIdBruto: unknown,
  eventoIdBruto: unknown,
): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const concursoId = idSchema.safeParse(concursoIdBruto);
  const eventoId = idSchema.safeParse(eventoIdBruto);
  if (!concursoId.success || !eventoId.success) return falha(INVALIDO);
  return executar(
    async () => {
      await repo.excluirEvento(getDb(), usuarioId, concursoId.data, eventoId.data);
      revalidar(concursoId.data);
      return sucesso(null);
    },
    { acao: "eventos.excluirEvento", usuarioId },
  );
}

export interface ResultadoConcluir {
  /**
   * Pendência de status do evento recém-concluído (#100, D5), para o painel perguntar na hora;
   * `null` ao reabrir ou se a pendência atual do concurso for de outro evento.
   */
  pendencia: PendenciaStatus | null;
}

/**
 * Marca (`concluido = true`) ou desmarca o evento como concluído. O evento precisa ser do
 * concurso, e o concurso do usuário (D15, verificado no repositório).
 */
export async function alternarConcluido(
  concursoIdBruto: unknown,
  eventoIdBruto: unknown,
  concluidoBruto: unknown,
): Promise<ResultadoAcao<ResultadoConcluir>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const concursoId = idSchema.safeParse(concursoIdBruto);
  const eventoId = idSchema.safeParse(eventoIdBruto);
  if (!concursoId.success || !eventoId.success) return falha(INVALIDO);
  const concluido = concluidoSchema.safeParse(concluidoBruto);
  if (!concluido.success) return falhaValidacao(concluido.error);
  return executar(
    async () => {
      const db = getDb();
      await repo.definirConcluido(db, usuarioId, concursoId.data, eventoId.data, concluido.data);
      revalidar(concursoId.data);
      const pendencia = concluido.data
        ? await obterPendenciaDoEvento(db, usuarioId, concursoId.data, eventoId.data, hojeSP())
        : null;
      return sucesso({ pendencia });
    },
    { acao: "eventos.alternarConcluido", usuarioId },
  );
}
