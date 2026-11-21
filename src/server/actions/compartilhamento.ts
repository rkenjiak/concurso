"use server";

/**
 * Server Actions de compartilhamento público de concursos (#129).
 *
 * - `gerarCompartilhamentoAcao` usa apenas `refresh()` (preserva o prefetch do dono, #124).
 * - `regenerarCompartilhamentoAcao` e `revogarCompartilhamentoAcao` também invalidam o cache ISR
 *   do token anterior (`revalidatePath("/compartilhado/<tokenAnterior>")`) para que o primeiro GET
 *   seguinte já devolva HTTP 404 (exceção consciente ao #124).
 */
import { refresh, revalidatePath } from "next/cache";
import { caminhoCompartilhado } from "@/lib/compartilhamento";
import { idSchema } from "@/lib/schemas/comum";
import { exigirUsuarioAcao } from "../auth/acesso";
import { getDb } from "../db/client";
import {
  ativarCompartilhamento,
  regenerarCompartilhamento,
  revogarCompartilhamento,
} from "../repositories/compartilhamento";
import { executar, falha, type ResultadoAcao, sucesso } from "./resultado";

const NAO_ENCONTRADO = "Concurso não encontrado.";

/** Ativa o link público do concurso (idempotente se já existir um ativo). */
export async function gerarCompartilhamentoAcao(
  concursoIdBruto: unknown,
): Promise<ResultadoAcao<{ token: string }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const id = idSchema.safeParse(concursoIdBruto);
  if (!id.success) return falha(NAO_ENCONTRADO);
  return executar(
    async () => {
      const { token } = await ativarCompartilhamento(getDb(), usuarioId, id.data);
      refresh();
      return sucesso({ token });
    },
    { acao: "compartilhamento.gerarCompartilhamentoAcao", usuarioId },
  );
}

/** Gera um novo token de compartilhamento e invalida imediatamente o cache ISR do anterior. */
export async function regenerarCompartilhamentoAcao(
  concursoIdBruto: unknown,
): Promise<ResultadoAcao<{ token: string }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const id = idSchema.safeParse(concursoIdBruto);
  if (!id.success) return falha(NAO_ENCONTRADO);
  return executar(
    async () => {
      const { token, tokenAnterior } = await regenerarCompartilhamento(getDb(), usuarioId, id.data);
      if (tokenAnterior) revalidatePath(caminhoCompartilhado(tokenAnterior));
      refresh();
      return sucesso({ token });
    },
    { acao: "compartilhamento.regenerarCompartilhamentoAcao", usuarioId },
  );
}

/** Revoga o link público do concurso e invalida imediatamente o cache ISR do token. */
export async function revogarCompartilhamentoAcao(
  concursoIdBruto: unknown,
): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const id = idSchema.safeParse(concursoIdBruto);
  if (!id.success) return falha(NAO_ENCONTRADO);
  return executar(
    async () => {
      const { tokenAnterior } = await revogarCompartilhamento(getDb(), usuarioId, id.data);
      if (tokenAnterior) revalidatePath(caminhoCompartilhado(tokenAnterior));
      refresh();
      return sucesso(null);
    },
    { acao: "compartilhamento.revogarCompartilhamentoAcao", usuarioId },
  );
}
