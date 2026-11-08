"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { lerChavePrazo } from "@/domain/prazos";
import { exigirUsuarioAcao } from "../auth/acesso";
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
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const alvo = lerChavePrazo(chaveBruta);
  if (!alvo) return falha("Prazo não encontrado.");
  const oculto = ocultoSchema.safeParse(ocultoBruto);
  if (!oculto.success) return falhaValidacao(oculto.error);
  return executar(
    async () => {
      await definirPrazoOculto(getDb(), usuarioId, alvo, oculto.data);
      revalidatePath("/");
      // O painel do evento no calendário também mostra o estado (#100).
      revalidatePath("/calendario");
      return sucesso(null);
    },
    { acao: "dashboard.alternarPrazoOculto", usuarioId },
  );
}
