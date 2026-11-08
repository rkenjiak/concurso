"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { STATUS, type Status } from "@/domain/enums";
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

/** Altera o status; devolve o id do registro do histórico para o "Desfazer" do aviso (#100). */
export async function alterarStatus(
  idBruto: unknown,
  entrada: unknown,
): Promise<ResultadoAcao<{ registroId: number }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha("Concurso não encontrado.");
  const dados = alterarStatusSchema.safeParse(entrada);
  if (!dados.success) return falhaValidacao(dados.error);
  return executar(
    async () => {
      const registroId = await repo.alterarStatus(
        getDb(),
        usuarioId,
        id.data,
        dados.data.para,
        dados.data.observacao,
      );
      revalidar(id.data);
      return sucesso({ registroId });
    },
    { acao: "status.alterarStatus", usuarioId },
  );
}

const desfazerEsperadoSchema = z
  .object({ registroId: idSchema.optional(), status: z.enum(STATUS).optional() })
  .refine((e) => e.registroId !== undefined || e.status !== undefined);

/**
 * Desfaz a última mudança de status, só se ela ainda for a `esperada` (#100): o registro criado
 * pela mudança (aviso "Desfazer") ou o status atual que o usuário vê (diálogo "Mudar status").
 * Se o status mudou desde então (outra aba, "Desfazer" duplo), recusa sem mudar nada.
 */
export async function desfazerUltimoStatus(
  idBruto: unknown,
  esperadoBruto: unknown,
): Promise<ResultadoAcao<{ status: Status }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha("Concurso não encontrado.");
  const esperado = desfazerEsperadoSchema.safeParse(esperadoBruto);
  if (!esperado.success) return falha("Mudança inválida.");
  return executar(
    async () => {
      const status = await repo.desfazerUltimoStatus(getDb(), usuarioId, id.data, esperado.data);
      revalidar(id.data);
      return sucesso({ status });
    },
    { acao: "status.desfazerUltimoStatus", usuarioId },
  );
}

/** O que a resposta a uma pendência mudou — o necessário para desfazê-la (#100). */
export interface RespostaAplicada {
  status: Status;
  /** Registro do histórico criado pela resposta; `null` = a resposta não mudou o status. */
  registroStatus: number | null;
  /** Evento que a resposta concluiu (ex.: boleto pago); `null` = nenhum. */
  eventoConcluido: number | null;
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
): Promise<ResultadoAcao<RespostaAplicada>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha("Concurso não encontrado.");
  const alvo = lerChavePendencia(chaveBruta);
  const respostaId = z.string().max(40).safeParse(respostaBruta);
  if (!alvo || !respostaId.success) return falha("Pendência inválida.");
  return executar(
    async () => {
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
      const registroStatus = await db.transaction(async (tx) => {
        if (concluirEvento) {
          await definirConcluido(tx, usuarioId, id.data, pendencia.eventoId, true);
        }
        if (!para) return null;
        return repo.alterarStatus(
          tx,
          usuarioId,
          id.data,
          para,
          observacaoResposta(pendencia, resposta),
        );
      });
      revalidar(id.data);
      if (concluirEvento) revalidatePath("/", "layout");
      return sucesso({
        status: resposta.para ?? concurso.status,
        registroStatus,
        eventoConcluido: concluirEvento ? pendencia.eventoId : null,
      });
    },
    { acao: "status.responderPendenciaStatus", usuarioId },
  );
}

const desfazerRespostaSchema = z.object({
  registroStatus: idSchema.nullable(),
  eventoConcluido: idSchema.nullable(),
});

/**
 * Desfaz a resposta a uma pendência ("Desfazer" do aviso, #100): numa transação, volta o status
 * (se a resposta o mudou e a última mudança ainda for a dela) e reabre o evento que ela concluiu.
 * A pergunta volta a valer.
 */
export async function desfazerRespostaPendencia(
  idBruto: unknown,
  entrada: unknown,
): Promise<ResultadoAcao<{ status: Status }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha("Concurso não encontrado.");
  const dados = desfazerRespostaSchema.safeParse(entrada);
  if (!dados.success) return falha("Resposta inválida.");
  return executar(
    async () => {
      const status = await repo.desfazerResposta(getDb(), usuarioId, id.data, dados.data);
      if (dados.data.eventoConcluido !== null) revalidatePath("/", "layout");
      revalidar(id.data);
      return sucesso({ status });
    },
    { acao: "status.desfazerRespostaPendencia", usuarioId },
  );
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
  return executar(
    async () => {
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
    },
    { acao: "status.dispensarPendenciaStatus", usuarioId },
  );
}
