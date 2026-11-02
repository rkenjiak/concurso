"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirUsuarioAcao } from "../auth/acesso";
import { getDb } from "../db/client";
import { definirOpcoesIcs, gerarTokenIcs, revogarTokenIcs } from "../repositories/usuarios";
import { executar, falha, type ResultadoAcao, sucesso } from "./resultado";

/**
 * Gera o token do feed de calendário (#65), invalidando o anterior (e o link já assinado). O
 * token só é devolvido agora: o banco guarda apenas o resumo.
 */
export async function gerarTokenIcsAcao(): Promise<ResultadoAcao<{ token: string }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  return executar(async () => {
    const token = await gerarTokenIcs(getDb(), sessao.usuario.id);
    revalidatePath("/configuracoes");
    return sucesso({ token });
  });
}

/** Revoga o token do feed: calendários assinados deixam de atualizar. */
export async function revogarTokenIcsAcao(): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  return executar(async () => {
    await revogarTokenIcs(getDb(), sessao.usuario.id);
    revalidatePath("/configuracoes");
    return sucesso(null);
  });
}

const opcoesSchema = z.object({
  incluirConcluidos: z.boolean(),
  incluirEncerrados: z.boolean(),
});

/** Opções do feed (valem também para o download de todos os concursos). */
export async function salvarOpcoesIcsAcao(entrada: unknown): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const opcoes = opcoesSchema.safeParse(entrada);
  if (!opcoes.success) return falha("Opções inválidas.");
  return executar(async () => {
    await definirOpcoesIcs(getDb(), sessao.usuario.id, opcoes.data);
    revalidatePath("/configuracoes");
    return sucesso(null);
  });
}
