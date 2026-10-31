"use server";

import { revalidatePath } from "next/cache";
import type { Status } from "@/domain/enums";
import { idSchema } from "@/lib/schemas/comum";
import { alterarStatusSchema } from "@/lib/schemas/status";
import { verificarAcesso } from "../auth/acesso";
import { getDb } from "../db/client";
import * as repo from "../repositories/status";
import { executar, falha, falhaValidacao, type ResultadoAcao, sucesso } from "./resultado";

function revalidar(id: number) {
  revalidatePath(`/concursos/${id}`);
  revalidatePath("/concursos");
  revalidatePath("/");
}

export async function alterarStatus(idBruto: unknown, entrada: unknown): Promise<ResultadoAcao> {
  const negado = await verificarAcesso();
  if (negado) return negado;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha("Concurso não encontrado.");
  const dados = alterarStatusSchema.safeParse(entrada);
  if (!dados.success) return falhaValidacao(dados.error);
  return executar(async () => {
    await repo.alterarStatus(getDb(), id.data, dados.data.para, dados.data.observacao);
    revalidar(id.data);
    return sucesso(null);
  });
}

export async function desfazerUltimoStatus(
  idBruto: unknown,
): Promise<ResultadoAcao<{ status: Status }>> {
  const negado = await verificarAcesso();
  if (negado) return negado;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha("Concurso não encontrado.");
  return executar(async () => {
    const status = await repo.desfazerUltimoStatus(getDb(), id.data);
    revalidar(id.data);
    return sucesso({ status });
  });
}
