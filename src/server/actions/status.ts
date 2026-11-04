"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Status } from "@/domain/enums";
import {
  DIAS_LEMBRAR_DEPOIS,
  lerChavePendencia,
  observacaoResposta,
  pendenciasStatus,
} from "@/domain/sugestao-status";
import { idSchema } from "@/lib/schemas/comum";
import { alterarStatusSchema } from "@/lib/schemas/status";
import { hojeSP, somarDias } from "@/lib/tz";
import { exigirUsuarioAcao } from "../auth/acesso";
import { getDb } from "../db/client";
import { obterConcurso } from "../queries/concursos";
import { listarEventos } from "../queries/eventos";
import { definirConcluido } from "../repositories/eventos";
import { dispensarPendencia } from "../repositories/pendencias";
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
 * Responde a uma pendência de status (#65, #85). A pendência é recalculada aqui (não confia no
 * cliente) e a resposta aplicada pela mesma transição validada, com pergunta, resposta e motivo
 * na observação do histórico. Se a pendência mudou, nada é alterado.
 */
export async function responderPendenciaStatus(
  idBruto: unknown,
  chaveBruta: unknown,
  respostaBruta: unknown,
): Promise<ResultadoAcao<{ status: Status }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha("Concurso não encontrado.");
  const alvo = lerChavePendencia(chaveBruta);
  const respostaId = z.string().max(40).safeParse(respostaBruta);
  if (!alvo || !respostaId.success) return falha("Pendência inválida.");
  return executar(async () => {
    const db = getDb();
    const concurso = await obterConcurso(db, usuarioId, id.data);
    if (!concurso) return falha("Concurso não encontrado.");
    const pendencia = pendenciasStatus(
      concurso.status,
      await listarEventos(db, id.data),
      hojeSP(),
    ).find((p) => p.chave === chaveBruta);
    const resposta = pendencia?.respostas.find((r) => r.id === respostaId.data);
    if (!pendencia || !resposta) {
      return falha("Esta pergunta não vale mais. Atualize a página.");
    }
    const { para, concluirEvento } = resposta;
    // Status e conclusão do evento (ex.: boleto pago) juntos: se um falhar, nada muda.
    await db.transaction(async (tx) => {
      if (concluirEvento) {
        await definirConcluido(tx, usuarioId, id.data, pendencia.eventoId, true);
      }
      if (para) {
        await repo.alterarStatus(
          tx,
          usuarioId,
          id.data,
          para,
          observacaoResposta(pendencia, resposta),
        );
      }
    });
    revalidar(id.data);
    return sucesso({ status: resposta.para ?? concurso.status });
  });
}

const modoDispensaSchema = z.enum(["dispensar", "lembrar"]);

/**
 * Dispensa ("não perguntar mais") ou adia por {@link DIAS_LEMBRAR_DEPOIS} dias ("lembrar depois")
 * uma pendência de status (#85). Se o evento mudar de data, a pendência volta.
 */
export async function dispensarPendenciaStatus(
  idBruto: unknown,
  chaveBruta: unknown,
  modoBruto: unknown,
): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha("Concurso não encontrado.");
  const alvo = lerChavePendencia(chaveBruta);
  const modo = modoDispensaSchema.safeParse(modoBruto);
  if (!alvo || !modo.success) return falha("Pendência inválida.");
  return executar(async () => {
    const db = getDb();
    const concurso = await obterConcurso(db, usuarioId, id.data);
    if (!concurso) return falha("Concurso não encontrado.");
    const hoje = hojeSP();
    const pendencia = pendenciasStatus(
      concurso.status,
      await listarEventos(db, id.data),
      hoje,
    ).find((p) => p.chave === chaveBruta);
    if (!pendencia) return falha("Esta pergunta não vale mais. Atualize a página.");
    await dispensarPendencia(db, usuarioId, id.data, {
      regra: pendencia.regra,
      eventoId: pendencia.eventoId,
      dataEvento: pendencia.dataEvento,
      ate: modo.data === "lembrar" ? somarDias(hoje, DIAS_LEMBRAR_DEPOIS) : null,
    });
    revalidar(id.data);
    return sucesso(null);
  });
}
