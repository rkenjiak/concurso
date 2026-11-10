"use server";

/**
 * Server Actions do feedback de usuários (#117).
 *
 * - `enviarFeedbackAcao`: qualquer usuário logado, sempre em nome do usuário da sessão (a visão
 *   escolhida por um admin, #108, não muda quem envia). Versão e commit vêm de `lib/versao.ts` e o
 *   user agent do cabeçalho: nada disso é aceito do cliente.
 * - Ações do admin (`exigirAdminAcao`), todas em lote (até 200 IDs), numa transação e com um
 *   registro de auditoria por lote (regras em `repositories/feedback.ts`).
 */
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { normalizarUserAgent } from "@/domain/feedback";
import { exportarFeedbacksComo } from "@/lib/feedback-exportacao";
import {
  desfazerDescarteSchema,
  type FormatoExportacaoFeedback,
  feedbackSchema,
  formatoExportacaoSchema,
  idsFeedbackSchema,
} from "@/lib/schemas/feedback";
import { commit, versao } from "@/lib/versao";
import { exigirUsuarioAcao } from "../auth/acesso";
import { exigirAdminAcao } from "../auth/admin";
import { getDb } from "../db/client";
import { log } from "../log";
import {
  criarFeedback,
  type Descarte,
  descartarFeedbacks,
  excluirFeedbacks,
  exportarFeedbacks,
  restaurarFeedbacks,
} from "../repositories/feedback";
import { executar, falhaValidacao, type ResultadoAcao, sucesso } from "./resultado";

const atualizarPainel = () => revalidatePath("/admin", "layout");

/** Envia um feedback (tipo, mensagem e a página atual, sem query string). */
export async function enviarFeedbackAcao(entrada: unknown): Promise<ResultadoAcao<{ id: number }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const dados = feedbackSchema.safeParse(entrada);
  if (!dados.success) return falhaValidacao(dados.error);
  const userAgent = normalizarUserAgent((await headers()).get("user-agent"));
  return executar(
    async () => {
      const id = await criarFeedback(getDb(), sessao.usuario, dados.data, {
        versaoApp: versao,
        commitApp: commit,
        userAgent,
      });
      log.info("feedback.enviado", { usuarioId: sessao.usuario.id, tipo: dados.data.tipo });
      return sucesso({ id });
    },
    { acao: "feedback.enviarFeedbackAcao", usuarioId: sessao.usuario.id },
  );
}

/**
 * Exporta os feedbacks no formato pedido e os marca como `EXPORTADO`. Devolve o conteúdo (sem
 * e-mail, salvo `incluirEmail`) e quantos itens foram exportados.
 */
export async function exportarFeedbacksAcao(
  idsBrutos: unknown,
  formatoBruto: unknown,
  incluirEmailBruto: unknown,
): Promise<ResultadoAcao<{ conteudo: string; exportados: number }>> {
  const sessao = await exigirAdminAcao();
  if (!sessao.ok) return sessao;
  const ids = idsFeedbackSchema.safeParse(idsBrutos);
  if (!ids.success) return falhaValidacao(ids.error);
  const formato = formatoExportacaoSchema.safeParse(formatoBruto);
  if (!formato.success) return falhaValidacao(formato.error);
  const incluirEmail = incluirEmailBruto === true;
  return executar(
    async () => {
      const itens = await exportarFeedbacks(getDb(), sessao.usuario, ids.data);
      atualizarPainel();
      const conteudo = exportarFeedbacksComo(formato.data as FormatoExportacaoFeedback, itens, {
        incluirEmail,
      });
      return sucesso({ conteudo, exportados: itens.length });
    },
    { acao: "feedback.exportarFeedbacksAcao", usuarioId: sessao.usuario.id },
  );
}

/**
 * Descarta (sem apagar). Devolve o status anterior de cada item e o instante do descarte, para o
 * "Desfazer".
 */
export async function descartarFeedbacksAcao(idsBrutos: unknown): Promise<ResultadoAcao<Descarte>> {
  const sessao = await exigirAdminAcao();
  if (!sessao.ok) return sessao;
  const ids = idsFeedbackSchema.safeParse(idsBrutos);
  if (!ids.success) return falhaValidacao(ids.error);
  return executar(
    async () => {
      const descarte = await descartarFeedbacks(getDb(), sessao.usuario, ids.data);
      atualizarPainel();
      return sucesso(descarte);
    },
    { acao: "feedback.descartarFeedbacksAcao", usuarioId: sessao.usuario.id },
  );
}

/**
 * Desfaz um descarte: cada item volta ao status que tinha, mas só se ainda estiver naquele
 * descarte (mesmo admin, mesmo instante). Um desfazer antigo não reverte mudanças posteriores.
 */
export async function desfazerDescarteAcao(
  entrada: unknown,
): Promise<ResultadoAcao<{ restaurados: number }>> {
  const sessao = await exigirAdminAcao();
  if (!sessao.ok) return sessao;
  const dados = desfazerDescarteSchema.safeParse(entrada);
  if (!dados.success) return falhaValidacao(dados.error);
  return executar(
    async () => {
      const restaurados = await restaurarFeedbacks(
        getDb(),
        sessao.usuario,
        dados.data.anteriores,
        undefined,
        { descartadoEm: dados.data.descartadoEm },
      );
      atualizarPainel();
      return sucesso({ restaurados });
    },
    { acao: "feedback.desfazerDescarteAcao", usuarioId: sessao.usuario.id },
  );
}

/** Restaura descartados para `NOVO` (aba Descartados). */
export async function restaurarFeedbacksAcao(
  idsBrutos: unknown,
): Promise<ResultadoAcao<{ restaurados: number }>> {
  const sessao = await exigirAdminAcao();
  if (!sessao.ok) return sessao;
  const ids = idsFeedbackSchema.safeParse(idsBrutos);
  if (!ids.success) return falhaValidacao(ids.error);
  return executar(
    async () => {
      const restaurados = await restaurarFeedbacks(
        getDb(),
        sessao.usuario,
        ids.data.map((id) => ({ id, status: "NOVO" as const })),
      );
      atualizarPainel();
      return sucesso({ restaurados });
    },
    { acao: "feedback.restaurarFeedbacksAcao", usuarioId: sessao.usuario.id },
  );
}

/** Exclui definitivamente (só itens descartados). */
export async function excluirFeedbacksAcao(
  idsBrutos: unknown,
): Promise<ResultadoAcao<{ excluidos: number }>> {
  const sessao = await exigirAdminAcao();
  if (!sessao.ok) return sessao;
  const ids = idsFeedbackSchema.safeParse(idsBrutos);
  if (!ids.success) return falhaValidacao(ids.error);
  return executar(
    async () => {
      const excluidos = await excluirFeedbacks(getDb(), sessao.usuario, ids.data);
      atualizarPainel();
      return sucesso({ excluidos });
    },
    { acao: "feedback.excluirFeedbacksAcao", usuarioId: sessao.usuario.id },
  );
}
