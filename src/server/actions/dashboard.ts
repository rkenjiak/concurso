"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { lerChavePrazo } from "@/domain/prazos";
import { verificarAcesso } from "../auth/acesso";
import { getDb } from "../db/client";
import { definirPrazoOculto } from "../repositories/dashboard";
import { executar, falha, falhaValidacao, type ResultadoAcao, sucesso } from "./resultado";

const ocultoSchema = z.boolean({ error: "Valor inválido." });

/**
 * Oculta (`oculto = true`) ou reexibe um prazo do dashboard (#44). `chave` é a chave do prazo na
 * lista: `evento-<id>` ou `validade-<concursoId>` (pseudo-evento de fim da validade).
 */
export async function alternarPrazoOculto(
  chaveBruta: unknown,
  ocultoBruto: unknown,
): Promise<ResultadoAcao> {
  const negado = await verificarAcesso();
  if (negado) return negado;
  const alvo = lerChavePrazo(chaveBruta);
  if (!alvo) return falha("Prazo não encontrado.");
  const oculto = ocultoSchema.safeParse(ocultoBruto);
  if (!oculto.success) return falhaValidacao(oculto.error);
  return executar(async () => {
    await definirPrazoOculto(getDb(), alvo, oculto.data);
    revalidatePath("/");
    return sucesso(null);
  });
}
