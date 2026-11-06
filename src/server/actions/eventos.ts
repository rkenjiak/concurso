"use server";

import { revalidatePath } from "next/cache";
import { idSchema } from "@/lib/schemas/comum";
import { concluidoSchema, eventoSchema } from "@/lib/schemas/evento";
import { exigirUsuarioAcao } from "../auth/acesso";
import { getDb } from "../db/client";
import * as repo from "../repositories/eventos";
import { executar, falha, falhaValidacao, type ResultadoAcao, sucesso } from "./resultado";

const INVALIDO = "Evento não encontrado.";

function revalidar(concursoId: number) {
  revalidatePath(`/concursos/${concursoId}`);
  revalidatePath("/");
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

/** Marca (`concluido = true`) ou desmarca o evento como concluído. */
export async function alternarConcluido(
  concursoIdBruto: unknown,
  eventoIdBruto: unknown,
  concluidoBruto: unknown,
): Promise<ResultadoAcao> {
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
      await repo.definirConcluido(
        getDb(),
        usuarioId,
        concursoId.data,
        eventoId.data,
        concluido.data,
      );
      revalidar(concursoId.data);
      return sucesso(null);
    },
    { acao: "eventos.alternarConcluido", usuarioId },
  );
}
