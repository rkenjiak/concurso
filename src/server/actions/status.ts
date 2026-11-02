"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { STATUS, type Status } from "@/domain/enums";
import { sugerirStatus } from "@/domain/sugestao-status";
import { idSchema } from "@/lib/schemas/comum";
import { alterarStatusSchema } from "@/lib/schemas/status";
import { hojeSP } from "@/lib/tz";
import { exigirUsuarioAcao } from "../auth/acesso";
import { getDb } from "../db/client";
import { obterConcurso } from "../queries/concursos";
import { listarEventos } from "../queries/eventos";
import * as repo from "../repositories/status";
import { executar, falha, falhaValidacao, type ResultadoAcao, sucesso } from "./resultado";

function revalidar(id: number) {
  revalidatePath(`/concursos/${id}`);
  revalidatePath("/concursos");
  revalidatePath("/");
}

export async function alterarStatus(idBruto: unknown, entrada: unknown): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha("Concurso não encontrado.");
  const dados = alterarStatusSchema.safeParse(entrada);
  if (!dados.success) return falhaValidacao(dados.error);
  return executar(async () => {
    await repo.alterarStatus(getDb(), usuarioId, id.data, dados.data.para, dados.data.observacao);
    revalidar(id.data);
    return sucesso(null);
  });
}

export async function desfazerUltimoStatus(
  idBruto: unknown,
): Promise<ResultadoAcao<{ status: Status }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha("Concurso não encontrado.");
  return executar(async () => {
    const status = await repo.desfazerUltimoStatus(getDb(), usuarioId, id.data);
    revalidar(id.data);
    return sucesso({ status });
  });
}

/**
 * Aplica a sugestão de status do concurso (#65). A sugestão é recalculada aqui (não confia no
 * cliente) e aplicada pela mesma transição validada, com o motivo na observação do histórico.
 * `esperado` é o status sugerido que o usuário viu: se a sugestão mudou, nada é alterado.
 */
export async function aplicarSugestaoStatus(
  idBruto: unknown,
  esperadoBruto: unknown,
): Promise<ResultadoAcao<{ status: Status }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha("Concurso não encontrado.");
  const esperado = z.enum(STATUS).safeParse(esperadoBruto);
  if (!esperado.success) return falha("Sugestão inválida.");
  return executar(async () => {
    const db = getDb();
    const concurso = await obterConcurso(db, usuarioId, id.data);
    if (!concurso) return falha("Concurso não encontrado.");
    const sugestao = sugerirStatus(concurso.status, await listarEventos(db, id.data), hojeSP());
    if (!sugestao || sugestao.para !== esperado.data) {
      return falha("A sugestão não vale mais. Atualize a página.");
    }
    await repo.alterarStatus(db, usuarioId, id.data, sugestao.para, `Sugestão: ${sugestao.motivo}`);
    revalidar(id.data);
    return sucesso({ status: sugestao.para });
  });
}
