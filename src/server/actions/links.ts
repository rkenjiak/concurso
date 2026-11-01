"use server";

import { revalidatePath } from "next/cache";
import { idSchema } from "@/lib/schemas/comum";
import { linkSchema, ordemLinksSchema } from "@/lib/schemas/link";
import { exigirUsuarioAcao } from "../auth/acesso";
import { getDb } from "../db/client";
import * as repo from "../repositories/links";
import { executar, falha, falhaValidacao, type ResultadoAcao, sucesso } from "./resultado";

const INVALIDO = "Link não encontrado.";

/** Cria (`linkId` nulo) ou atualiza um link do concurso. */
export async function salvarLink(
  concursoIdBruto: unknown,
  linkIdBruto: unknown,
  entrada: unknown,
): Promise<ResultadoAcao<{ id: number }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const concursoId = idSchema.safeParse(concursoIdBruto);
  if (!concursoId.success) return falha("Concurso não encontrado.");
  const linkId = linkIdBruto == null ? null : idSchema.safeParse(linkIdBruto);
  if (linkId && !linkId.success) return falha(INVALIDO);
  const dados = linkSchema.safeParse(entrada);
  if (!dados.success) return falhaValidacao(dados.error);
  return executar(async () => {
    const db = getDb();
    let id: number;
    if (linkId?.success) {
      id = linkId.data;
      await repo.atualizarLink(db, usuarioId, concursoId.data, id, dados.data);
    } else {
      id = await repo.criarLink(db, usuarioId, concursoId.data, dados.data);
    }
    revalidatePath(`/concursos/${concursoId.data}`);
    return sucesso({ id });
  });
}

export async function excluirLink(
  concursoIdBruto: unknown,
  linkIdBruto: unknown,
): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const concursoId = idSchema.safeParse(concursoIdBruto);
  const linkId = idSchema.safeParse(linkIdBruto);
  if (!concursoId.success || !linkId.success) return falha(INVALIDO);
  return executar(async () => {
    await repo.excluirLink(getDb(), usuarioId, concursoId.data, linkId.data);
    revalidatePath(`/concursos/${concursoId.data}`);
    return sucesso(null);
  });
}

export async function reordenarLinks(
  concursoIdBruto: unknown,
  idsBrutos: unknown,
): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const concursoId = idSchema.safeParse(concursoIdBruto);
  if (!concursoId.success) return falha("Concurso não encontrado.");
  const ids = ordemLinksSchema.safeParse(idsBrutos);
  if (!ids.success) return falhaValidacao(ids.error);
  return executar(async () => {
    await repo.reordenarLinks(getDb(), usuarioId, concursoId.data, ids.data);
    revalidatePath(`/concursos/${concursoId.data}`);
    return sucesso(null);
  });
}
