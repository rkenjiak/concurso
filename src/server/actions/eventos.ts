"use server";

import { revalidatePath } from "next/cache";
import { idSchema } from "@/lib/schemas/comum";
import { concluidoSchema, eventoSchema } from "@/lib/schemas/evento";
import { verificarAcesso } from "../auth/acesso";
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
  const negado = await verificarAcesso();
  if (negado) return negado;
  const concursoId = idSchema.safeParse(concursoIdBruto);
  if (!concursoId.success) return falha("Concurso não encontrado.");
  const eventoId = eventoIdBruto == null ? null : idSchema.safeParse(eventoIdBruto);
  if (eventoId && !eventoId.success) return falha(INVALIDO);
  const dados = eventoSchema.safeParse(entrada);
  if (!dados.success) return falhaValidacao(dados.error);
  return executar(async () => {
    const db = getDb();
    let id: number;
    if (eventoId?.success) {
      id = eventoId.data;
      await repo.atualizarEvento(db, concursoId.data, id, dados.data);
    } else {
      id = await repo.criarEvento(db, concursoId.data, dados.data);
    }
    revalidar(concursoId.data);
    return sucesso({ id });
  });
}

export async function excluirEvento(
  concursoIdBruto: unknown,
  eventoIdBruto: unknown,
): Promise<ResultadoAcao> {
  const negado = await verificarAcesso();
  if (negado) return negado;
  const concursoId = idSchema.safeParse(concursoIdBruto);
  const eventoId = idSchema.safeParse(eventoIdBruto);
  if (!concursoId.success || !eventoId.success) return falha(INVALIDO);
  return executar(async () => {
    await repo.excluirEvento(getDb(), concursoId.data, eventoId.data);
    revalidar(concursoId.data);
    return sucesso(null);
  });
}

/** Marca (`concluido = true`) ou desmarca o evento como concluído. */
export async function alternarConcluido(
  concursoIdBruto: unknown,
  eventoIdBruto: unknown,
  concluidoBruto: unknown,
): Promise<ResultadoAcao> {
  const negado = await verificarAcesso();
  if (negado) return negado;
  const concursoId = idSchema.safeParse(concursoIdBruto);
  const eventoId = idSchema.safeParse(eventoIdBruto);
  if (!concursoId.success || !eventoId.success) return falha(INVALIDO);
  const concluido = concluidoSchema.safeParse(concluidoBruto);
  if (!concluido.success) return falhaValidacao(concluido.error);
  return executar(async () => {
    await repo.definirConcluido(getDb(), concursoId.data, eventoId.data, concluido.data);
    revalidar(concursoId.data);
    return sucesso(null);
  });
}
