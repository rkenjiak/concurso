"use server";

import { revalidatePath } from "next/cache";
import { idSchema } from "@/lib/schemas/comum";
import { concursoEdicaoSchema, concursoSchema } from "@/lib/schemas/concurso";
import { verificarAcesso } from "../auth/acesso";
import { getDb } from "../db/client";
import * as repo from "../repositories/concursos";
import { executar, falha, falhaValidacao, type ResultadoAcao, sucesso } from "./resultado";

const NAO_ENCONTRADO = "Concurso não encontrado.";

export async function criarConcurso(entrada: unknown): Promise<ResultadoAcao<{ id: number }>> {
  const negado = await verificarAcesso();
  if (negado) return negado;
  const dados = concursoSchema.safeParse(entrada);
  if (!dados.success) return falhaValidacao(dados.error);
  return executar(async () => {
    const id = await repo.criarConcurso(getDb(), dados.data);
    revalidatePath("/concursos");
    revalidatePath("/");
    return sucesso({ id });
  });
}

export async function atualizarConcurso(
  idBruto: unknown,
  entrada: unknown,
): Promise<ResultadoAcao<{ id: number }>> {
  const negado = await verificarAcesso();
  if (negado) return negado;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha(NAO_ENCONTRADO);
  const dados = concursoEdicaoSchema.safeParse(entrada);
  if (!dados.success) return falhaValidacao(dados.error);
  return executar(async () => {
    if (!(await repo.atualizarConcurso(getDb(), id.data, dados.data))) return falha(NAO_ENCONTRADO);
    revalidatePath("/concursos");
    revalidatePath(`/concursos/${id.data}`);
    revalidatePath("/");
    return sucesso({ id: id.data });
  });
}

export async function excluirConcurso(idBruto: unknown): Promise<ResultadoAcao> {
  const negado = await verificarAcesso();
  if (negado) return negado;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha(NAO_ENCONTRADO);
  return executar(async () => {
    if (!(await repo.excluirConcurso(getDb(), id.data))) return falha(NAO_ENCONTRADO);
    revalidatePath("/concursos");
    revalidatePath("/");
    return sucesso(null);
  });
}
