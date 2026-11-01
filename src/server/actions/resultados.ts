"use server";

import { revalidatePath } from "next/cache";
import { idSchema } from "@/lib/schemas/comum";
import { resultadoFaseSchema } from "@/lib/schemas/resultado-fase";
import { exigirUsuarioAcao } from "../auth/acesso";
import { getDb } from "../db/client";
import * as repo from "../repositories/resultados";
import { executar, falha, falhaValidacao, type ResultadoAcao, sucesso } from "./resultado";

const INVALIDO = "Resultado não encontrado.";

/** Cria (`resultadoId` nulo) ou atualiza o resultado de uma fase do concurso. */
export async function salvarResultadoFase(
  concursoIdBruto: unknown,
  resultadoIdBruto: unknown,
  entrada: unknown,
): Promise<ResultadoAcao<{ id: number }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const concursoId = idSchema.safeParse(concursoIdBruto);
  if (!concursoId.success) return falha("Concurso não encontrado.");
  const resultadoId = resultadoIdBruto == null ? null : idSchema.safeParse(resultadoIdBruto);
  if (resultadoId && !resultadoId.success) return falha(INVALIDO);
  const dados = resultadoFaseSchema.safeParse(entrada);
  if (!dados.success) return falhaValidacao(dados.error);
  return executar(async () => {
    const db = getDb();
    let id: number;
    if (resultadoId?.success) {
      id = resultadoId.data;
      await repo.atualizarResultadoFase(db, usuarioId, concursoId.data, id, dados.data);
    } else {
      id = await repo.criarResultadoFase(db, usuarioId, concursoId.data, dados.data);
    }
    revalidatePath(`/concursos/${concursoId.data}`);
    return sucesso({ id });
  });
}

export async function excluirResultadoFase(
  concursoIdBruto: unknown,
  resultadoIdBruto: unknown,
): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const concursoId = idSchema.safeParse(concursoIdBruto);
  const resultadoId = idSchema.safeParse(resultadoIdBruto);
  if (!concursoId.success || !resultadoId.success) return falha(INVALIDO);
  return executar(async () => {
    await repo.excluirResultadoFase(getDb(), usuarioId, concursoId.data, resultadoId.data);
    revalidatePath(`/concursos/${concursoId.data}`);
    return sucesso(null);
  });
}
